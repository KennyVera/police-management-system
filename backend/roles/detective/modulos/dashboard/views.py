from calendar import monthrange
from datetime import date, datetime, timedelta

from django.db.models import Count, Max
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import DetectiveOnly
from operativo.models import EvidenciaCaso, ExpedienteCaso

ESTANCAMIENTO_DIAS = 15


def _pct(part, whole):
    if not whole:
        return 0
    return round((part / whole) * 100)


def _month_bounds(ref: date):
    start = ref.replace(day=1)
    end = ref.replace(day=monthrange(ref.year, ref.month)[1])
    return start, end


def _parse_periodo(request):
    """Devuelve (inicio, fin, etiqueta) según query params."""
    hoy = timezone.localdate()
    periodo = (request.query_params.get("periodo") or "mes").lower()
    desde = request.query_params.get("desde")
    hasta = request.query_params.get("hasta")

    if desde and hasta:
        try:
            d0 = date.fromisoformat(desde)
            d1 = date.fromisoformat(hasta)
            return d0, d1, f"{d0.isoformat()} – {d1.isoformat()}"
        except ValueError:
            pass

    if periodo == "trimestre":
        q = (hoy.month - 1) // 3
        start = date(hoy.year, q * 3 + 1, 1)
        end_month = q * 3 + 3
        end = date(hoy.year, end_month, monthrange(hoy.year, end_month)[1])
        return start, end, "Este trimestre"
    if periodo == "anio":
        return date(hoy.year, 1, 1), date(hoy.year, 12, 31), "Este año"

    start, end = _month_bounds(hoy)
    return start, end, "Este mes"


def _aware_day_start(d: date):
    return timezone.make_aware(datetime.combine(d, datetime.min.time()))


def _aware_day_end(d: date):
    return timezone.make_aware(datetime.combine(d, datetime.max.time()))


def _rel_actividad(dias):
    if dias is None:
        return "Sin actividad registrada"
    if dias <= 0:
        return "Hoy"
    if dias == 1:
        return "Hace 1 día"
    return f"Hace {dias} días"


