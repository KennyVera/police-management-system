"""Subida de assets de marca a MinIO + proxy público."""

from __future__ import annotations

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from operativo.minio_service import download_object, upload_evidencia
from saas_core.configuracion.services.config_svc import apply_seccion, get_config
from saas_core.permissions import IsSuperAdminGlobal

ALLOWED_FIELDS = {
    "logo_login_url": "apariencia",
    "logo_reportes_url": "apariencia",
    "logo_url": "identidad",
    "favicon_url": "identidad",
}

ALLOWED_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
}

MAX_BYTES = 3 * 1024 * 1024  # 3 MB
BUCKET_FOLDER = "plataforma-branding"


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
@parser_classes([MultiPartParser, FormParser])
def upload_branding(request):
    campo = (request.data.get("campo") or "").strip()
    if campo not in ALLOWED_FIELDS:
        return Response(
            {"detail": f"campo inválido. Use: {', '.join(ALLOWED_FIELDS)}"},
            status=400,
        )
    archivo = request.FILES.get("file") or request.FILES.get("archivo")
    if not archivo:
        return Response({"detail": "Archivo requerido (file)."}, status=400)

    content_type = (archivo.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        return Response(
            {"detail": "Solo imágenes PNG, JPG, WEBP, SVG o ICO."},
            status=400,
        )
    data = archivo.read()
    if len(data) > MAX_BYTES:
        return Response({"detail": "Máximo 3 MB por imagen."}, status=400)

    try:
        stored = upload_evidencia(
            file_bytes=data,
            filename=archivo.name,
            content_type=content_type,
            folder=BUCKET_FOLDER,
        )
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo subir a MinIO: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # URL estable vía proxy Django (no expira como presigned)
    url = f"/api/saas/branding/{stored['object_key']}"
    seccion = ALLOWED_FIELDS[campo]
    apply_seccion(seccion, {campo: url}, actor=request.user)
    cfg = get_config()
    return Response(
        {
            "campo": campo,
            "url": url,
            "object_key": stored["object_key"],
            "bucket": stored["bucket"],
            "valor": getattr(cfg, campo),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def branding_proxy(request, object_key: str):
    """Sirve logos/favicon desde MinIO (público para login/reportes)."""
    if ".." in object_key or not object_key.startswith(f"{BUCKET_FOLDER}/"):
        return Response({"detail": "Recurso no válido."}, status=404)
    try:
        raw = download_object(object_key)
    except Exception:  # noqa: BLE001
        return Response({"detail": "Archivo no encontrado."}, status=404)

    ctype = "application/octet-stream"
    lower = object_key.lower()
    if lower.endswith(".png"):
        ctype = "image/png"
    elif lower.endswith((".jpg", ".jpeg")):
        ctype = "image/jpeg"
    elif lower.endswith(".webp"):
        ctype = "image/webp"
    elif lower.endswith(".svg"):
        ctype = "image/svg+xml"
    elif lower.endswith(".ico"):
        ctype = "image/x-icon"

    resp = HttpResponse(raw, content_type=ctype)
    resp["Cache-Control"] = "public, max-age=86400"
    return resp
