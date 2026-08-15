from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import AgenteOnly
from operativo.models import AlertaDespacho, AsignacionDiaria
from operativo.serializers import AlertaDespachoSerializer, AsignacionDiariaSerializer


def _turno_hoy(user):
    hoy = timezone.localdate()
    return (
        AsignacionDiaria.objects.filter(agente=user, fecha=hoy, activo=True)
        .select_related("agente", "companero", "supervisor", "zona", "agente__profile")
        .first()
        or AsignacionDiaria.objects.filter(agente=user, activo=True)
        .select_related("agente", "companero", "supervisor", "zona", "agente__profile")
        .order_by("-fecha")
        .first()
    )


def _agent_context(user):
    turno = _turno_hoy(user)
    # Fallback Quito centro si no hay coords
    lat = float(turno.latitud) if turno and turno.latitud is not None else -0.1806532
    lng = float(turno.longitud) if turno and turno.longitud is not None else -78.4678382
    return {
        "turno": turno,
        "agent_lat": lat,
        "agent_lng": lng,
        "unidad_label": (turno.unidad_label if turno else "Unidad móvil")
        or "Unidad móvil",
        "vehiculo_placa": turno.vehiculo_placa if turno else "",
    }


def _alertas_visibles_qs(user):
    """Alertas del agente o de su escuadra asignada."""
    return (
        AlertaDespacho.objects.filter(
            Q(agente=user)
            | Q(escuadra__agente_lider=user)
            | Q(escuadra__companeros=user)
        )
        .select_related("agente", "asignada_por", "escuadra")
        .prefetch_related("partes")
        .distinct()
    )


def _get_alerta_visible(user, pk):
    try:
        return _alertas_visibles_qs(user).get(pk=pk)
    except AlertaDespacho.DoesNotExist:
        return None


@api_view(["GET"])
@permission_classes([AgenteOnly])
def mi_turno(request):
    hoy = timezone.localdate()
    qs = _turno_hoy(request.user)
    if not qs:
        return Response(
            {
                "detail": "No tienes asignación de turno para hoy.",
                "asignacion": None,
                "fecha": str(hoy),
            }
        )
    return Response(
        {
            "fecha": str(hoy),
            "asignacion": AsignacionDiariaSerializer(qs).data,
        }
    )


@api_view(["GET"])
@permission_classes([AgenteOnly])
def alertas_collection(request):
    ctx = _agent_context(request.user)
    qs = _alertas_visibles_qs(request.user)
    estado = request.query_params.get("estado")
    if estado == "activas":
        qs = qs.filter(
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ]
        )
    elif estado:
        qs = qs.filter(estado=estado)

    order = {
        AlertaDespacho.Estado.ASIGNADA: 0,
        AlertaDespacho.Estado.EN_CAMINO: 1,
        AlertaDespacho.Estado.EN_LUGAR: 2,
        AlertaDespacho.Estado.CERRADA: 3,
        AlertaDespacho.Estado.CANCELADA: 4,
    }
    items = list(qs)
    items.sort(key=lambda a: (order.get(a.estado, 9), -a.asignada_en.timestamp()))
    ser_ctx = {
        "agent_lat": ctx["agent_lat"],
        "agent_lng": ctx["agent_lng"],
    }
    return Response(
        {
            "unidad": {
                "label": ctx["unidad_label"],
                "latitud": ctx["agent_lat"],
                "longitud": ctx["agent_lng"],
                "vehiculo_placa": ctx["vehiculo_placa"],
            },
            "alertas": AlertaDespachoSerializer(items, many=True, context=ser_ctx).data,
        }
    )


@api_view(["GET"])
@permission_classes([AgenteOnly])
def alerta_detail(request, pk):
    ctx = _agent_context(request.user)
    obj = _get_alerta_visible(request.user, pk)
    if not obj:
        return Response({"detail": "Alerta no encontrada."}, status=404)
    return Response(
        AlertaDespachoSerializer(
            obj, context={"agent_lat": ctx["agent_lat"], "agent_lng": ctx["agent_lng"]}
        ).data
    )