def _estado_badge(estado):
    labels = {
        ExpedienteCaso.Estado.INDAGACION_PREVIA: "En Indagación",
        ExpedienteCaso.Estado.INSTRUCCION_FISCAL: "En Instrucción",
        ExpedienteCaso.Estado.SUSPENDIDO: "Suspendido",
        ExpedienteCaso.Estado.CERRADO: "Cerrado",
    }
    tones = {
        ExpedienteCaso.Estado.INDAGACION_PREVIA: "blue",
        ExpedienteCaso.Estado.INSTRUCCION_FISCAL: "orange",
        ExpedienteCaso.Estado.SUSPENDIDO: "gray",
        ExpedienteCaso.Estado.CERRADO: "green",
    }
    return labels.get(estado, estado), tones.get(estado, "gray")


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def home(request):
    user = request.user
    ahora = timezone.now()
    periodo_inicio, periodo_fin, periodo_label = _parse_periodo(request)
    p0 = _aware_day_start(periodo_inicio)
    p1 = _aware_day_end(periodo_fin)

    # Mes anterior (para delta de efectividad)
    prev_ref = (periodo_inicio.replace(day=1) - timedelta(days=1))
    prev_start, prev_end = _month_bounds(prev_ref)
    prev0 = _aware_day_start(prev_start)
    prev1 = _aware_day_end(prev_end)

    casos = ExpedienteCaso.objects.filter(detective_asignado=user)
    activos = casos.exclude(estado=ExpedienteCaso.Estado.CERRADO)

    en_indagacion = activos.filter(
        estado=ExpedienteCaso.Estado.INDAGACION_PREVIA
    ).count()
    en_instruccion = activos.filter(
        estado=ExpedienteCaso.Estado.INSTRUCCION_FISCAL
    ).count()
    suspendidos = activos.filter(estado=ExpedienteCaso.Estado.SUSPENDIDO).count()
    total_activos = activos.count()

    cerrados_periodo = casos.filter(
        estado=ExpedienteCaso.Estado.CERRADO,
        cerrado_en__gte=p0,
        cerrado_en__lte=p1,
    )
    cerrados_prev = casos.filter(
        estado=ExpedienteCaso.Estado.CERRADO,
        cerrado_en__gte=prev0,
        cerrado_en__lte=prev1,
    ).count()
    cerrados_n = cerrados_periodo.count()

    delta_efectividad = None
    if cerrados_prev > 0:
        delta_efectividad = round(((cerrados_n - cerrados_prev) / cerrados_prev) * 100)
    elif cerrados_n > 0:
        delta_efectividad = 100

    # Tiempo promedio de resolución (días) en el periodo
    dias_resolucion = []
    for exp in cerrados_periodo.exclude(cerrado_en=None).only("creado_en", "cerrado_en"):
        if exp.creado_en and exp.cerrado_en:
            dias_resolucion.append(max(0, (exp.cerrado_en - exp.creado_en).days))
    tiempo_promedio = (
        round(sum(dias_resolucion) / len(dias_resolucion)) if dias_resolucion else 0
    )

    # Última actividad = max(actualizado_en, última bitácora, última evidencia)
    umbral = ahora - timedelta(days=ESTANCAMIENTO_DIAS)
    activos_ann = activos.annotate(
        last_bitacora=Max("bitacora__fecha_hora"),
        last_evidencia=Max("evidencias__creado_en"),
    )

    estancados = []
    prioritarios = []
    for exp in activos_ann.select_related("tipo_delito").order_by("-prioridad", "actualizado_en"):
        last = exp.actualizado_en
        for candidate in (exp.last_bitacora, exp.last_evidencia):
            if candidate and (last is None or candidate > last):
                last = candidate
        dias = (ahora - last).days if last else None
        critico = dias is not None and dias >= ESTANCAMIENTO_DIAS
        label, tone = _estado_badge(exp.estado)
        row = {
            "id": exp.id,
            "numero_expediente": exp.numero_expediente or f"EXP-{exp.id}",
            "titulo": exp.titulo or "—",
            "delito": getattr(exp.tipo_delito, "nombre", None) or exp.titulo or "—",
            "estado": exp.estado,
            "estado_label": label,
            "estado_tone": tone,
            "prioridad": exp.prioridad,
            "ultima_actividad": last.isoformat() if last else None,
            "ultima_actividad_rel": _rel_actividad(dias),
            "dias_sin_actividad": dias if dias is not None else 0,
            "critico": critico,
        }
        if critico:
            estancados.append(row)
        prioritarios.append(row)

    # Orden prioritarios: críticos primero, luego más días sin actividad
    prioritarios.sort(
        key=lambda r: (0 if r["critico"] else 1, -(r["dias_sin_actividad"] or 0))
    )
    prioritarios = prioritarios[:8]

    # Tipología de delitos (activos)
    tipologia = list(
        activos.exclude(tipo_delito=None)
        .values("tipo_delito__nombre")
        .annotate(total=Count("id"))
        .order_by("-total")[:8]
    )
    tipologia_delitos = [
        {"nombre": t["tipo_delito__nombre"] or "Sin tipificar", "total": t["total"]}
        for t in tipologia
    ]
    # Incluir sin tipificar si hay
    sin_tipo = activos.filter(tipo_delito=None).count()
    if sin_tipo:
        tipologia_delitos.append({"nombre": "Sin tipificar", "total": sin_tipo})

    evidencias = EvidenciaCaso.objects.filter(expediente__detective_asignado=user)

    return Response(
        {
            "role": "Detective / Investigador",
            "module": "dashboard",
            "status": "ready",
            "periodo": {
                "clave": request.query_params.get("periodo") or "mes",
                "label": periodo_label,
                "desde": periodo_inicio.isoformat(),
                "hasta": periodo_fin.isoformat(),
            },
            "kpis": {
                "casos_activos": {
                    "total": total_activos,
                    "hint": "Expedientes abiertos",
                    "nota": "Bajo su responsabilidad.",
                },
                "efectividad": {
                    "cerrados": cerrados_n,
                    "hint": "Casos cerrados este periodo",
                    "delta_pct": delta_efectividad,
                },
                "tiempo_resolucion": {
                    "dias": tiempo_promedio,
                    "hint": "Días por caso",
                },
                "estancamiento": {
                    "total": len(estancados),
                    "hint": f"Casos en rojo: sin actividad en más de {ESTANCAMIENTO_DIAS} días.",
                    "umbral_dias": ESTANCAMIENTO_DIAS,
                },
            },
            "estado_procesal": {
                "total": total_activos,
                "indagacion": {
                    "total": en_indagacion,
                    "pct": _pct(en_indagacion, total_activos),
                    "label": "En Indagación Previa",
                    "desc": "Fase de recolección de indicios",
                },
                "instruccion": {
                    "total": en_instruccion,
                    "pct": _pct(en_instruccion, total_activos),
                    "label": "En Instrucción Fiscal",
                    "desc": "Investigación formal en curso",
                },
                "suspendidos": {
                    "total": suspendidos,
                    "pct": _pct(suspendidos, total_activos),
                    "label": "Suspendidos",
                    "desc": "Por disposición fiscal o judicial",
                },
            },
            "tipologia_delitos": tipologia_delitos,
            "casos_prioritarios": prioritarios,
            "casos_criticos": estancados[:6],
            # Compatibilidad con cards antiguas
            "casos_asignados": casos.count(),
            "en_indagacion": en_indagacion,
            "en_instruccion": en_instruccion,
            "evidencias": evidencias.count(),
            "digitales": evidencias.filter(tipo=EvidenciaCaso.Tipo.DIGITAL).count(),
            "fisicas": evidencias.filter(tipo=EvidenciaCaso.Tipo.FISICA).count(),
        }
    )
