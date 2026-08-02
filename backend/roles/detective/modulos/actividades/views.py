from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import DetectiveOnly
from operativo.minio_service import upload_evidencia
from operativo.models import (
    BienInvestigado,
    BitacoraInvestigacion,
    ExpedienteCaso,
    InformeInvestigativo,
    SolicitudFiscal,
)
from operativo.serializers import (
    BienInvestigadoSerializer,
    BitacoraInvestigacionSerializer,
    ExpedienteCasoSerializer,
    InformeInvestigativoSerializer,
    SolicitudFiscalSerializer,
)


def _expedientes_qs(user):
    return ExpedienteCaso.objects.filter(detective_asignado=user)


def _get_exp(user, pk):
    return _expedientes_qs(user).get(pk=pk)


def _locked_response():
    return Response(
        {"detail": "Expediente bloqueado (Cerrado / Enviado a Fiscalía)."},
        status=status.HTTP_403_FORBIDDEN,
    )


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def meta(request):
    return Response(
        {
            "tipos_bitacora": [
                {"value": c.value, "label": c.label} for c in BitacoraInvestigacion.TipoAccion
            ],
            "tipos_bien": [
                {"value": c.value, "label": c.label} for c in BienInvestigado.TipoBien
            ],
            "tipos_solicitud": [
                {"value": c.value, "label": c.label} for c in SolicitudFiscal.TipoSolicitud
            ],
            "estados_solicitud": [
                {"value": c.value, "label": c.label} for c in SolicitudFiscal.Estado
            ],
        }
    )


