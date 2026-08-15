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
    Escuadra,
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


def _escuadras_en_turno(supervisor, hoy=None):
    hoy = hoy or date.today()
    return (
        Escuadra.objects.filter(activo=True, supervisor=supervisor, fecha=hoy)
        .select_related("agente_lider", "agente_lider__profile", "vehiculo")
        .prefetch_related("companeros", "companeros__profile")
        .order_by("nombre")
    )


def _posicion_escuadra(esc, hoy=None):
    """Coords / placa / cuadrante desde la asignación diaria de la escuadra."""
    hoy = hoy or esc.fecha
    asig = (
        AsignacionDiaria.objects.filter(escuadra=esc, fecha=hoy, activo=True)
        .order_by("id")
        .first()
    )
    if not asig:
        asig = (
            AsignacionDiaria.objects.filter(
                agente_id=esc.agente_lider_id, fecha=hoy, activo=True
            )
            .order_by("id")
            .first()
        )
    placa = (
        (asig.vehiculo_placa if asig else None)
        or (esc.vehiculo.placa if esc.vehiculo_id else None)
        or None
    )
    return {
        "latitud": asig.latitud if asig else None,
        "longitud": asig.longitud if asig else None,
        "vehiculo_placa": placa,
        "cuadrante": asig.cuadrante if asig else "",
        "unidad_label": (asig.unidad_label if asig else None) or esc.nombre,
    }


def _escuadras_ocupadas_ids(supervisor, *, excluir_alerta_id=None):
    """Escuadras con auxilio activo (no disponibles para otro incidente)."""
    qs = AlertaDespacho.objects.filter(
        estado__in=[
            AlertaDespacho.Estado.ASIGNADA,
            AlertaDespacho.Estado.EN_CAMINO,
            AlertaDespacho.Estado.EN_LUGAR,
        ],
        escuadra__isnull=False,
        escuadra__supervisor=supervisor,
    )
    if excluir_alerta_id:
        qs = qs.exclude(pk=excluir_alerta_id)
    return set(qs.values_list("escuadra_id", flat=True))


def _candidatos_escuadras(supervisor, lat=None, lng=None, hoy=None, *, excluir_alerta_id=None):
    """Escuadras disponibles (sin auxilio activo), ordenadas por distancia."""
    hoy = hoy or date.today()
    ocupadas = _escuadras_ocupadas_ids(supervisor, excluir_alerta_id=excluir_alerta_id)
    items = []
    for esc in _escuadras_en_turno(supervisor, hoy):
        if esc.id in ocupadas:
            continue
        pos = _posicion_escuadra(esc, hoy)
        dist = None
        if (
            lat is not None
            and lng is not None
            and pos["latitud"] is not None
            and pos["longitud"] is not None
        ):
            try:
                dist = round(
                    _haversine_km(lat, lng, pos["latitud"], pos["longitud"]), 2
                )
            except (TypeError, ValueError):
                dist = None
        n_miembros = 1 + esc.companeros.count()
        items.append(
            {
                "escuadra_id": esc.id,
                "escuadra_nombre": esc.nombre,
                "lider": _user_label(esc.agente_lider),
                "miembros": n_miembros,
                "unidad_label": pos["unidad_label"],
                "vehiculo_placa": pos["vehiculo_placa"],
                "cuadrante": pos["cuadrante"],
                "latitud": pos["latitud"],
                "longitud": pos["longitud"],
                "distancia_km": dist,
                "disponible": True,
            }
        )
    items.sort(
        key=lambda x: (
            x["distancia_km"] is None,
            x["distancia_km"] if x["distancia_km"] is not None else 9999,
        )
    )
    return items


def _miembros_escuadra(esc):
    miembros = [esc.agente_lider]
    miembros.extend(list(esc.companeros.all()))
    # únicos por id
    seen = set()
    out = []
    for u in miembros:
        if u and u.id not in seen:
            seen.add(u.id)
            out.append(u)
    return out


