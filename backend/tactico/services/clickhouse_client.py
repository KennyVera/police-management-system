"""Cliente ClickHouse de solo lectura para el módulo táctico."""

from __future__ import annotations

import logging
import re
import threading
from typing import Any

import clickhouse_connect
from clickhouse_connect.driver.client import Client
from django.conf import settings

logger = logging.getLogger(__name__)

# clickhouse-connect no permite consultas concurrentes en la misma sesión.
# Un cliente por hilo evita el error con Promise.all / varias peticiones a la vez.
_thread_local = threading.local()

# Palabras que nunca deben aparecer como sentencia principal (solo SELECT/WITH).
_FORBIDDEN = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|ATTACH|DETACH|"
    r"RENAME|REPLACE|OPTIMIZE|SYSTEM|GRANT|REVOKE|SET|KILL|EXCHANGE|"
    r"INTO\s+OUTFILE|FORMAT\s+Native"
    r")\b",
    re.IGNORECASE,
)
_MULTI_STATEMENT = re.compile(r";\s*\S")


class ClickHouseReadOnlyError(ValueError):
    """Consulta rechazada por política de solo lectura o parámetros inválidos."""


def _build_client() -> Client:
    return clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=int(settings.CLICKHOUSE_HTTP_PORT),
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD or "",
        database=settings.CLICKHOUSE_DB,
        connect_timeout=5,
        send_receive_timeout=30,
    )


def get_clickhouse_client() -> Client:
    """Cliente ClickHouse aislado por hilo (seguro ante peticiones concurrentes)."""
    client = getattr(_thread_local, "client", None)
    if client is not None:
        return client
    client = _build_client()
    _thread_local.client = client
    return client


def reset_clickhouse_client() -> None:
    """Cierra el cliente del hilo actual (útil en tests / reloads)."""
    client = getattr(_thread_local, "client", None)
    if client is not None:
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
        _thread_local.client = None


def _assert_readonly_sql(sql: str) -> str:
    cleaned = (sql or "").strip()
    if not cleaned:
        raise ClickHouseReadOnlyError("SQL vacío.")
    if _MULTI_STATEMENT.search(cleaned.rstrip(";")):
        raise ClickHouseReadOnlyError("No se permiten múltiples sentencias SQL.")
    body = cleaned.rstrip(";").strip()
    body_no_comments = re.sub(r"--.*?$", "", body, flags=re.MULTILINE).strip()
    upper = body_no_comments.lstrip("(").lstrip().upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        raise ClickHouseReadOnlyError("Solo se permiten consultas SELECT/WITH.")
    if _FORBIDDEN.search(body_no_comments):
        raise ClickHouseReadOnlyError("La consulta contiene operaciones no permitidas.")
    return body


def execute_readonly(
    sql: str,
    parameters: dict[str, Any] | None = None,
    *,
    settings_overrides: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Ejecuta SQL de solo lectura y devuelve filas como dicts.

    Abre un cliente efímero por consulta para tolerar concurrencia real
    (varios endpoints tácticos en paralelo desde el frontend).
    """
    safe_sql = _assert_readonly_sql(sql)
    params = parameters or {}
    ch_settings = {"readonly": 1, **(settings_overrides or {})}

    # Cliente dedicado por query: evita "concurrent queries within the same session"
    # aunque varios workers reutilicen hilos o se solapen peticiones.
    client = _build_client()
    try:
        result = client.query(safe_sql, parameters=params, settings=ch_settings)
        columns = list(result.column_names)
        return [dict(zip(columns, values)) for values in result.result_rows]
    except Exception:
        logger.exception("Error ejecutando consulta ClickHouse de solo lectura")
        raise
    finally:
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
