from datetime import date
from math import asin, cos, radians, sin, sqrt

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import SystemRole
from accounts.permissions import SupervisorOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    Notificacion,
    OrdenAdicional,
)
from operativo.notifications import notify_user
from operativo.serializers import (
    AlertaDespachoWriteSerializer,
    OrdenAdicionalSerializer,
    _user_label,
)


def _haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _agentes_en_turno(hoy=None):
    hoy = hoy or date.today()
    return (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .select_related("agente", "agente__profile", "vehiculo")
        .order_by("agente__first_name")
    )


def _candidatos_cercanos(lat, lng, hoy=None):
    """Lista de unidades en turno ordenadas por distancia al incidente."""
    items = []
    for a in _agentes_en_turno(hoy):
        dist = None
        if lat is not None and lng is not None and a.latitud is not None and a.longitud is not None:
            try:
                dist = round(_haversine_km(lat, lng, a.latitud, a.longitud), 2)
            except (TypeError, ValueError):
                dist = None
        items.append(
            {
                "asignacion_id": a.id,
                "agente": _user_label(a.agente),
                "unidad_label": a.unidad_label,
                "vehiculo_placa": a.vehiculo_placa,
                "cuadrante": a.cuadrante,
                "latitud": a.latitud,
                "longitud": a.longitud,
                "distancia_km": dist,
            }
        )
    items.sort(
        key=lambda x: (
            x["distancia_km"] is None,
            x["distancia_km"] if x["distancia_km"] is not None else 9999,
        )
    )
    return items


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def meta(request):
    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    if lat not in (None, "") and lng not in (None, ""):
        candidatos = _candidatos_cercanos(lat, lng)
    else:
        candidatos = []
        for a in _agentes_en_turno():
            candidatos.append(
                {
                    "asignacion_id": a.id,
                    "agente": _user_label(a.agente),
                    "unidad_label": a.unidad_label,
                    "vehiculo_placa": a.vehiculo_placa,
                    "cuadrante": a.cuadrante,
                    "latitud": a.latitud,
                    "longitud": a.longitud,
                    "distancia_km": None,
                }
            )

    agentes = [
        _user_label(u)
        for u in User.objects.filter(
            profile__role=SystemRole.AGENTE_OPERATIVO,
            profile__estado="ACTIVO",
            is_active=True,
        )
        .select_related("profile")
        .order_by("first_name", "last_name")
    ]

    return Response(
        {
            "unidades_turno": candidatos,
            "agentes": agentes,
            "prioridades": [{"value": c.value, "label": c.label} for c in AlertaDespacho.Prioridad],
            "tipos_orden": [{"value": c.value, "label": c.label} for c in OrdenAdicional.Tipo],
            "estados_orden": [{"value": c.value, "label": c.label} for c in OrdenAdicional.Estado],
            "origenes": ["ECU-911", "Central ciudadana", "Radio", "Presencial"],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def alertas_collection(request):
    if request.method == "GET":
        qs = AlertaDespacho.objects.select_related("agente", "agente__profile", "asignada_por")
        estado = request.query_params.get("estado", "pendientes")
        if estado == "pendientes":
            qs = qs.filter(estado=AlertaDespacho.Estado.PENDIENTE)
        elif estado == "activas":
            qs = qs.filter(
                estado__in=[
                    AlertaDespacho.Estado.ASIGNADA,
                    AlertaDespacho.Estado.EN_CAMINO,
                    AlertaDespacho.Estado.EN_LUGAR,
                ]
            )
        elif estado == "cerradas":
            qs = qs.filter(
                estado__in=[AlertaDespacho.Estado.CERRADA, AlertaDespacho.Estado.CANCELADA]
            )
        data = AlertaDespachoWriteSerializer(qs[:100], many=True).data
        return Response(data)

    ser = AlertaDespachoWriteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    agente = ser.validated_data.get("agente")
    estado = (
        AlertaDespacho.Estado.ASIGNADA
        if agente
        else AlertaDespacho.Estado.PENDIENTE
    )
    obj = ser.save(
        asignada_por=request.user,
        estado=estado,
        origen=ser.validated_data.get("origen") or "ECU-911",
    )
    if agente:
        notify_user(
            user=agente,
            tipo=Notificacion.Tipo.ALERTA,
            titulo="Nueva alerta asignada",
            mensaje=f"{obj.titulo} · {obj.direccion}",
            enlace="/app/agente_operativo/despacho_tareas/alertas",
        )
    return Response(AlertaDespachoWriteSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def alerta_sugerencias(request, pk):
    try:
        obj = AlertaDespacho.objects.get(pk=pk)
    except AlertaDespacho.DoesNotExist:
        return Response({"detail": "Alerta no encontrada."}, status=404)
    return Response({"sugerencias": _candidatos_cercanos(obj.latitud, obj.longitud)})


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def alerta_asignar(request, pk):
    try:
        obj = AlertaDespacho.objects.get(pk=pk)
    except AlertaDespacho.DoesNotExist:
        return Response({"detail": "Alerta no encontrada."}, status=404)

    if obj.estado not in (
        AlertaDespacho.Estado.PENDIENTE,
        AlertaDespacho.Estado.ASIGNADA,
    ):
        return Response(
            {"detail": "Solo se pueden (re)asignar alertas pendientes o recién asignadas."},
            status=400,
        )

    agente_id = request.data.get("agente")
    auto = str(request.data.get("auto_cercano", "")).lower() in ("1", "true", "yes")

    if auto or not agente_id:
        cands = [c for c in _candidatos_cercanos(obj.latitud, obj.longitud) if c.get("agente")]
        with_dist = [c for c in cands if c["distancia_km"] is not None]
        pool = with_dist or cands
        if not pool:
            return Response(
                {"detail": "No hay unidades en turno para asignar."},
                status=400,
            )
        agente_id = pool[0]["agente"]["id"]

    try:
        agente = User.objects.get(pk=agente_id)
    except User.DoesNotExist:
        return Response({"detail": "Agente no encontrado."}, status=404)

    dist = None
    asig = (
        AsignacionDiaria.objects.filter(agente=agente, fecha=date.today(), activo=True)
        .order_by("-id")
        .first()
    )
    if asig and asig.latitud and obj.latitud and obj.longitud:
        dist = round(_haversine_km(obj.latitud, obj.longitud, asig.latitud, asig.longitud), 2)

    obj.agente = agente
    obj.estado = AlertaDespacho.Estado.ASIGNADA
    obj.asignada_por = request.user
    obj.save(update_fields=["agente", "estado", "asignada_por", "actualizado_en"])

    notify_user(
        user=agente,
        tipo=Notificacion.Tipo.ALERTA,
        titulo="Auxilio asignado",
        mensaje=f"{obj.titulo} · {obj.direccion}"
        + (f" (~{dist} km)" if dist is not None else ""),
        enlace="/app/agente_operativo/despacho_tareas/alertas",
    )

    payload = AlertaDespachoWriteSerializer(obj).data
    payload["distancia_km"] = dist
    return Response(payload)


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def ordenes_collection(request):
    if request.method == "GET":
        qs = OrdenAdicional.objects.select_related(
            "agente", "agente__profile", "asignada_por"
        )
        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        return Response(OrdenAdicionalSerializer(qs[:100], many=True).data)

    ser = OrdenAdicionalSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(
        asignada_por=request.user,
        estado=OrdenAdicional.Estado.ASIGNADA,
    )
    notify_user(
        user=obj.agente,
        tipo=Notificacion.Tipo.SISTEMA,
        titulo="Nueva orden operativa",
        mensaje=f"{obj.get_tipo_display()}: {obj.titulo}",
        enlace="/app/agente_operativo/dashboard",
    )
    return Response(OrdenAdicionalSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def orden_decidir(request, pk):
    accion = (request.data.get("accion") or "").upper()
    try:
        obj = OrdenAdicional.objects.select_related("agente").get(pk=pk)
    except OrdenAdicional.DoesNotExist:
        return Response({"detail": "Orden no encontrada."}, status=404)

    if accion == "COMPLETAR":
        obj.estado = OrdenAdicional.Estado.COMPLETADA
        obj.completada_en = timezone.now()
        obj.save(update_fields=["estado", "completada_en", "actualizado_en"])
    elif accion == "CANCELAR":
        obj.estado = OrdenAdicional.Estado.CANCELADA
        obj.save(update_fields=["estado", "actualizado_en"])
    elif accion == "EN_CURSO":
        obj.estado = OrdenAdicional.Estado.EN_CURSO
        obj.save(update_fields=["estado", "actualizado_en"])
    else:
        return Response({"detail": "Acción inválida."}, status=400)

    return Response(OrdenAdicionalSerializer(obj).data)