def _notify_escuadra(esc, *, titulo, mensaje, enlace):
    for user in _miembros_escuadra(esc):
        notify_user(
            user=user,
            tipo=Notificacion.Tipo.ALERTA,
            titulo=titulo,
            mensaje=mensaje,
            enlace=enlace,
        )


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def meta(request):
    lat = request.query_params.get("lat")
    lng = request.query_params.get("lng")
    if lat not in (None, "") and lng not in (None, ""):
        candidatos = _candidatos_escuadras(request.user, lat, lng)
    else:
        candidatos = _candidatos_escuadras(request.user)

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
            "escuadras_turno": candidatos,
            # alias legacy (ahora son escuadras)
            "unidades_turno": candidatos,
            "agentes": agentes,
            "prioridades": [
                {"value": c.value, "label": c.label} for c in AlertaDespacho.Prioridad
            ],
            "tipos_orden": [
                {"value": c.value, "label": c.label} for c in OrdenAdicional.Tipo
            ],
            "estados_orden": [
                {"value": c.value, "label": c.label} for c in OrdenAdicional.Estado
            ],
            "origenes": ["ECU-911", "Central ciudadana", "Radio", "Presencial"],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def alertas_collection(request):
    if request.method == "GET":
        qs = AlertaDespacho.objects.select_related(
            "agente", "agente__profile", "asignada_por", "escuadra"
        )
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
    escuadra = ser.validated_data.get("escuadra")
    estado = (
        AlertaDespacho.Estado.ASIGNADA
        if (agente or escuadra)
        else AlertaDespacho.Estado.PENDIENTE
    )
    obj = ser.save(
        asignada_por=request.user,
        estado=estado,
        origen=ser.validated_data.get("origen") or "ECU-911",
    )
    if escuadra:
        if not obj.agente_id and escuadra.agente_lider_id:
            obj.agente = escuadra.agente_lider
            obj.save(update_fields=["agente"])
        _notify_escuadra(
            escuadra,
            titulo="Nueva alerta asignada",
            mensaje=f"{obj.titulo} · {obj.direccion}",
            enlace="/app/agente_operativo/despacho_tareas/alertas",
        )
    elif agente:
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
    return Response(
        {
            "sugerencias": _candidatos_escuadras(
                request.user,
                obj.latitud,
                obj.longitud,
                excluir_alerta_id=obj.id,
            )
        }
    )


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

    escuadra_id = request.data.get("escuadra")
    # compat: si mandan agente, resolver escuadra del día
    agente_id = request.data.get("agente")
    auto = str(request.data.get("auto_cercano", "")).lower() in ("1", "true", "yes")

    if auto or not escuadra_id:
        if not escuadra_id and agente_id:
            asig = (
                AsignacionDiaria.objects.filter(
                    agente_id=agente_id,
                    fecha=date.today(),
                    activo=True,
                    escuadra__isnull=False,
                )
                .order_by("-id")
                .first()
            )
            if asig:
                escuadra_id = asig.escuadra_id
        if not escuadra_id:
            cands = _candidatos_escuadras(
                request.user,
                obj.latitud,
                obj.longitud,
                excluir_alerta_id=obj.id,
            )
            with_dist = [c for c in cands if c["distancia_km"] is not None]
            pool = with_dist or cands
            if not pool:
                return Response(
                    {
                        "detail": (
                            "No hay escuadras disponibles. "
                            "Todas están en un auxilio activo o no hay turno hoy."
                        )
                    },
                    status=400,
                )
            escuadra_id = pool[0]["escuadra_id"]

    try:
        esc = (
            Escuadra.objects.select_related("agente_lider", "vehiculo")
            .prefetch_related("companeros")
            .get(pk=escuadra_id, supervisor=request.user, activo=True)
        )
    except Escuadra.DoesNotExist:
        return Response(
            {"detail": "Escuadra no encontrada o no pertenece a tu zona."},
            status=404,
        )

    ocupadas = _escuadras_ocupadas_ids(request.user, excluir_alerta_id=obj.id)
    if esc.id in ocupadas:
        return Response(
            {
                "detail": (
                    f"La escuadra «{esc.nombre}» ya está asignada a otro "
                    "incidente activo. Elige una disponible."
                )
            },
            status=400,
        )
    if not esc.agente_lider_id:
        return Response({"detail": "La escuadra no tiene agente líder."}, status=400)

    pos = _posicion_escuadra(esc)
    dist = None
    if (
        pos["latitud"] is not None
        and obj.latitud is not None
        and obj.longitud is not None
    ):
        try:
            dist = round(
                _haversine_km(obj.latitud, obj.longitud, pos["latitud"], pos["longitud"]),
                2,
            )
        except (TypeError, ValueError):
            dist = None

    obj.escuadra = esc
    obj.agente = esc.agente_lider
    obj.estado = AlertaDespacho.Estado.ASIGNADA
    obj.asignada_por = request.user
    obj.save(
        update_fields=["escuadra", "agente", "estado", "asignada_por", "actualizado_en"]
    )

    _notify_escuadra(
        esc,
        titulo="Auxilio asignado",
        mensaje=f"{obj.titulo} · {obj.direccion}"
        + (f" (~{dist} km)" if dist is not None else ""),
        enlace="/app/agente_operativo/despacho_tareas/alertas",
    )

    payload = AlertaDespachoWriteSerializer(obj).data
    payload["distancia_km"] = dist
    payload["escuadra_nombre"] = esc.nombre
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
