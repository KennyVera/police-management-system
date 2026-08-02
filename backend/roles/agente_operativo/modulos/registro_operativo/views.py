from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import AgenteOnly
from catalogos.models import TipoDelito
from operativo.minio_service import upload_evidencia
from operativo.models import AlertaDespacho, MultimediaEvidencia, NovedadIncidente, ParteAprehension
from operativo.pdf_service import build_pdf_bytes
from operativo.serializers import (
    MultimediaEvidenciaSerializer,
    NovedadIncidenteSerializer,
    ParteAprehensionSerializer,
    TipoDelitoMiniSerializer,
)


@api_view(["GET"])
@permission_classes([AgenteOnly])
def meta(request):
    delitos = TipoDelito.objects.filter(activo=True).order_by("nombre")
    return Response(
        {
            "tipos_delito": TipoDelitoMiniSerializer(delitos, many=True).data,
            "tipos_novedad": [
                {"value": c.value, "label": c.label} for c in NovedadIncidente.TipoNovedad
            ],
            "origenes_multimedia": [
                {"value": c.value, "label": c.label} for c in MultimediaEvidencia.Origen
            ],
            "prioridades": [
                {"value": c.value, "label": c.label} for c in ParteAprehension.Prioridad
            ],
            "niveles_riesgo": [
                {"value": c.value, "label": c.label} for c in ParteAprehension.NivelRiesgo
            ],
            "fuentes_reporte": [
                {"value": c.value, "label": c.label} for c in ParteAprehension.FuenteReporte
            ],
            "si_no": [{"value": c.value, "label": c.label} for c in ParteAprehension.SiNo],
            "oficial": {
                "nombre": f"{request.user.first_name} {request.user.last_name}".strip()
                or request.user.username
            },
        }
    )


@api_view(["GET", "POST"])
@permission_classes([AgenteOnly])
def partes_collection(request):
    if request.method == "GET":
        qs = ParteAprehension.objects.filter(creado_por=request.user).select_related(
            "tipo_delito", "creado_por", "alerta"
        )
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(detenido_nombres__icontains=q)
                | Q(detenido_apellidos__icontains=q)
                | Q(detenido_cedula__icontains=q)
                | Q(lugar__icontains=q)
                | Q(numero_caso__icontains=q)
                | Q(titulo__icontains=q)
            )
        return Response(ParteAprehensionSerializer(qs, many=True).data)

    # Alta solo vinculada a una alerta en el lugar
    alerta_id = request.data.get("alerta")
    if not alerta_id:
        return Response(
            {
                "detail": "El parte solo se crea desde una alerta. Debes llegar al lugar del incidente."
            },
            status=400,
        )
    try:
        alerta = AlertaDespacho.objects.get(pk=alerta_id, agente=request.user)
    except AlertaDespacho.DoesNotExist:
        return Response({"detail": "Alerta no encontrada."}, status=404)

    if alerta.estado != AlertaDespacho.Estado.EN_LUGAR:
        return Response(
            {
                "detail": "Solo puedes abrir el parte cuando marques Llegada al lugar en la alerta."
            },
            status=400,
        )

    existente = alerta.partes.filter(
        estado_revision=ParteAprehension.EstadoRevision.BORRADOR
    ).first()
    if existente:
        return Response(ParteAprehensionSerializer(existente).data)

    data = {**request.data, "alerta": alerta.id, "lugar": request.data.get("lugar") or alerta.direccion}
    serializer = ParteAprehensionSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save(
        creado_por=request.user,
        alerta=alerta,
        estado_revision=ParteAprehension.EstadoRevision.BORRADOR,
    )
    return Response(ParteAprehensionSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AgenteOnly])
def parte_detail(request, pk):
    try:
        obj = ParteAprehension.objects.select_related(
            "tipo_delito", "creado_por", "alerta"
        ).get(pk=pk, creado_por=request.user)
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if request.method == "GET":
        return Response(ParteAprehensionSerializer(obj).data)

    if obj.estado_revision not in (
        ParteAprehension.EstadoRevision.BORRADOR,
        ParteAprehension.EstadoRevision.OBSERVADO,
    ):
        return Response(
            {"detail": "Solo se pueden editar partes en borrador o rechazados."},
            status=400,
        )

    if obj.bloqueado:
        return Response({"detail": "Este parte está bloqueado (aprobado)."}, status=400)

    serializer = ParteAprehensionSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(ParteAprehensionSerializer(obj).data)