@api_view(["GET", "POST"])
@permission_classes([DetectiveOnly])
def bitacora_collection(request, pk):
    try:
        exp = _get_exp(request.user, pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if request.method == "GET":
        qs = exp.bitacora.select_related("registrado_por")
        return Response(BitacoraInvestigacionSerializer(qs, many=True).data)

    if exp.bloqueado:
        return _locked_response()

    data = {**request.data, "expediente": exp.id}
    ser = BitacoraInvestigacionSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(expediente=exp, registrado_por=request.user)
    return Response(BitacoraInvestigacionSerializer(obj).data, status=201)


@api_view(["DELETE"])
@permission_classes([DetectiveOnly])
def bitacora_detail(request, pk, entry_id):
    try:
        exp = _get_exp(request.user, pk)
        obj = exp.bitacora.get(pk=entry_id)
    except (ExpedienteCaso.DoesNotExist, BitacoraInvestigacion.DoesNotExist):
        return Response({"detail": "Entrada no encontrada."}, status=404)
    if exp.bloqueado:
        return _locked_response()
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([DetectiveOnly])
def bienes_collection(request, pk):
    try:
        exp = _get_exp(request.user, pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if request.method == "GET":
        return Response(BienInvestigadoSerializer(exp.bienes.all(), many=True).data)

    if exp.bloqueado:
        return _locked_response()

    data = {**request.data, "expediente": exp.id}
    ser = BienInvestigadoSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(expediente=exp, registrado_por=request.user)
    return Response(BienInvestigadoSerializer(obj).data, status=201)


@api_view(["DELETE"])
@permission_classes([DetectiveOnly])
def bien_detail(request, pk, bien_id):
    try:
        exp = _get_exp(request.user, pk)
        obj = exp.bienes.get(pk=bien_id)
    except (ExpedienteCaso.DoesNotExist, BienInvestigado.DoesNotExist):
        return Response({"detail": "Bien no encontrado."}, status=404)
    if exp.bloqueado:
        return _locked_response()
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
@permission_classes([DetectiveOnly])
def solicitudes_collection(request, pk):
    try:
        exp = _get_exp(request.user, pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if request.method == "GET":
        qs = exp.solicitudes_fiscal.select_related("creado_por")
        return Response(SolicitudFiscalSerializer(qs, many=True).data)

    if exp.bloqueado:
        return _locked_response()

    data = {**request.data, "expediente": exp.id}
    ser = SolicitudFiscalSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(
        expediente=exp,
        creado_por=request.user,
        estado=SolicitudFiscal.Estado.BORRADOR,
    )
    obj.ensure_numero()
    if not obj.numero or obj.numero.endswith("-0"):
        obj.numero = (
            f"SF-{timezone.now().strftime('%Y%m%d')}-{exp.id}-{obj.id}"
        )
        obj.save(update_fields=["numero"])
    return Response(SolicitudFiscalSerializer(obj).data, status=201)


@api_view(["POST"])
@permission_classes([DetectiveOnly])
def solicitud_enviar(request, pk, sol_id):
    try:
        exp = _get_exp(request.user, pk)
        obj = exp.solicitudes_fiscal.get(pk=sol_id)
    except (ExpedienteCaso.DoesNotExist, SolicitudFiscal.DoesNotExist):
        return Response({"detail": "Solicitud no encontrada."}, status=404)
    if exp.bloqueado:
        return _locked_response()
    if obj.estado == SolicitudFiscal.Estado.ENVIADA:
        return Response(SolicitudFiscalSerializer(obj).data)
    obj.estado = SolicitudFiscal.Estado.ENVIADA
    obj.enviado_en = timezone.now()
    if not obj.numero:
        obj.numero = f"SF-{timezone.now().strftime('%Y%m%d')}-{exp.id}-{obj.id}"
    obj.save(update_fields=["estado", "enviado_en", "numero", "actualizado_en"])
    return Response(SolicitudFiscalSerializer(obj).data)


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def informe_get(request, pk):
    try:
        exp = _get_exp(request.user, pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)
    if not hasattr(exp, "informe_final"):
        return Response({"detail": "Sin informe final."}, status=404)
    return Response(InformeInvestigativoSerializer(exp.informe_final).data)


@api_view(["POST"])
@permission_classes([DetectiveOnly])
def cerrar_con_informe(request, pk):
    """Paso 5: Informe Investigativo Final → Cerrado / Enviado a Fiscalía + bloqueo."""
    try:
        exp = _get_exp(request.user, pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if exp.bloqueado or exp.estado == ExpedienteCaso.Estado.CERRADO:
        return Response(
            {"detail": "El expediente ya está cerrado y bloqueado."},
            status=400,
        )

    contenido = (request.data.get("contenido") or "").strip()
    if not contenido:
        return Response(
            {"detail": "Redacta el Informe Investigativo Final (contenido)."},
            status=400,
        )
    titulo = (request.data.get("titulo") or "Informe Investigativo Final").strip()
    conclusiones = (request.data.get("conclusiones") or "").strip()

    if hasattr(exp, "informe_final"):
        return Response(
            {"detail": "Ya existe un informe final para este expediente."},
            status=400,
        )

    paquete_txt = (
        f"PAQUETE DIGITAL — FISCALÍA\n"
        f"Expediente: {exp.numero_expediente}\n"
        f"Título: {exp.titulo}\n"
        f"Origen: {exp.get_origen_documento_display()}\n"
        f"Cerrado: {timezone.now().isoformat()}\n"
        f"Detective: {request.user.get_full_name() or request.user.username}\n"
        f"{'=' * 48}\n\n"
        f"{titulo}\n\n{contenido}\n\n"
        f"CONCLUSIONES\n{conclusiones or '(sin conclusiones)'}\n"
    )
    bucket = object_key = ""
    try:
        stored = upload_evidencia(
            file_bytes=paquete_txt.encode("utf-8"),
            filename=f"paquete_{exp.numero_expediente or exp.id}.txt",
            content_type="text/plain; charset=utf-8",
            folder=f"expedientes/{exp.id}/paquetes-fiscalia",
        )
        bucket = stored["bucket"]
        object_key = stored["object_key"]
    except Exception:  # noqa: BLE001
        # El cierre no falla si MinIO no está; el informe queda en BD.
        pass

    informe = InformeInvestigativo.objects.create(
        expediente=exp,
        titulo=titulo,
        contenido=contenido,
        conclusiones=conclusiones,
        elaborado_por=request.user,
        paquete_bucket=bucket,
        paquete_object_key=object_key,
    )

    exp.estado = ExpedienteCaso.Estado.CERRADO
    exp.bloqueado = True
    exp.cerrado_en = timezone.now()
    exp.save(update_fields=["estado", "bloqueado", "cerrado_en", "actualizado_en"])

    return Response(
        {
            "expediente": ExpedienteCasoSerializer(exp).data,
            "informe": InformeInvestigativoSerializer(informe).data,
        },
        status=201,
    )
