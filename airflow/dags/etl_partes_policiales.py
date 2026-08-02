"""
DAG: etl_partes_policiales

ETL horario MinIO (bucket datos-operativos) → auditoría local → ClickHouse.

Estructura de carpetas (volumen ETL_DATOS_PATH, default /opt/airflow/Datos):
  etl_partes_policiales/Crudo/      → parquet crudo descargado de MinIO
  etl_partes_policiales/Procesados/ → parquet limpio/transformado (Pandas)
  etl_partes_policiales/Terminado/  → copia final de auditoría + fuente de carga a ClickHouse
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from airflow import DAG
from airflow.exceptions import AirflowSkipException
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

ETL_ROOT = Path(os.getenv("ETL_DATOS_PATH", "/opt/airflow/Datos")) / "etl_partes_policiales"
CRUDO = ETL_ROOT / "Crudo"
PROCESADOS = ETL_ROOT / "Procesados"
TERMINADO = ETL_ROOT / "Terminado"

BUCKET = os.getenv("MINIO_BUCKET_OPERATIVO", "datos-operativos")
PREFIX = os.getenv("ETL_PARTES_PREFIX", "partes/")  # prefijo opcional en el bucket

# Columnas canónicas hacia fact_partes_policiales
FACT_COLUMNS = [
    "parte_id",
    "numero_caso",
    "titulo",
    "tipo_delito",
    "fecha_hecho",
    "fecha_hora",
    "prioridad",
    "lugar",
    "sector_zona",
    "latitud",
    "longitud",
    "estado_revision",
    "aprobado_en",
    "agente",
    "source_file",
]

COLUMN_ALIASES = {
    "parte_id": ["parte_id", "id", "parteId"],
    "numero_caso": ["numero_caso", "numeroCaso", "caso"],
    "titulo": ["titulo", "title"],
    "tipo_delito": ["tipo_delito", "tipo_delito_nombre", "delito", "tipoDelito"],
    "fecha_hecho": ["fecha_hecho", "fechaHecho"],
    "fecha_hora": ["fecha_hora", "fechaHora", "created_at", "creado_en"],
    "prioridad": ["prioridad", "priority"],
    "lugar": ["lugar", "ubicacion", "direccion"],
    "sector_zona": ["sector_zona", "sector", "zona"],
    "latitud": ["latitud", "lat", "latitude"],
    "longitud": ["longitud", "lng", "lon", "longitude"],
    "estado_revision": ["estado_revision", "estado", "status"],
    "aprobado_en": ["aprobado_en", "aprobadoEn", "approved_at"],
    "agente": ["agente", "oficial", "creado_por", "agente_nombre"],
}


def ensure_etl_folders() -> None:
    for folder in (CRUDO, PROCESADOS, TERMINADO):
        folder.mkdir(parents=True, exist_ok=True)


def _run_stamp(context: dict[str, Any] | None = None) -> str:
    if context and context.get("data_interval_start"):
        return context["data_interval_start"].strftime("%Y%m%d_%H%M%S")
    if context and context.get("logical_date"):
        return context["logical_date"].strftime("%Y%m%d_%H%M%S")
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _minio_s3_client():
    import boto3
    from botocore.client import Config

    endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
    if not endpoint.startswith("http"):
        endpoint = f"http://{endpoint}"

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.getenv("MINIO_ROOT_USER", "minioadmin"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD", "minioadmin"),
        config=Config(signature_version="s3v4"),
        region_name=os.getenv("MINIO_REGION", "us-east-1"),
    )


def _clickhouse_port() -> int:
    """Puerto HTTP interno del contenedor ClickHouse (no el mapeo del host)."""
    host = os.getenv("CLICKHOUSE_HOST", "clickhouse")
    if host in {"clickhouse", "sgp_clickhouse"}:
        return 8123
    return int(os.getenv("CLICKHOUSE_HTTP_PORT", "8123"))


def _pick_column(df_columns: list[str], aliases: list[str]) -> str | None:
    lower_map = {c.lower(): c for c in df_columns}
    for alias in aliases:
        if alias.lower() in lower_map:
            return lower_map[alias.lower()]
    return None


def extract_from_minio(**context) -> dict[str, Any]:
    """Task 1: descarga .parquet de la última hora desde MinIO → Crudo.

    Si no hay archivos en la ventana, lanza AirflowSkipException para que
    transform/load queden Skipped sin crear carpetas ni parquet vacíos.
    """
    stamp = _run_stamp(context)

    now = datetime.now(timezone.utc)
    dag_run = context.get("dag_run")
    is_manual = bool(dag_run and getattr(dag_run, "external_trigger", False))

    # Runs manuales: ventana amplia (últimas 2h) para poder probar al momento.
    # Runs programados: respetan el data_interval de la hora.
    if is_manual:
        since = now - timedelta(hours=2)
        end = now + timedelta(seconds=1)
    elif context.get("data_interval_start") and context.get("data_interval_end"):
        since = context["data_interval_start"]
        if since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)
        end = context["data_interval_end"]
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
    else:
        since = now - timedelta(hours=1)
        end = now

    client = _minio_s3_client()
    to_download: list[tuple[str, datetime]] = []

    paginator = client.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=BUCKET, Prefix=PREFIX)

    for page in pages:
        for obj in page.get("Contents") or []:
            key = obj["Key"]
            if not key.lower().endswith(".parquet"):
                continue
            last_modified = obj["LastModified"]
            if last_modified.tzinfo is None:
                last_modified = last_modified.replace(tzinfo=timezone.utc)
            if since <= last_modified < end:
                to_download.append((key, last_modified))

    if not to_download:
        raise AirflowSkipException(
            f"Sin .parquet en s3://{BUCKET}/{PREFIX} "
            f"entre {since.isoformat()} y {end.isoformat()}. "
            "Downstream tasks serán Skipped."
        )

    # Solo crear carpetas cuando hay datos reales
    ensure_etl_folders()
    run_dir = CRUDO / stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    downloaded: list[str] = []
    for key, _lm in to_download:
        safe_name = key.replace("/", "__")
        dest = run_dir / safe_name
        client.download_file(BUCKET, key, str(dest))
        downloaded.append(str(dest))
        logger.info("Descargado s3://%s/%s → %s", BUCKET, key, dest)

    manifest = {
        "stamp": stamp,
        "crudo_dir": str(run_dir),
        "files": downloaded,
        "count": len(downloaded),
        "window_start": since.isoformat(),
        "window_end": end.isoformat(),
    }
    (run_dir / "_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    context["ti"].xcom_push(key="extract_manifest", value=manifest)
    logger.info("Extract completado: %s archivos en %s", len(downloaded), run_dir)
    return manifest


def transform_parquet(**context) -> dict[str, Any]:
    """Task 2: Crudo → Pandas (limpieza) → Procesados."""
    import pandas as pd

    ti = context["ti"]
    manifest = ti.xcom_pull(task_ids="extract_minio_to_crudo", key="extract_manifest")
    if not manifest:
        raise AirflowSkipException(
            "Sin manifest de extracción (upstream skipped o sin datos)."
        )

    stamp = manifest["stamp"]
    files = manifest.get("files") or []
    if not files:
        raise AirflowSkipException(
            "Extract no trajo archivos; no se generan parquet vacíos."
        )

    ensure_etl_folders()
    out_dir = PROCESADOS / stamp
    out_dir.mkdir(parents=True, exist_ok=True)

    frames: list[pd.DataFrame] = []
    for path in files:
        df = pd.read_parquet(path)
        frames.append(df)
        logger.info("Leído %s (%s filas, %s cols)", path, len(df), list(df.columns))

    raw = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]
    normalized = pd.DataFrame(index=raw.index)

    for target, aliases in COLUMN_ALIASES.items():
        src = _pick_column(list(raw.columns), aliases)
        normalized[target] = raw[src] if src else None

    # Fechas → datetime
    for col in ("fecha_hecho", "fecha_hora", "aprobado_en"):
        normalized[col] = pd.to_datetime(normalized[col], errors="coerce", utc=True)

    # Si falta fecha_hora, usar fecha_hecho o ahora
    missing_fh = normalized["fecha_hora"].isna()
    normalized.loc[missing_fh, "fecha_hora"] = normalized.loc[missing_fh, "fecha_hecho"]
    still_missing = normalized["fecha_hora"].isna()
    if still_missing.any():
        normalized.loc[still_missing, "fecha_hora"] = pd.Timestamp.now(tz="UTC")

    # Coordenadas nulas → 0.0 (punto desconocido / placeholder operativo)
    normalized["latitud"] = pd.to_numeric(normalized["latitud"], errors="coerce").fillna(0.0)
    normalized["longitud"] = pd.to_numeric(normalized["longitud"], errors="coerce").fillna(0.0)

    # Identificador
    normalized["parte_id"] = pd.to_numeric(normalized["parte_id"], errors="coerce")
    if normalized["parte_id"].isna().all():
        normalized["parte_id"] = range(1, len(normalized) + 1)
    else:
        normalized["parte_id"] = normalized["parte_id"].fillna(0).astype("int64")

    # Strings
    for col in (
        "numero_caso",
        "titulo",
        "tipo_delito",
        "prioridad",
        "lugar",
        "sector_zona",
        "estado_revision",
        "agente",
    ):
        normalized[col] = normalized[col].fillna("").astype(str)

    normalized["source_file"] = ";".join(Path(p).name for p in files)
    normalized = normalized[FACT_COLUMNS]

    out_path = out_dir / f"partes_procesados_{stamp}.parquet"
    normalized.to_parquet(out_path, index=False)

    result = {
        "stamp": stamp,
        "procesado_path": str(out_path),
        "rows": int(len(normalized)),
        "empty": False,
    }
    ti.xcom_push(key="transform_manifest", value=result)
    logger.info("Transform OK → %s (%s filas)", out_path, len(normalized))
    return result


def _clickhouse_http_base() -> tuple[str, dict[str, str]]:
    host = os.getenv("CLICKHOUSE_HOST", "clickhouse")
    port = _clickhouse_port()
    user = os.getenv("CLICKHOUSE_USER", "default")
    password = os.getenv("CLICKHOUSE_PASSWORD", "")
    database = os.getenv("CLICKHOUSE_DB", "police_analytics")
    base = f"http://{host}:{port}/"
    params = {"database": database, "user": user}
    if password:
        params["password"] = password
    return base, params


def _clickhouse_query(sql: str, data: bytes | None = None) -> str:
    import urllib.error
    import urllib.parse
    import urllib.request

    base, params = _clickhouse_http_base()
    if data is None:
        url = base + "?" + urllib.parse.urlencode(params)
        body = sql.encode("utf-8")
    else:
        q = dict(params)
        q["query"] = sql
        url = base + "?" + urllib.parse.urlencode(q)
        body = data

    req = urllib.request.Request(url, data=body, method="POST")
    if data is not None:
        req.add_header("Content-Type", "application/octet-stream")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ClickHouse HTTP {exc.code}: {err_body}") from exc


def load_to_clickhouse(**context) -> dict[str, Any]:
    """Task 3: copia a Terminado e inserta en fact_partes_policiales."""
    import pandas as pd

    ti = context["ti"]
    tmanifest = ti.xcom_pull(
        task_ids="transform_crudo_to_procesados", key="transform_manifest"
    )
    if not tmanifest:
        raise AirflowSkipException(
            "Sin manifest de transformación (upstream skipped o sin datos)."
        )

    stamp = tmanifest["stamp"]
    src = Path(tmanifest["procesado_path"])
    if not src.exists():
        raise AirflowSkipException(f"No existe parquet procesado: {src}")

    df = pd.read_parquet(src)
    rows = int(len(df))
    if rows == 0:
        raise AirflowSkipException(
            "Parquet procesado sin filas; no se escribe Terminado ni ClickHouse."
        )

    ensure_etl_folders()
    term_dir = TERMINADO / stamp
    term_dir.mkdir(parents=True, exist_ok=True)
    dest = term_dir / src.name
    shutil.copy2(src, dest)

    host = os.getenv("CLICKHOUSE_HOST", "clickhouse")
    port = _clickhouse_port()
    database = os.getenv("CLICKHOUSE_DB", "police_analytics")

    _clickhouse_query(f"CREATE DATABASE IF NOT EXISTS {database}")
    _clickhouse_query(
        f"""
        CREATE TABLE IF NOT EXISTS {database}.fact_partes_policiales
        (
            parte_id UInt64,
            numero_caso String,
            titulo String,
            tipo_delito String,
            fecha_hecho Nullable(DateTime64(3, 'UTC')),
            fecha_hora DateTime64(3, 'UTC'),
            prioridad String,
            lugar String,
            sector_zona String,
            latitud Float64,
            longitud Float64,
            estado_revision String,
            aprobado_en Nullable(DateTime64(3, 'UTC')),
            agente String,
            source_file String,
            loaded_at DateTime64(3, 'UTC') DEFAULT now64(3)
        )
        ENGINE = MergeTree()
        ORDER BY (fecha_hora, parte_id)
        """
    )

    load_df = df.copy()
    for col in ("fecha_hecho", "fecha_hora", "aprobado_en"):
        load_df[col] = pd.to_datetime(load_df[col], utc=True, errors="coerce")

    def _fmt_dt(val) -> str | None:
        if val is None or (isinstance(val, float) and pd.isna(val)):
            return None
        if pd.isna(val):
            return None
        ts = pd.Timestamp(val)
        if ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        return ts.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    lines: list[str] = []
    for row in load_df.itertuples(index=False):
        rec = {
            "parte_id": int(row.parte_id),
            "numero_caso": str(row.numero_caso or ""),
            "titulo": str(row.titulo or ""),
            "tipo_delito": str(row.tipo_delito or ""),
            "fecha_hecho": _fmt_dt(row.fecha_hecho),
            "fecha_hora": _fmt_dt(row.fecha_hora),
            "prioridad": str(row.prioridad or ""),
            "lugar": str(row.lugar or ""),
            "sector_zona": str(row.sector_zona or ""),
            "latitud": float(row.latitud or 0.0),
            "longitud": float(row.longitud or 0.0),
            "estado_revision": str(row.estado_revision or ""),
            "aprobado_en": _fmt_dt(row.aprobado_en),
            "agente": str(row.agente or ""),
            "source_file": str(row.source_file or ""),
        }
        lines.append(json.dumps(rec, ensure_ascii=False))

    payload = ("\n".join(lines) + "\n").encode("utf-8")
    insert_sql = (
        f"INSERT INTO {database}.fact_partes_policiales "
        f"({', '.join(FACT_COLUMNS)}) FORMAT JSONEachRow"
    )
    _clickhouse_query(insert_sql, data=payload)

    summary = {
        "stamp": stamp,
        "terminado_path": str(dest),
        "inserted": rows,
        "skipped": False,
        "clickhouse": f"{host}:{port}/{database}.fact_partes_policiales",
    }
    (term_dir / "_load_summary.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    logger.info("Load OK: %s filas → %s", rows, summary["clickhouse"])
    return summary


default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="etl_partes_policiales",
    default_args=default_args,
    description=(
        "Extrae parquet de MinIO (datos-operativos), transforma con Pandas "
        "vía Crudo→Procesados→Terminado y carga fact_partes_policiales en ClickHouse"
    ),
    schedule_interval="@hourly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["etl", "minio", "clickhouse", "partes", "parquet"],
) as dag:
    extract = PythonOperator(
        task_id="extract_minio_to_crudo",
        python_callable=extract_from_minio,
    )

    transform = PythonOperator(
        task_id="transform_crudo_to_procesados",
        python_callable=transform_parquet,
    )

    load = PythonOperator(
        task_id="load_terminado_to_clickhouse",
        python_callable=load_to_clickhouse,
    )

    extract >> transform >> load
