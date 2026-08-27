from django.contrib.auth.models import User
from datetime import date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

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
from roles.supervisor_unidad.cuadrantes_geo import build_cuadrantes_for_supervisor
from roles.supervisor_unidad.scope import (
    agente_ids_en_zona,
    agentes_en_zona_qs,
    supervisor_zone_scope,
)


def _assert_agentes_en_zona(user, *, lider=None, companeros=None):
    """Valida que líder y compañeros pertenezcan a la zona del supervisor."""
    allowed = set(agentes_en_zona_qs(user).values_list("id", flat=True))
    if lider is not None and lider.id not in allowed:
        return (
            "El agente líder no pertenece a tu zona. "
            "Solo puedes asignar agentes de tu jurisdicción."
        )
    for c in companeros or []:
        if c.id not in allowed:
            return (
                f"El compañero {_user_label(c)} no pertenece a tu zona. "
                "Solo puedes asignar agentes de tu jurisdicción."
            )
    return None


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def meta(request):
    tree, labels = supervisor_zone_scope(request.user)
    agentes = [_user_label(u) for u in agentes_en_zona_qs(request.user)]
    if tree:
        zonas_qs = Jurisdiction.objects.filter(id__in=tree, activo=True)
    elif labels:
        zonas_qs = Jurisdiction.objects.filter(nombre__in=labels, activo=True)
    else:
        zonas_qs = Jurisdiction.objects.none()
    zonas = list(zonas_qs.order_by("nombre").values("id", "nombre", "tipo", "codigo"))
    return Response(
        {
            "agentes": agentes,
            "zonas": zonas,
            "zona_supervisor": labels[0] if labels else None,
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


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def cuadrantes_mapa(request):
    """Polígonos de cuadrantes centrados en la zona del supervisor (mapa Leaflet)."""
    return Response(build_cuadrantes_for_supervisor(request.user))


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
    err = _assert_agentes_en_zona(
        request.user,
        lider=ser.validated_data.get("agente_lider"),
        companeros=ser.validated_data.get("companeros") or [],
    )
    if err:
        return Response({"detail": err}, status=400)
    obj = ser.save(supervisor=request.user)
    return Response(EscuadraSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["PATCH"])
@permission_classes([SupervisorOnly])
def escuadra_detail(request, pk):
    try:
        obj = Escuadra.objects.get(pk=pk, supervisor=request.user)
    except Escuadra.DoesNotExist:
        return Response({"detail": "Escuadra no encontrada."}, status=404)

    ser = EscuadraSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    lider = ser.validated_data.get("agente_lider", obj.agente_lider)
    if "companeros" in ser.validated_data:
        companeros = ser.validated_data.get("companeros") or []
    else:
        companeros = list(obj.companeros.all())
    err = _assert_agentes_en_zona(request.user, lider=lider, companeros=companeros)
    if err:
        return Response({"detail": err}, status=400)
    obj = ser.save()
    return Response(EscuadraSerializer(obj).data)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def escuadra_inactivar(request, pk):
    try:
        obj = Escuadra.objects.get(pk=pk, supervisor=request.user)
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

    ocupado = (
        Escuadra.objects.filter(
            activo=True,
            fecha=escuadra.fecha,
            vehiculo_id=vehiculo.id,
        )
        .exclude(pk=escuadra.pk)
        .exists()
    )
    if ocupado:
        return Response(
            {
                "detail": (
                    f"El vehículo {vehiculo.placa} ya está asignado a otra escuadra "
                    f"en la fecha {escuadra.fecha}."
                )
            },
            status=400,
        )

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


def _vehiculos_ocupados_ids(fecha, *, excluir_escuadra_id=None):
    qs = Escuadra.objects.filter(activo=True, fecha=fecha, vehiculo__isnull=False)
    if excluir_escuadra_id:
        qs = qs.exclude(pk=excluir_escuadra_id)
    return set(qs.values_list("vehiculo_id", flat=True))


@api_view(["GET", "POST"])
@permission_classes([SupervisorOnly])
def vehiculos_collection(request):
    if request.method == "GET":
        qs = VehiculoFlota.objects.all()
        if request.query_params.get("activo", "1") in ("1", "true", "yes"):
            qs = qs.filter(activo=True)
        if request.query_params.get("disponibles") in ("1", "true", "yes"):
            fecha = request.query_params.get("fecha") or date.today().isoformat()
            excluir = request.query_params.get("excluir_escuadra")
            ocupados = _vehiculos_ocupados_ids(
                fecha,
                excluir_escuadra_id=int(excluir) if excluir else None,
            )
            if ocupados:
                qs = qs.exclude(pk__in=ocupados)
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
    """Asignación de sectores/rutas a escuadras (o listado legacy de asignaciones)."""
    if request.method == "GET":
        fecha = request.query_params.get("fecha")
        por_escuadra = str(request.query_params.get("por_escuadra", "")).lower() in (
            "1",
            "true",
            "yes",
        )

        if por_escuadra:
            esc_qs = Escuadra.objects.filter(
                activo=True, supervisor=request.user
            ).select_related("vehiculo", "agente_lider").prefetch_related("companeros")
            if fecha:
                esc_qs = esc_qs.filter(fecha=fecha)
            esc_qs = esc_qs.order_by("nombre")

            rows = []
            for esc in esc_qs:
                asig = (
                    AsignacionDiaria.objects.filter(
                        escuadra=esc, activo=True, fecha=esc.fecha
                    )
                    .select_related("zona")
                    .order_by("id")
                    .first()
                )
                n_miembros = 1 + esc.companeros.count()
                rows.append(
                    {
                        "id": asig.id if asig else None,
                        "escuadra": esc.id,
                        "escuadra_nombre": esc.nombre,
                        "fecha": esc.fecha.isoformat(),
                        "miembros": n_miembros,
                        "cuadrante": asig.cuadrante if asig else "",
                        "sector_detalle": asig.sector_detalle if asig else "",
                        "poligono": asig.poligono if asig else None,
                        "latitud": str(asig.latitud) if asig and asig.latitud is not None else None,
                        "longitud": str(asig.longitud) if asig and asig.longitud is not None else None,
                        "zona": asig.zona_id if asig else None,
                        "zona_nombre": asig.zona.nombre if asig and asig.zona_id else None,
                        "vehiculo_placa": (
                            (asig.vehiculo_placa if asig else None)
                            or (esc.vehiculo.placa if esc.vehiculo_id else None)
                            or "—"
                        ),
                        "tiene_sector": bool(
                            asig and (asig.cuadrante or asig.sector_detalle)
                        ),
                        "tiene_poligono": bool(asig and asig.poligono),
                    }
                )
            return Response(rows)

        qs = AsignacionDiaria.objects.filter(
            activo=True, supervisor=request.user
        ).select_related(
            "agente", "companero", "vehiculo", "zona", "escuadra", "agente__profile"
        )
        if fecha:
            qs = qs.filter(fecha=fecha)
        return Response(AsignacionDiariaWriteSerializer(qs, many=True).data)

    data = {**request.data}
    escuadra_id = data.get("escuadra")

    # —— Flujo principal: asignar sector a toda la escuadra ——
    if escuadra_id:
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

        fecha = data.get("fecha") or esc.fecha
        if str(fecha) != str(esc.fecha):
            return Response(
                {
                    "detail": (
                        f"La escuadra «{esc.nombre}» es del {esc.fecha}. "
                        "Selecciona esa fecha o crea una escuadra para el día elegido."
                    )
                },
                status=400,
            )

        cuadrante = (data.get("cuadrante") or "").strip() or "Por definir"
        sector_detalle = (data.get("sector_detalle") or "").strip()
        poligono = data.get("poligono") or None
        latitud = data.get("latitud")
        longitud = data.get("longitud")
        # Si viene polígono sin centro, calcular centroide simple
        if poligono and (latitud is None or longitud is None):
            try:
                ring = (poligono.get("coordinates") or [[]])[0]
                if ring:
                    lngs = [p[0] for p in ring[:-1] if len(p) >= 2]
                    lats = [p[1] for p in ring[:-1] if len(p) >= 2]
                    if lngs and lats:
                        longitud = round(sum(lngs) / len(lngs), 7)
                        latitud = round(sum(lats) / len(lats), 7)
            except (TypeError, AttributeError, IndexError, ZeroDivisionError):
                pass
        zona_id = data.get("zona") or None
        turno_inicio = data.get("turno_inicio") or "07:00:00"
        turno_fin = data.get("turno_fin") or "19:00:00"
        if len(str(turno_inicio)) == 5:
            turno_inicio = f"{turno_inicio}:00"
        if len(str(turno_fin)) == 5:
            turno_fin = f"{turno_fin}:00"

        vehiculo = esc.vehiculo
        placa = (vehiculo.placa if vehiculo else None) or data.get("vehiculo_placa") or "S/P"
        tipo_v = (
            vehiculo.get_tipo_display() if vehiculo else data.get("vehiculo_tipo") or "Patrulla"
        )

        miembros = [esc.agente_lider] + list(esc.companeros.all())
        if not esc.agente_lider_id:
            return Response({"detail": "La escuadra no tiene agente líder."}, status=400)

        actualizados = []
        for agente in miembros:
            otros = [m for m in miembros if m.id != agente.id]
            companero = otros[0] if otros else None
            payload = {
                "agente": agente.id,
                "companero": companero.id if companero else None,
                "fecha": fecha,
                "escuadra": esc.id,
                "vehiculo": vehiculo.id if vehiculo else None,
                "vehiculo_placa": placa,
                "vehiculo_tipo": tipo_v,
                "zona": zona_id,
                "cuadrante": cuadrante,
                "sector_detalle": sector_detalle,
                "poligono": poligono,
                "latitud": latitud,
                "longitud": longitud,
                "turno_inicio": turno_inicio,
                "turno_fin": turno_fin,
                "unidad_label": f"{esc.nombre} · {placa}",
                "activo": True,
            }
            existente = (
                AsignacionDiaria.objects.filter(
                    agente_id=agente.id, fecha=fecha, activo=True
                )
                .order_by("-id")
                .first()
            )
            if existente:
                ser = AsignacionDiariaWriteSerializer(
                    existente, data=payload, partial=True
                )
                ser.is_valid(raise_exception=True)
                obj = ser.save(supervisor=request.user, activo=True)
            else:
                ser = AsignacionDiariaWriteSerializer(data=payload)
                ser.is_valid(raise_exception=True)
                obj = ser.save(supervisor=request.user, activo=True)
            actualizados.append(obj)

        primario = next(
            (a for a in actualizados if a.agente_id == esc.agente_lider_id),
            actualizados[0],
        )
        return Response(
            {
                "detail": (
                    f"Sector asignado a «{esc.nombre}» "
                    f"({len(actualizados)} integrante(s))."
                ),
                "escuadra": esc.id,
                "escuadra_nombre": esc.nombre,
                "miembros": len(actualizados),
                "asignacion": AsignacionDiariaWriteSerializer(primario).data,
            },
            status=status.HTTP_201_CREATED,
        )

    # —— Legacy: asignación por agente individual ——
    vehiculo_id = data.get("vehiculo")
    if vehiculo_id and not data.get("vehiculo_placa"):
        try:
            v = VehiculoFlota.objects.get(pk=vehiculo_id)
            data["vehiculo_placa"] = v.placa
            data["vehiculo_tipo"] = v.get_tipo_display()
        except VehiculoFlota.DoesNotExist:
            return Response({"detail": "Vehículo no encontrado."}, status=400)

    agente_id = data.get("agente")
    fecha = data.get("fecha")
    if agente_id and agente_id not in agente_ids_en_zona(request.user):
        return Response(
            {"detail": "El agente no pertenece a tu zona."},
            status=400,
        )

    existente = None
    if agente_id and fecha:
        existente = (
            AsignacionDiaria.objects.filter(
                agente_id=agente_id, fecha=fecha, activo=True
            )
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


@api_view(["PATCH", "DELETE"])
@permission_classes([SupervisorOnly])
def asignacion_detail(request, pk):
    """Actualiza o elimina la ruta de una asignación (propaga a la escuadra)."""
    try:
        obj = AsignacionDiaria.objects.select_related("escuadra").get(
            pk=pk, supervisor=request.user, activo=True
        )
    except AsignacionDiaria.DoesNotExist:
        return Response({"detail": "Asignación no encontrada."}, status=404)

    if request.method == "DELETE":
        qs = AsignacionDiaria.objects.filter(
            supervisor=request.user,
            activo=True,
            fecha=obj.fecha,
        )
        if obj.escuadra_id:
            qs = qs.filter(escuadra_id=obj.escuadra_id)
        else:
            qs = qs.filter(pk=obj.pk)
        n = qs.update(activo=False)
        nombre = obj.escuadra.nombre if obj.escuadra_id else "asignación"
        return Response(
            {
                "detail": (
                    f"Ruta eliminada de «{nombre}» "
                    f"({n} integrante(s))."
                ),
                "eliminados": n,
            }
        )

    data = {**request.data}
    vehiculo_id = data.get("vehiculo")
    if vehiculo_id:
        try:
            v = VehiculoFlota.objects.get(pk=vehiculo_id)
            data.setdefault("vehiculo_placa", v.placa)
            data.setdefault("vehiculo_tipo", v.get_tipo_display())
        except VehiculoFlota.DoesNotExist:
            return Response({"detail": "Vehículo no encontrado."}, status=400)

    # Si viene escuadra_id en PATCH para actualizar sector de toda la escuadra
    escuadra_id = data.pop("escuadra_id", None) or (
        obj.escuadra_id if obj.escuadra_id else None
    )
    sector_fields = {
        k: data[k]
        for k in (
            "cuadrante",
            "sector_detalle",
            "poligono",
            "latitud",
            "longitud",
            "zona",
            "turno_inicio",
            "turno_fin",
        )
        if k in data
    }

    if escuadra_id and sector_fields:
        qs = AsignacionDiaria.objects.filter(
            escuadra_id=escuadra_id,
            fecha=obj.fecha,
            activo=True,
            supervisor=request.user,
        )
        updated = []
        for row in qs:
            ser = AsignacionDiariaWriteSerializer(row, data=sector_fields, partial=True)
            ser.is_valid(raise_exception=True)
            updated.append(ser.save())
        if updated:
            return Response(
                {
                    "detail": f"Sector actualizado en {len(updated)} integrante(s).",
                    "asignacion": AsignacionDiariaWriteSerializer(updated[0]).data,
                }
            )

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