@api_view(["POST"])
@permission_classes([AgenteOnly])
def alerta_en_camino(request, pk):
    obj = _get_alerta_visible(request.user, pk)
    if not obj:
        return Response({"detail": "Alerta no encontrada."}, status=404)

    if obj.estado not in (
        AlertaDespacho.Estado.ASIGNADA,
        AlertaDespacho.Estado.EN_CAMINO,
    ):
        return Response(
            {
                "detail": (
                    f"No puedes marcar En camino desde el estado "
                    f"{obj.get_estado_display()}."
                )
            },
            status=400,
        )

    obj.estado = AlertaDespacho.Estado.EN_CAMINO
    if not obj.en_camino_en:
        obj.en_camino_en = timezone.now()
    obj.save(update_fields=["estado", "en_camino_en", "actualizado_en"])
    ctx = _agent_context(request.user)
    return Response(
        AlertaDespachoSerializer(
            obj, context={"agent_lat": ctx["agent_lat"], "agent_lng": ctx["agent_lng"]}
        ).data
    )


@api_view(["POST"])
@permission_classes([AgenteOnly])
def alerta_llegada(request, pk):
    obj = _get_alerta_visible(request.user, pk)
    if not obj:
        return Response({"detail": "Alerta no encontrada."}, status=404)

    if obj.estado not in (
        AlertaDespacho.Estado.ASIGNADA,
        AlertaDespacho.Estado.EN_CAMINO,
        AlertaDespacho.Estado.EN_LUGAR,
    ):
        return Response(
            {
                "detail": (
                    f"No puedes marcar Llegada desde el estado "
                    f"{obj.get_estado_display()}."
                )
            },
            status=400,
        )

    now = timezone.now()
    if obj.estado == AlertaDespacho.Estado.ASIGNADA and not obj.en_camino_en:
        obj.en_camino_en = now
    obj.estado = AlertaDespacho.Estado.EN_LUGAR
    if not obj.llegada_en:
        obj.llegada_en = now
    obj.save(update_fields=["estado", "en_camino_en", "llegada_en", "actualizado_en"])
    ctx = _agent_context(request.user)
    return Response(
        AlertaDespachoSerializer(
            obj, context={"agent_lat": ctx["agent_lat"], "agent_lng": ctx["agent_lng"]}
        ).data
    )


@api_view(["POST"])
@permission_classes([AgenteOnly])
def alerta_cerrar(request, pk):
    obj = _get_alerta_visible(request.user, pk)
    if not obj:
        return Response({"detail": "Alerta no encontrada."}, status=404)

    if obj.estado not in (
        AlertaDespacho.Estado.EN_LUGAR,
        AlertaDespacho.Estado.EN_CAMINO,
    ):
        return Response(
            {"detail": "Solo puedes cerrar alertas en curso o en el lugar."},
            status=400,
        )

    obj.estado = AlertaDespacho.Estado.CERRADA
    obj.cerrada_en = timezone.now()
    obj.save(update_fields=["estado", "cerrada_en", "actualizado_en"])
    ctx = _agent_context(request.user)
    return Response(
        AlertaDespachoSerializer(
            obj, context={"agent_lat": ctx["agent_lat"], "agent_lng": ctx["agent_lng"]}
        ).data
    )


@api_view(["GET"])
@permission_classes([AgenteOnly])
def resumen(request):
    activas = (
        _alertas_visibles_qs(request.user)
        .filter(
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ],
        )
        .count()
    )
    hoy = timezone.localdate()
    tiene_turno = AsignacionDiaria.objects.filter(
        agente=request.user, fecha=hoy, activo=True
    ).exists()
    return Response({"alertas_activas": activas, "tiene_turno_hoy": tiene_turno})