@api_view(["GET"])
@permission_classes([AgenteOnly])
def parte_pdf(request, pk):
    """Ver o descargar el PDF del parte (solo los del propio agente)."""
    try:
        obj = (
            ParteAprehension.objects.select_related(
                "tipo_delito", "creado_por", "alerta", "revisado_por"
            )
            .prefetch_related("multimedia")
            .get(pk=pk, creado_por=request.user)
        )
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if obj.estado_revision != ParteAprehension.EstadoRevision.APROBADO and not obj.pdf_object_key:
        return Response(
            {"detail": "El PDF está disponible cuando el parte es aprobado."},
            status=400,
        )

    try:
        # Siempre se regenera para incluir evidencias iniciales embebidas.
        pdf_bytes = build_pdf_bytes(obj)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo obtener el PDF: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    filename = f"{obj.numero_caso or f'parte-{obj.id}'}.pdf"
    download = str(request.query_params.get("download", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    disposition = "attachment" if download else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    response["Content-Length"] = str(len(pdf_bytes))
    return response


@api_view(["POST"])
@permission_classes([AgenteOnly])
def parte_enviar_revision(request, pk):
    try:
        obj = ParteAprehension.objects.select_related("alerta").get(
            pk=pk, creado_por=request.user
        )
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if obj.bloqueado or obj.estado_revision == ParteAprehension.EstadoRevision.APROBADO:
        return Response({"detail": "Este parte ya fue aprobado y está bloqueado."}, status=400)

    if obj.estado_revision not in (
        ParteAprehension.EstadoRevision.BORRADOR,
        ParteAprehension.EstadoRevision.OBSERVADO,
    ):
        return Response(
            {"detail": "Solo puedes enviar borradores o partes rechazados corregidos."},
            status=400,
        )

    obj.estado_revision = ParteAprehension.EstadoRevision.EN_REVISION
    obj.enviado_revision_en = timezone.now()
    obj.motivo_rechazo = ""
    obj.save(
        update_fields=[
            "estado_revision",
            "enviado_revision_en",
            "motivo_rechazo",
            "actualizado_en",
        ]
    )

    if obj.alerta_id and obj.alerta.estado == AlertaDespacho.Estado.EN_LUGAR:
        obj.alerta.estado = AlertaDespacho.Estado.CERRADA
        obj.alerta.cerrada_en = timezone.now()
        obj.alerta.save(update_fields=["estado", "cerrada_en", "actualizado_en"])

    return Response(ParteAprehensionSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([AgenteOnly])
def novedades_collection(request):
    if request.method == "GET":
        qs = NovedadIncidente.objects.filter(creado_por=request.user).select_related(
            "creado_por"
        )
        tipo = request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(Q(lugar__icontains=q) | Q(descripcion__icontains=q))
        return Response(NovedadIncidenteSerializer(qs, many=True).data)

    serializer = NovedadIncidenteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save(creado_por=request.user)
    return Response(NovedadIncidenteSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AgenteOnly])
def novedad_detail(request, pk):
    try:
        obj = NovedadIncidente.objects.select_related("creado_por").get(
            pk=pk, creado_por=request.user
        )
    except NovedadIncidente.DoesNotExist:
        return Response({"detail": "Novedad no encontrada."}, status=404)

    if request.method == "GET":
        return Response(NovedadIncidenteSerializer(obj).data)

    serializer = NovedadIncidenteSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(NovedadIncidenteSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([AgenteOnly])
@parser_classes([MultiPartParser, FormParser])
def multimedia_collection(request):
    if request.method == "GET":
        qs = MultimediaEvidencia.objects.filter(subido_por=request.user).select_related(
            "subido_por"
        )
        origen = request.query_params.get("origen")
        if origen:
            qs = qs.filter(origen=origen)
        return Response(MultimediaEvidenciaSerializer(qs, many=True).data)

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"detail": "Debe adjuntar un archivo (campo 'archivo')."}, status=400)

    origen = request.data.get("origen") or MultimediaEvidencia.Origen.RAPIDA
    descripcion = request.data.get("descripcion", "")
    parte_id = request.data.get("parte") or None
    novedad_id = request.data.get("novedad") or None

    parte = None
    novedad = None
    if parte_id:
        try:
            parte = ParteAprehension.objects.get(pk=parte_id, creado_por=request.user)
            origen = MultimediaEvidencia.Origen.PARTE
        except ParteAprehension.DoesNotExist:
            return Response({"detail": "Parte vinculado no encontrado."}, status=400)
    if novedad_id:
        try:
            novedad = NovedadIncidente.objects.get(pk=novedad_id, creado_por=request.user)
            origen = MultimediaEvidencia.Origen.NOVEDAD
        except NovedadIncidente.DoesNotExist:
            return Response({"detail": "Novedad vinculada no encontrada."}, status=400)

    folder = {
        MultimediaEvidencia.Origen.PARTE: "partes",
        MultimediaEvidencia.Origen.NOVEDAD: "novedades",
        MultimediaEvidencia.Origen.RAPIDA: "captura-rapida",
    }.get(origen, "captura-rapida")

    try:
        stored = upload_evidencia(
            file_bytes=archivo.read(),
            filename=archivo.name,
            content_type=archivo.content_type or "application/octet-stream",
            folder=folder,
        )
    except Exception as exc:  # noqa: BLE001 — error de MinIO al agente
        return Response(
            {"detail": f"No se pudo subir a MinIO: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    obj = MultimediaEvidencia.objects.create(
        subido_por=request.user,
        origen=origen,
        parte=parte,
        novedad=novedad,
        descripcion=descripcion,
        nombre_archivo=stored["nombre_archivo"],
        content_type=stored["content_type"],
        tamanio_bytes=stored["tamanio_bytes"],
        bucket=stored["bucket"],
        object_key=stored["object_key"],
    )
    return Response(MultimediaEvidenciaSerializer(obj).data, status=status.HTTP_201_CREATED)
