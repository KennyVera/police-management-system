from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    Escuadra,
    GestionHorario,
    ParteAprehension,
    VehiculoFlota,
)
from roles.supervisor_unidad.scope import agentes_en_zona_qs, partes_en_zona_qs


def _pct(part, whole):
    if not whole:
        return 0
    return round((part / whole) * 100)


def _user_label(u):
    if not u:
        return "—"
    name = f"{u.first_name} {u.last_name}".strip()
    return name or u.username


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def home(request):
    # Usar zona horaria de Django (no date.today() del contenedor UTC)
    hoy = timezone.localdate()
    ahora = timezone.localtime()
    inicio_dia = timezone.make_aware(
        datetime.combine(hoy, datetime.min.time()),
        timezone.get_current_timezone(),
    )

    # —— Personal / fuerza efectiva (solo zona del supervisor) ——
    agentes_zona = agentes_en_zona_qs(request.user)
    agente_ids = list(agentes_zona.values_list("id", flat=True))
    agentes_total = len(agente_ids)
    agentes_activos = (
        AsignacionDiaria.objects.filter(
            fecha=hoy, activo=True, agente_id__in=agente_ids
        )
        .values("agente_id")
        .distinct()
        .count()
        if agente_ids
        else 0
    )
    fuerza_pct = _pct(agentes_activos, agentes_total) if agentes_total else 0

    # —— Control de calidad / partes (solo zona) ——
    # Aprobados/devueltos del día = por fecha de revisión, no de creación del parte.
    partes_zona = partes_en_zona_qs(request.user)
    aprobados = partes_zona.filter(aprobado_en__gte=inicio_dia).count()
    devueltos = partes_zona.filter(rechazado_en__gte=inicio_dia).count()
    pendientes = partes_zona.filter(
        estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
    ).count()
    # En el donut de “hoy”: revisados hoy + cola actual pendiente
    total_calidad = aprobados + pendientes + devueltos
    revisados_hoy = aprobados + devueltos
    procesados_den = total_calidad or (revisados_hoy + pendientes)
    procesados_pct = _pct(revisados_hoy, procesados_den) if procesados_den else 0

    # —— Flota ——
    flota_total = VehiculoFlota.objects.count()
    flota_operativos = VehiculoFlota.objects.filter(activo=True).count()
    flota_mantenimiento = max(flota_total - flota_operativos, 0)
    flota_pct = _pct(flota_operativos, flota_total) if flota_total else 0

    # —— Alertas críticas ——
    alertas_criticas = (
        AlertaDespacho.objects.filter(
            prioridad=AlertaDespacho.Prioridad.ALTA,
            asignada_en__gte=inicio_dia - timedelta(days=1),
        )
        .exclude(estado__in=[AlertaDespacho.Estado.CERRADA, AlertaDespacho.Estado.CANCELADA])
        .count()
    )

    # —— Últimos partes pendientes (solo zona) ——
    pendientes_qs = (
        partes_zona.filter(
            estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
        )
        .select_related("creado_por", "tipo_delito")
        .order_by("-enviado_revision_en", "-creado_en")[:6]
    )
    partes_revision = [
        {
            "id": p.id,
            "hora": timezone.localtime(
                p.enviado_revision_en or p.creado_en
            ).strftime("%H:%M")
            if (p.enviado_revision_en or p.creado_en)
            else "—",
            "agente": _user_label(p.creado_por),
            "tipo_delito": getattr(p.tipo_delito, "nombre", None) or p.titulo or "—",
            "sector": p.sector_zona or p.lugar or "—",
            "estado": "Pendiente",
            "numero_caso": p.numero_caso or f"P-{p.id}",
        }
        for p in pendientes_qs
    ]

    # —— Actividad por escuadra ——
    # Preferir escuadras de hoy; si no hay (desfase de fecha), usar la fecha más reciente.
    escuadras_qs = Escuadra.objects.filter(
        fecha=hoy, activo=True, supervisor=request.user
    )
    if not escuadras_qs.exists():
        ultima_fecha = (
            Escuadra.objects.filter(activo=True, supervisor=request.user)
            .order_by("-fecha")
            .values_list("fecha", flat=True)
            .first()
        )
        if ultima_fecha:
            escuadras_qs = Escuadra.objects.filter(
                fecha=ultima_fecha, activo=True, supervisor=request.user
            )

    # Actividad = agentes asignados + partes creados hoy por esos agentes
    escuadras = list(
        escuadras_qs.annotate(
            n_asig=Count("asignaciones", filter=Q(asignaciones__activo=True))
        ).order_by("-n_asig", "nombre")[:8]
    )
    actividad_escuadras = []
    for e in escuadras:
        agente_ids_esc = list(
            AsignacionDiaria.objects.filter(escuadra=e, activo=True).values_list(
                "agente_id", flat=True
            )
        )
        partes_count = 0
        if agente_ids_esc:
            partes_count = partes_zona.filter(
                creado_por_id__in=agente_ids_esc,
                creado_en__gte=inicio_dia,
            ).count()
        actividad_escuadras.append(
            {
                "nombre": e.nombre or f"Escuadra {e.id}",
                "total": int(e.n_asig or 0) + partes_count,
                "agentes": int(e.n_asig or 0),
                "partes": partes_count,
            }
        )

    # —— Distribución por sector (asignaciones de agentes de la zona) ——
    sectores_raw = (
        AsignacionDiaria.objects.filter(
            fecha=hoy, activo=True, agente_id__in=agente_ids or [-1]
        )
        .exclude(cuadrante="")
        .values("cuadrante")
        .annotate(total=Count("id"))
        .order_by("-total")[:6]
    )
    # Fallback: última fecha con asignaciones en zona
    if not sectores_raw and agente_ids:
        ultima_asig = (
            AsignacionDiaria.objects.filter(activo=True, agente_id__in=agente_ids)
            .order_by("-fecha")
            .values_list("fecha", flat=True)
            .first()
        )
        if ultima_asig:
            sectores_raw = (
                AsignacionDiaria.objects.filter(
                    fecha=ultima_asig, activo=True, agente_id__in=agente_ids
                )
                .exclude(cuadrante="")
                .values("cuadrante")
                .annotate(total=Count("id"))
                .order_by("-total")[:6]
            )

    distribucion_sectores = [
        {
            "sector": r["cuadrante"] or "Sin sector",
            "patrullas": r["total"],
            "estado": "activa",
        }
        for r in sectores_raw
    ]

    apro_pct = _pct(aprobados, total_calidad) if total_calidad else 0
    pend_pct = _pct(pendientes, total_calidad) if total_calidad else 0
    dev_pct = _pct(devueltos, total_calidad) if total_calidad else 0

    return Response(
        {
            "role": "Supervisor de Unidad",
            "module": "dashboard",
            "status": "ready",
            "user": request.user.get_username(),
            "fecha": ahora.strftime("%A, %d de %B de %Y"),
            "fecha_iso": hoy.isoformat(),
            "turno": {"inicio": "07:00", "fin": "19:00"},
            "kpis": {
                "fuerza_efectiva": {
                    "porcentaje": fuerza_pct,
                    "activos": agentes_activos,
                    "total": agentes_total,
                    "delta_ayer_pct": None,
                },
                "control_calidad": {
                    "pendientes": pendientes,
                    "revisados_hoy": revisados_hoy,
                    "procesados_pct": procesados_pct,
                },
                "flota": {
                    "porcentaje": flota_pct,
                    "operativos": flota_operativos,
                    "total": flota_total,
                    "en_mantenimiento": flota_mantenimiento,
                },
                "alertas_criticas": {"total": alertas_criticas},
            },
            "calidad_partes": {
                "total": total_calidad,
                "aprobados": aprobados,
                "pendientes": pendientes,
                "devueltos": devueltos,
                "aprobados_pct": apro_pct,
                "pendientes_pct": pend_pct,
                "devueltos_pct": dev_pct,
                "calidad_ok": (dev_pct <= 20) if total_calidad else True,
            },
            "partes_revision": partes_revision,
            "actividad_escuadras": actividad_escuadras,
            "distribucion_sectores": distribucion_sectores,
            "stats": {
                "partes_pendientes": pendientes,
                "escuadras_hoy": Escuadra.objects.filter(
                    fecha=hoy, activo=True, supervisor=request.user
                ).count(),
                "asignaciones_hoy": AsignacionDiaria.objects.filter(
                    fecha=hoy, activo=True, agente_id__in=agente_ids or [-1]
                ).count(),
                "horarios_pendientes": GestionHorario.objects.filter(
                    estado=GestionHorario.Estado.PENDIENTE,
                    supervisor=request.user,
                ).count(),
            },
        }
    )
