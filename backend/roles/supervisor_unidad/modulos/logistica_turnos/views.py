from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import SystemRole
from accounts.permissions import SupervisorOnly
from operativo.models import AsignacionDiaria, Escuadra, GestionHorario, Notificacion, VehiculoFlota
from operativo.notifications import notify_user
from operativo.serializers import (
    AsignacionDiariaWriteSerializer,
    EscuadraSerializer,
    GestionHorarioSerializer,
    VehiculoFlotaSerializer,
    _user_label,
)
from organizacion.models import Jurisdiction


def _agentes_qs():
    return User.objects.filter(
        profile__role=SystemRole.AGENTE_OPERATIVO,
        profile__estado="ACTIVO",
        is_active=True,
    ).select_related("profile").order_by("first_name", "last_name")


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def meta(request):
    agentes = [_user_label(u) for u in _agentes_qs()]
    zonas = list(
        Jurisdiction.objects.filter(activo=True).order_by("nombre").values("id", "nombre", "tipo", "codigo")
    )
    return Response(
        {
            "agentes": agentes,
            "zonas": zonas,
            "tipos_vehiculo": [
                {"value": c.value, "label": c.label} for c in VehiculoFlota.TipoVehiculo
            ],
            "tipos_horario": [
                {"value": c.value, "label": c.label} for c in GestionHorario.Tipo
            ],
            "estados_horario": [
                {"value": c.value, "label": c.label} for c in GestionHorario.Estado
            ],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def escuadras_collection(request):
    if request.method == "GET":
        qs = (
            Escuadra.objects.filter(activo=True, supervisor=request.user)
            .select_related(
                "agente_lider", "supervisor", "agente_lider__profile", "vehiculo"
            )
            .prefetch_related("companeros", "companeros__profile")
            .order_by("nombre")
        )
        fecha = request.query_params.get("fecha")
        if fecha:
            qs = qs.filter(fecha=fecha)
        return Response(EscuadraSerializer(qs, many=True).data)

    ser = EscuadraSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(supervisor=request.user)
    return Response(EscuadraSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([SupervisorOnly])
def escuadra_detail(request, pk):
    try:
        obj = Escuadra.objects.get(pk=pk)
    except Escuadra.DoesNotExist:
        return Response({"detail": "Escuadra no encontrada."}, status=404)

    ser = EscuadraSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(EscuadraSerializer(obj).data)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def escuadra_inactivar(request, pk):
    try:
        obj = Escuadra.objects.get(pk=pk)
    except Escuadra.DoesNotExist:
        return Response({"detail": "Escuadra no encontrada."}, status=404)
    obj.activo = False
    obj.save(update_fields=["activo", "actualizado_en"])
    return Response(EscuadraSerializer(obj).data)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def escuadra_asignar_vehiculo(request, pk):
    """Asigna un vehículo a la escuadra y sincroniza la asignación diaria del líder."""
    try:
        escuadra = Escuadra.objects.select_related("agente_lider", "vehiculo").prefetch_related(
            "companeros"
        ).get(pk=pk)
    except Escuadra.DoesNotExist:
        return Response({"detail": "Escuadra no encontrada."}, status=404)

    vehiculo_id = request.data.get("vehiculo")
    if not vehiculo_id:
        return Response({"detail": "Debes indicar el vehículo."}, status=400)
    try:
        vehiculo = VehiculoFlota.objects.get(pk=vehiculo_id, activo=True)
    except VehiculoFlota.DoesNotExist:
        return Response({"detail": "Vehículo no encontrado."}, status=404)

    turno_inicio = request.data.get("turno_inicio") or "07:00:00"
    turno_fin = request.data.get("turno_fin") or "19:00:00"
    if len(str(turno_inicio)) == 5:
        turno_inicio = f"{turno_inicio}:00"
    if len(str(turno_fin)) == 5:
        turno_fin = f"{turno_fin}:00"

    escuadra.vehiculo = vehiculo
    escuadra.save(update_fields=["vehiculo", "actualizado_en"])

    companero = escuadra.companeros.first()
    payload = {
        "agente": escuadra.agente_lider_id,
        "companero": companero.id if companero else None,
        "fecha": escuadra.fecha,
        "escuadra": escuadra.id,
        "vehiculo": vehiculo.id,
        "vehiculo_placa": vehiculo.placa,
        "vehiculo_tipo": vehiculo.get_tipo_display(),
        "cuadrante": request.data.get("cuadrante") or "Por definir",
        "turno_inicio": turno_inicio,
        "turno_fin": turno_fin,
        "unidad_label": f"Unidad {vehiculo.placa}",
        "activo": True,
    }
    existente = (
        AsignacionDiaria.objects.filter(
            agente_id=escuadra.agente_lider_id, fecha=escuadra.fecha, activo=True
        )
        .order_by("-id")
        .first()
    )
    if existente:
        ser = AsignacionDiariaWriteSerializer(existente, data=payload, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save(supervisor=request.user, activo=True)
    else:
        ser = AsignacionDiariaWriteSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        ser.save(supervisor=request.user, activo=True)

    escuadra = Escuadra.objects.select_related(
        "agente_lider", "supervisor", "vehiculo", "agente_lider__profile"
    ).prefetch_related("companeros").get(pk=escuadra.pk)
    return Response(EscuadraSerializer(escuadra).data)


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def vehiculos_collection(request):
    if request.method == "GET":
        qs = VehiculoFlota.objects.all()
        if request.query_params.get("activo", "1") in ("1", "true", "yes"):
            qs = qs.filter(activo=True)
        return Response(VehiculoFlotaSerializer(qs, many=True).data)

    ser = VehiculoFlotaSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(VehiculoFlotaSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([SupervisorOnly])
def vehiculo_detail(request, pk):
    try:
        obj = VehiculoFlota.objects.get(pk=pk)
    except VehiculoFlota.DoesNotExist:
        return Response({"detail": "Vehículo no encontrado."}, status=404)
    ser = VehiculoFlotaSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(VehiculoFlotaSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def asignaciones_collection(request):
    """Asignación de vehículos y/o sectores a patrullas del día."""
    if request.method == "GET":
        qs = AsignacionDiaria.objects.filter(activo=True).select_related(
            "agente", "companero", "vehiculo", "zona", "escuadra", "agente__profile"
        )
        fecha = request.query_params.get("fecha")
        if fecha:
            qs = qs.filter(fecha=fecha)
        return Response(AsignacionDiariaWriteSerializer(qs, many=True).data)

    data = {**request.data}
    vehiculo_id = data.get("vehiculo")
    if vehiculo_id and not data.get("vehiculo_placa"):
        try:
            v = VehiculoFlota.objects.get(pk=vehiculo_id)
            data["vehiculo_placa"] = v.placa
            data["vehiculo_tipo"] = v.get_tipo_display()
        except VehiculoFlota.DoesNotExist:
            return Response({"detail": "Vehículo no encontrado."}, status=400)

    # Si ya hay asignación activa del agente ese día, se actualiza (vehículo + sector).
    agente_id = data.get("agente")
    fecha = data.get("fecha")
    existente = None
    if agente_id and fecha:
        existente = (
            AsignacionDiaria.objects.filter(agente_id=agente_id, fecha=fecha, activo=True)
            .order_by("-id")
            .first()
        )

    if existente:
        ser = AsignacionDiariaWriteSerializer(existente, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save(supervisor=request.user, activo=True)
        return Response(AsignacionDiariaWriteSerializer(obj).data)

    ser = AsignacionDiariaWriteSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(supervisor=request.user, activo=True)
    return Response(AsignacionDiariaWriteSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([SupervisorOnly])
def asignacion_detail(request, pk):
    try:
        obj = AsignacionDiaria.objects.get(pk=pk)
    except AsignacionDiaria.DoesNotExist:
        return Response({"detail": "Asignación no encontrada."}, status=404)

    data = {**request.data}
    vehiculo_id = data.get("vehiculo")
    if vehiculo_id:
        try:
            v = VehiculoFlota.objects.get(pk=vehiculo_id)
            data.setdefault("vehiculo_placa", v.placa)
            data.setdefault("vehiculo_tipo", v.get_tipo_display())
        except VehiculoFlota.DoesNotExist:
            return Response({"detail": "Vehículo no encontrado."}, status=400)

    ser = AsignacionDiariaWriteSerializer(obj, data=data, partial=True)
    ser.is_valid(raise_exception=True)
    obj = ser.save()
    return Response(AsignacionDiariaWriteSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def horarios_collection(request):
    if request.method == "GET":
        qs = GestionHorario.objects.select_related("agente", "supervisor", "agente__profile")
        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        fecha = request.query_params.get("fecha")
        if fecha:
            qs = qs.filter(fecha=fecha)
        return Response(GestionHorarioSerializer(qs, many=True).data)

    ser = GestionHorarioSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(supervisor=request.user)
    return Response(GestionHorarioSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def horario_decidir(request, pk):
    accion = (request.data.get("accion") or "").upper()
    respuesta = (request.data.get("respuesta") or "").strip()
    try:
        obj = GestionHorario.objects.select_related("agente").get(pk=pk)
    except GestionHorario.DoesNotExist:
        return Response({"detail": "Registro no encontrado."}, status=404)

    if obj.estado != GestionHorario.Estado.PENDIENTE:
        return Response({"detail": "Este registro ya fue resuelto."}, status=400)

    if accion == "APROBAR":
        obj.estado = GestionHorario.Estado.APROBADO
    elif accion == "RECHAZAR":
        obj.estado = GestionHorario.Estado.RECHAZADO
    else:
        return Response({"detail": "Acción inválida (APROBAR|RECHAZAR)."}, status=400)

    obj.respuesta = respuesta
    obj.supervisor = request.user
    obj.save(update_fields=["estado", "respuesta", "supervisor", "actualizado_en"])

    notify_user(
        user=obj.agente,
        tipo=Notificacion.Tipo.SISTEMA,
        titulo=f"Horario {obj.get_estado_display().lower()}",
        mensaje=respuesta
        or f"Tu solicitud de {obj.get_tipo_display()} fue {obj.get_estado_display().lower()}.",
        enlace="/app/agente_operativo/dashboard",
    )
    return Response(GestionHorarioSerializer(obj).data)
