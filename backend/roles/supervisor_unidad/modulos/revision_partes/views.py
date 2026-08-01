from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import Notificacion, ParteAprehension
from operativo.notifications import notify_user
from operativo.pdf_service import generar_pdf_parte
from operativo.serializers import ParteAprehensionSerializer


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def partes_pendientes(request):
    qs = (
        ParteAprehension.objects.filter(
            estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
        )
        .select_related("tipo_delito", "creado_por", "alerta")
        .order_by("enviado_revision_en")
    )
    return Response(ParteAprehensionSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def partes_historial(request):
    qs = (
        ParteAprehension.objects.filter(
            estado_revision__in=[
                ParteAprehension.EstadoRevision.APROBADO,
                ParteAprehension.EstadoRevision.OBSERVADO,
            ]
        )
        .select_related("tipo_delito", "creado_por", "alerta", "revisado_por")
        .order_by("-actualizado_en")[:100]
    )
    return Response(ParteAprehensionSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def parte_detalle(request, pk):
    try:
        obj = ParteAprehension.objects.select_related(
            "tipo_delito", "creado_por", "alerta"
        ).get(pk=pk)
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)
    return Response(ParteAprehensionSerializer(obj).data)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def rechazar_parte(request, pk):
    motivo = (request.data.get("motivo") or "").strip()
    if not motivo:
        return Response(
            {"detail": "Debes indicar el motivo del rechazo (ej. corrige la dirección)."},
            status=400,
        )
    try:
        obj = ParteAprehension.objects.select_related("creado_por").get(pk=pk)
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if obj.estado_revision != ParteAprehension.EstadoRevision.EN_REVISION:
        return Response(
            {"detail": "Solo se pueden rechazar partes pendientes de revisión."},
            status=400,
        )

    obj.estado_revision = ParteAprehension.EstadoRevision.OBSERVADO
    obj.motivo_rechazo = motivo
    obj.rechazado_en = timezone.now()
    obj.revisado_por = request.user
    obj.bloqueado = False
    obj.save(
        update_fields=[
            "estado_revision",
            "motivo_rechazo",
            "rechazado_en",
            "revisado_por",
            "bloqueado",
            "actualizado_en",
        ]
    )

    notify_user(
        user=obj.creado_por,
        tipo=Notificacion.Tipo.PARTE_RECHAZADO,
        titulo="Parte rechazado",
        mensaje=f"Parte rechazado, {motivo}",
        parte=obj,
        enlace="/app/agente_operativo/registro_operativo/partes_aprehension",
    )
    return Response(ParteAprehensionSerializer(obj).data)


@api_view(["POST"])
@permission_classes([SupervisorOnly])
def aprobar_parte(request, pk):
    try:
        obj = ParteAprehension.objects.select_related(
            "tipo_delito", "creado_por"
        ).get(pk=pk)
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if obj.estado_revision != ParteAprehension.EstadoRevision.EN_REVISION:
        return Response(
            {"detail": "Solo se pueden aprobar partes pendientes de revisión."},
            status=400,
        )

    obj.estado_revision = ParteAprehension.EstadoRevision.APROBADO
    obj.aprobado_en = timezone.now()
    obj.revisado_por = request.user
    obj.bloqueado = True
    obj.motivo_rechazo = ""
    obj.save(
        update_fields=[
            "estado_revision",
            "aprobado_en",
            "revisado_por",
            "bloqueado",
            "motivo_rechazo",
            "actualizado_en",
        ]
    )

    try:
        stored = generar_pdf_parte(obj)
        obj.pdf_bucket = stored["bucket"]
        obj.pdf_object_key = stored["object_key"]
        obj.save(update_fields=["pdf_bucket", "pdf_object_key", "actualizado_en"])
    except Exception as exc:  # noqa: BLE001
        return Response(
            {
                "detail": f"Parte aprobado pero no se pudo generar el PDF: {exc}",
                "parte": ParteAprehensionSerializer(obj).data,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    notify_user(
        user=obj.creado_por,
        tipo=Notificacion.Tipo.PARTE_APROBADO,
        titulo="Parte aprobado",
        mensaje=(
            f"Tu parte {obj.numero_caso or obj.id} fue aprobado y bloqueado. "
            "Ya puedes descargar el PDF definitivo."
        ),
        parte=obj,
        enlace="/app/agente_operativo/registro_operativo/partes_aprehension",
    )
    return Response(ParteAprehensionSerializer(obj).data)
