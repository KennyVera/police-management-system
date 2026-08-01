"""
DAG ejemplo: ETL horaria MinIO (parquet) → carpetas locales → ClickHouse.

Flujo de auditoría en /opt/airflow/Datos/etl_partes_policiales:
  Crudo → Procesados → Terminado
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

ETL_ROOT = Path(os.getenv("ETL_DATOS_PATH", "/opt/airflow/Datos")) / "etl_partes_policiales"
CRUDO = ETL_ROOT / "Crudo"
PROCESADOS = ETL_ROOT / "Procesados"
TERMINADO = ETL_ROOT / "Terminado"


def ensure_etl_folders() -> None:
    for folder in (CRUDO, PROCESADOS, TERMINADO):
        folder.mkdir(parents=True, exist_ok=True)


def extract_from_minio(**_context) -> str:
    """Extrae objetos .parquet del Data Lake (MinIO) hacia Crudo."""
    ensure_etl_folders()
    endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
    bucket = os.getenv("MINIO_BUCKET_OPERATIVO", "datos-operativos")
    # Stub: en producción usar minio.Minio(...).fget_object(...)
    marker = CRUDO / f"extract_{datetime.utcnow():%Y%m%d_%H%M%S}.marker"
    marker.write_text(
        f"Pendiente descargar parquet desde s3://{bucket} @ {endpoint}\n",
        encoding="utf-8",
    )
    return str(marker)


def transform_parquet(**_context) -> str:
    """Limpia / transforma datos de Crudo → Procesados."""
    ensure_etl_folders()
    stamped = PROCESADOS / f"procesado_{datetime.utcnow():%Y%m%d_%H%M%S}.marker"
    stamped.write_text("Transformación stub completada\n", encoding="utf-8")
    return str(stamped)


def load_to_clickhouse(**_context) -> str:
    """Mueve artefacto a Terminado e inserta KPIs en ClickHouse."""
    ensure_etl_folders()
    done = TERMINADO / f"terminado_{datetime.utcnow():%Y%m%d_%H%M%S}.marker"
    done.write_text(
        f"Listo para ClickHouse {os.getenv('CLICKHOUSE_HOST')}/"
        f"{os.getenv('CLICKHOUSE_DB')}\n",
        encoding="utf-8",
    )
    return str(done)


default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="etl_partes_policiales_hourly",
    default_args=default_args,
    description="Extrae parquet de MinIO, transforma y carga KPIs a ClickHouse",
    schedule_interval="@hourly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["etl", "minio", "clickhouse", "partes"],
) as dag:
    prepare = BashOperator(
        task_id="ensure_folders",
        bash_command=(
            "mkdir -p "
            "/opt/airflow/Datos/etl_partes_policiales/{Crudo,Procesados,Terminado}"
        ),
    )

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

    prepare >> extract >> transform >> load
