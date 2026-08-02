from __future__ import annotations

import uuid
from io import BytesIO

from django.conf import settings
from minio import Minio
from minio.error import S3Error


def get_minio_client() -> Minio:
    endpoint = settings.MINIO_ENDPOINT
    secure = endpoint.startswith("https://")
    host = endpoint.replace("https://", "").replace("http://", "")
    return Minio(
        host,
        access_key=settings.MINIO_ROOT_USER,
        secret_key=settings.MINIO_ROOT_PASSWORD,
        secure=secure,
    )


def ensure_bucket(client: Minio | None = None, bucket: str | None = None) -> str:
    client = client or get_minio_client()
    bucket = bucket or settings.MINIO_BUCKET_EVIDENCIAS
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    return bucket


def upload_evidencia(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    folder: str = "captura-rapida",
    bucket: str | None = None,
) -> dict:
    """Sube archivo a MinIO y devuelve metadatos de almacenamiento."""
    client = get_minio_client()
    bucket = ensure_bucket(client, bucket)
    safe_name = filename.replace(" ", "_")
    object_key = f"{folder}/{uuid.uuid4().hex}_{safe_name}"
    client.put_object(
        bucket,
        object_key,
        BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type or "application/octet-stream",
    )
    return {
        "bucket": bucket,
        "object_key": object_key,
        "nombre_archivo": filename,
        "content_type": content_type,
        "tamanio_bytes": len(file_bytes),
    }


def get_presigned_url(object_key: str, bucket: str | None = None, expires_hours: int = 2) -> str:
    from datetime import timedelta
    from urllib.parse import urlparse, urlunparse

    client = get_minio_client()
    bucket = bucket or settings.MINIO_BUCKET_EVIDENCIAS
    try:
        url = client.presigned_get_object(
            bucket, object_key, expires=timedelta(hours=expires_hours)
        )
    except S3Error:
        return ""

    # Reescribir host interno (minio:9000) al endpoint público del navegador.
    public = getattr(settings, "MINIO_PUBLIC_ENDPOINT", "") or ""
    if public:
        internal = urlparse(url)
        external = urlparse(public if "://" in public else f"http://{public}")
        url = urlunparse(
            (
                external.scheme or "http",
                external.netloc or external.path,
                internal.path,
                internal.params,
                internal.query,
                internal.fragment,
            )
        )
    return url


def download_object(object_key: str, bucket: str | None = None) -> bytes:
    client = get_minio_client()
    bucket = bucket or settings.MINIO_BUCKET_EVIDENCIAS
    response = client.get_object(bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
