from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import Notificacion, ParteAprehension
from operativo.notifications import notify_user
from operativo.pagination import paginate_qs
from operativo.pdf_service import build_pdf_bytes, generar_pdf_parte
from operativo.parquet_service import generar_parquet_parte
from operativo.serializers import ParteAprehensionSerializer
from roles.supervisor_unidad.scope import parte_en_zona_or_404, partes_en_zona_qs


def _parte_no_encontrado():
    return Response(
        {"detail": "Parte no encontrado o fuera de tu zona."},
        status=404,
    )


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def partes_pendientes(request):
    qs = (
        partes_en_zona_qs(request.user)
        .filter(estado_revision=ParteAprehension.EstadoRevision.EN_REVISION)
        .select_related("tipo_delito", "creado_por", "alerta")
        .prefetch_related("multimedia")
        .order_by("enviado_revision_en")
    )
    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(numero_caso__icontains=q)
            | Q(titulo__icontains=q)
            | Q(lugar__icontains=q)
            | Q(sector_zona__icontains=q)
            | Q(creado_por__first_name__icontains=q)
            | Q(creado_por__last_name__icontains=q)
            | Q(creado_por__email__icontains=q)
            | Q(tipo_delito__nombre__icontains=q)
        )
    prioridad = (request.query_params.get("prioridad") or "").strip().upper()
    if prioridad:
        qs = qs.filter(prioridad=prioridad)
    return paginate_qs(request, qs, ParteAprehensionSerializer)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def partes_historial(request):
    qs = (
        partes_en_zona_qs(request.user)
        .filter(
            estado_revision__in=[
                ParteAprehension.EstadoRevision.APROBADO,
                ParteAprehension.EstadoRevision.OBSERVADO,
            ]
        )
        .select_related("tipo_delito", "creado_por", "alerta", "revisado_por")
        .prefetch_related("multimedia")
        .order_by("-actualizado_en")
    )
    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(numero_caso__icontains=q)
            | Q(titulo__icontains=q)
            | Q(lugar__icontains=q)
            | Q(sector_zona__icontains=q)
            | Q(creado_por__first_name__icontains=q)
            | Q(creado_por__last_name__icontains=q)
            | Q(motivo_rechazo__icontains=q)
        )
    estado = (request.query_params.get("estado") or "").strip().upper()
    if estado in {
        ParteAprehension.EstadoRevision.APROBADO,
        ParteAprehension.EstadoRevision.OBSERVADO,
    }:
        qs = qs.filter(estado_revision=estado)
    return paginate_qs(request, qs, ParteAprehensionSerializer)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def parte_detalle(request, pk):
    obj = parte_en_zona_or_404(request.user, pk)
    if not obj:
        return _parte_no_encontrado()
    return Response(ParteAprehensionSerializer(obj).data)


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def parte_pdf(request, pk):
    """Vista previa o descarga del PDF (incluye evidencias). Genera al vuelo."""
    obj = parte_en_zona_or_404(request.user, pk)
    if not obj:
        return _parte_no_encontrado()

    try:
        pdf_bytes = build_pdf_bytes(obj)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo generar el PDF: {exc}"},
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
@permission_classes([SupervisorOnly])
def rechazar_parte(request, pk):
    motivo = (request.data.get("motivo") or "").strip()
    if not motivo:
        return Response(
            {"detail": "Debes indicar el motivo del rechazo (ej. corrige la dirección)."},
            status=400,
        )
    obj = parte_en_zona_or_404(request.user, pk)
    if not obj:
        return _parte_no_encontrado()

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
    obj = parte_en_zona_or_404(request.user, pk)
    if not obj:
        return _parte_no_encontrado()

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

    try:
        generar_parquet_parte(obj)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {
                "detail": (
                    f"Parte aprobado y PDF OK, pero no se pudo subir el parquet "
                    f"al Data Lake: {exc}"
                ),
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

    # Remisión automática a Fiscalía de Turno
    try:
        from operativo.fiscal_service import remitir_parte_a_fiscalia

        remitir_parte_a_fiscalia(obj)
    except Exception:  # noqa: BLE001
        # No bloquear la aprobación si falla la remisión; el parte ya está APROBADO
        pass

    return Response(ParteAprehensionSerializer(obj).data)
