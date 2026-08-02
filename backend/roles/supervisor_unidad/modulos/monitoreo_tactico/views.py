from datetime import date, datetime, timedelta
from statistics import mean

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    NovedadIncidente,
    OrdenAdicional,
    ParteAprehension,
)
from operativo.serializers import _user_label


def _segundos_respuesta(alerta):
    """Tiempo desde en camino (o asignación) hasta llegada al lugar."""
    inicio = alerta.en_camino_en or alerta.asignada_en
    fin = alerta.llegada_en
    if not inicio or not fin:
        return None
    return max(0, (fin - inicio).total_seconds())


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def unidades_gps(request):
    """Posiciones actuales de patrullas en turno (AsignacionDiaria del día)."""
    hoy = date.today()
    qs = (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .select_related("agente", "agente__profile", "companero", "vehiculo", "escuadra")
        .order_by("unidad_label")
    )

    alertas_activas = (
        AlertaDespacho.objects.filter(
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ],
            agente_id__isnull=False,
        )
        .select_related("agente")
        .order_by("-asignada_en")
    )
    alerta_por_agente = {}
    for al in alertas_activas:
        alerta_por_agente.setdefault(al.agente_id, al)

    items = []
    for a in qs:
        alerta = alerta_por_agente.get(a.agente_id)
        items.append(
            {
                "id": a.id,
                "agente": _user_label(a.agente),
                "companero": _user_label(a.companero),
                "unidad_label": a.unidad_label,
                "vehiculo_placa": a.vehiculo_placa,
                "vehiculo_tipo": a.vehiculo_tipo,
                "cuadrante": a.cuadrante,
                "sector_detalle": a.sector_detalle,
                "latitud": a.latitud,
                "longitud": a.longitud,
                "turno_inicio": a.turno_inicio,
                "turno_fin": a.turno_fin,
                "escuadra": a.escuadra.nombre if a.escuadra_id else None,
                "estado_operativo": (
                    alerta.estado if alerta else "PATRULLAJE"
                ),
                "alerta_activa": (
                    {
                        "id": alerta.id,
                        "titulo": alerta.titulo,
                        "estado": alerta.estado,
                        "estado_label": alerta.get_estado_display(),
                        "prioridad": alerta.prioridad,
                        "direccion": alerta.direccion,
                        "latitud": alerta.latitud,
                        "longitud": alerta.longitud,
                    }
                    if alerta
                    else None
                ),
            }
        )

    return Response(
        {
            "fecha": str(hoy),
            "actualizado_en": timezone.now().isoformat(),
            "unidades": items,
            "con_gps": sum(1 for u in items if u["latitud"] is not None and u["longitud"] is not None),
        }
    )


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def estadisticas(request):
    """KPIs del día: auxilios, tiempos de respuesta y novedades."""
    hoy = date.today()
    inicio = timezone.make_aware(datetime.combine(hoy, datetime.min.time()))
    fin = inicio + timedelta(days=1)

    alertas_hoy = AlertaDespacho.objects.filter(
        asignada_en__gte=inicio,
        asignada_en__lt=fin,
    ).exclude(estado=AlertaDespacho.Estado.PENDIENTE)

    atendidos = alertas_hoy.filter(
        estado__in=[
            AlertaDespacho.Estado.EN_LUGAR,
            AlertaDespacho.Estado.CERRADA,
        ]
    )
    cerrados = alertas_hoy.filter(estado=AlertaDespacho.Estado.CERRADA).count()
    en_curso = alertas_hoy.filter(
        estado__in=[
            AlertaDespacho.Estado.ASIGNADA,
            AlertaDespacho.Estado.EN_CAMINO,
            AlertaDespacho.Estado.EN_LUGAR,
        ]
    ).count()

    tiempos = []
    for al in alertas_hoy.filter(llegada_en__isnull=False):
        seg = _segundos_respuesta(al)
        if seg is not None:
            tiempos.append(seg)

    avg_seg = mean(tiempos) if tiempos else None
    avg_min = round(avg_seg / 60.0, 1) if avg_seg is not None else None

    novedades_hoy = NovedadIncidente.objects.filter(
        Q(fecha_hora__gte=inicio, fecha_hora__lt=fin)
        | Q(creado_en__gte=inicio, creado_en__lt=fin)
    ).count()

    partes_generados = ParteAprehension.objects.filter(
        creado_en__gte=inicio, creado_en__lt=fin
    ).count()

    ordenes_hoy = OrdenAdicional.objects.filter(
        creado_en__gte=inicio, creado_en__lt=fin
    ).count()

    por_prioridad = list(
        alertas_hoy.values("prioridad").annotate(total=Count("id")).order_by("prioridad")
    )

    unidades_turno = AsignacionDiaria.objects.filter(fecha=hoy, activo=True).count()

    return Response(
        {
            "fecha": str(hoy),
            "auxilios": {
                "asignados_hoy": alertas_hoy.count(),
                "atendidos": atendidos.count(),
                "cerrados": cerrados,
                "en_curso": en_curso,
                "por_prioridad": [
                    {"prioridad": p["prioridad"], "total": p["total"]} for p in por_prioridad
                ],
            },
            "tiempos": {
                "muestras": len(tiempos),
                "promedio_minutos": avg_min,
                "promedio_segundos": round(avg_seg, 0) if avg_seg is not None else None,
            },
            "novedades_hoy": novedades_hoy,
            "partes_hoy": partes_generados,
            "ordenes_hoy": ordenes_hoy,
            "unidades_en_turno": unidades_turno,
        }
    )
