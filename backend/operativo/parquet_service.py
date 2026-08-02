"""Generación y carga de parquet de partes aprobados al Data Lake (MinIO)."""

from __future__ import annotations

from io import BytesIO

import pandas as pd
from django.conf import settings

from operativo.minio_service import upload_evidencia


def build_parquet_bytes(parte) -> bytes:
    """Serializa un parte aprobado al esquema canónico del ETL."""
    agente = ""
    if parte.creado_por_id:
        u = parte.creado_por
        agente = f"{u.first_name} {u.last_name}".strip() or u.username

    row = {
        "parte_id": parte.id,
        "numero_caso": parte.numero_caso or "",
        "titulo": parte.titulo or "",
        "tipo_delito": parte.tipo_delito.nombre if parte.tipo_delito_id else "",
        "fecha_hecho": pd.to_datetime(parte.fecha_hecho) if parte.fecha_hecho else None,
        "fecha_hora": pd.to_datetime(parte.fecha_hora, utc=True) if parte.fecha_hora else None,
        "prioridad": parte.prioridad or "",
        "lugar": parte.lugar or "",
        "sector_zona": parte.sector_zona or "",
        "latitud": float(parte.latitud) if parte.latitud is not None else None,
        "longitud": float(parte.longitud) if parte.longitud is not None else None,
        "estado_revision": parte.estado_revision or "",
        "aprobado_en": pd.to_datetime(parte.aprobado_en, utc=True) if parte.aprobado_en else None,
        "agente": agente,
    }
    df = pd.DataFrame([row])
    buf = BytesIO()
    df.to_parquet(buf, index=False, engine="pyarrow")
    return buf.getvalue()


def generar_parquet_parte(parte) -> dict:
    """Genera parquet del parte y lo sube a datos-operativos/partes/."""
    parquet_bytes = build_parquet_bytes(parte)
    filename = f"{parte.numero_caso or f'parte-{parte.id}'}.parquet"
    return upload_evidencia(
        file_bytes=parquet_bytes,
        filename=filename,
        content_type="application/vnd.apache.parquet",
        folder="partes",
        bucket=settings.MINIO_BUCKET_OPERATIVO,
    )
