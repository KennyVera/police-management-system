"""APIs de Inteligencia Táctica (proxy Django → ClickHouse)."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from tactico.permissions import EsJefeDeZona
from tactico.services.clickhouse_client import ClickHouseReadOnlyError, execute_readonly
from tactico.services.geo_scope import ZoneScopeError, resolve_zone_scope

FACT = "police_analytics.fact_partes_policiales"


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise ValueError(f"Parámetro '{field}' inválido. Use YYYY-MM-DD.") from exc


def _scope_or_error(request):
    try:
        return resolve_zone_scope(request.user), None
    except ZoneScopeError as exc:
        return None, Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def estadisticas(request):
    """
    Conteo de delitos (partes) del mes actual vs mes anterior en la zona del jefe.
    """
    scope, err = _scope_or_error(request)
    if err:
        return err

    sql = f"""
    SELECT
        countIf(toYYYYMM(fecha_hora) = toYYYYMM(today())) AS mes_actual,
        countIf(
            toYYYYMM(fecha_hora) = toYYYYMM(addMonths(today(), -1))
        ) AS mes_anterior
    FROM {FACT}
    WHERE 1 = 1
      {scope.geo_sql}
    """
    try:
        rows = execute_readonly(sql, scope.geo_params)
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    row = rows[0] if rows else {"mes_actual": 0, "mes_anterior": 0}
    actual = int(row.get("mes_actual") or 0)
    anterior = int(row.get("mes_anterior") or 0)
    if anterior > 0:
        variacion_pct = round(((actual - anterior) / anterior) * 100, 2)
    else:
        variacion_pct = None if actual == 0 else 100.0

    today = date.today()
    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "periodo": {
                "mes_actual": today.strftime("%Y-%m"),
                "mes_anterior": (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m"),
            },
            "mes_actual": actual,
            "mes_anterior": anterior,
            "variacion_pct": variacion_pct,
            "delta": actual - anterior,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def mapa_calor(request):
    """
    Puntos de calor: latitud, longitud, peso y tipo de delito (zona + rango de fechas).

    Query params:
      - fecha_desde / fecha_hasta (YYYY-MM-DD). Por defecto: últimos 30 días.
      - tipo_delito (opcional)
      - limit (opcional, default 2000, max 10000)
    """
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta") or date.today()
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde") or (
            fecha_hasta - timedelta(days=30)
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if fecha_desde > fecha_hasta:
        return Response(
            {"detail": "fecha_desde no puede ser mayor que fecha_hasta."},
            status=status.HTTP.HTTP_400_BAD_REQUEST
            if False
            else status.HTTP_400_BAD_REQUEST,
        )

    tipo = (request.query_params.get("tipo_delito") or "").strip()
    try:
        limit = min(max(int(request.query_params.get("limit", 2000)), 1), 10000)
    except ValueError:
        return Response({"detail": "limit inválido."}, status=status.HTTP_400_BAD_REQUEST)

    params = {
        **scope.geo_params,
        "fecha_desde": datetime.combine(fecha_desde, datetime.min.time()),
        "fecha_hasta": datetime.combine(fecha_hasta, datetime.max.time().replace(microsecond=0)),
        "limit": limit,
    }

    tipo_clause = ""
    if tipo:
        tipo_clause = "AND tipo_delito = {tipo_delito:String}"
        params["tipo_delito"] = tipo

    sql = f"""
    SELECT
        latitud,
        longitud,
        tipo_delito,
        toUInt32(count()) AS peso
    FROM {FACT}
    WHERE 1 = 1
      {scope.geo_sql}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
      AND isFinite(latitud) AND isFinite(longitud)
      AND (latitud != 0 OR longitud != 0)
      {tipo_clause}
    GROUP BY latitud, longitud, tipo_delito
    ORDER BY peso DESC
    LIMIT {{limit:UInt32}}
    """
    try:
        rows = execute_readonly(sql, params)
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    puntos = [
        {
            "latitud": float(r["latitud"]),
            "longitud": float(r["longitud"]),
            "peso": int(r["peso"] or 0),
            "tipo_delito": r.get("tipo_delito") or "",
        }
        for r in rows
    ]
    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "filtros": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
                "tipo_delito": tipo or None,
            },
            "total_puntos": len(puntos),
            "puntos": puntos,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def ranking_distritos(request):
    """
    Ranking de partes policiales agrupados por sub-jurisdicción (sector_zona).

    Query params opcionales: fecha_desde, fecha_hasta, limit (default 20).
    """
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
        limit = min(max(int(request.query_params.get("limit", 20)), 1), 200)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    params = {**scope.geo_params, "limit": limit}
    date_clause = ""
    if fecha_desde:
        date_clause += " AND fecha_hora >= {fecha_desde:DateTime}"
        params["fecha_desde"] = datetime.combine(fecha_desde, datetime.min.time())
    if fecha_hasta:
        date_clause += " AND fecha_hora <= {fecha_hasta:DateTime}"
        params["fecha_hasta"] = datetime.combine(
            fecha_hasta, datetime.max.time().replace(microsecond=0)
        )

    sql = (
        "SELECT sector_zona AS distrito, "
        "toUInt32(count()) AS total_partes, "
        "uniqExact(tipo_delito) AS tipos_delito, "
        "toUInt32(countIf(upper(prioridad) IN ('ALTA','CRITICA','ALTO','CRITICO'))) AS partes_criticos, "
        "uniqExact(agente) AS agentes_reportantes "
        f"FROM {FACT} WHERE 1 = 1 "
        + scope.geo_sql
        + date_clause
        + " AND sector_zona != ''"
        + " GROUP BY sector_zona ORDER BY total_partes DESC"
        + " LIMIT {limit:UInt32}"
    )
    try:
        rows = execute_readonly(sql, params)
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    ranking = [
        {
            "posicion": idx,
            "distrito": r.get("distrito") or "",
            "total_partes": int(r.get("total_partes") or 0),
            "tipos_delito": int(r.get("tipos_delito") or 0),
            "partes_criticos": int(r.get("partes_criticos") or 0),
            "agentes_reportantes": int(r.get("agentes_reportantes") or 0),
        }
        for idx, r in enumerate(rows, start=1)
    ]
    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "filtros": {
                "fecha_desde": fecha_desde.isoformat() if fecha_desde else None,
                "fecha_hasta": fecha_hasta.isoformat() if fecha_hasta else None,
            },
            "ranking": ranking,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def delitos_desglose(request):
    """
    Indicadores de criminalidad desglosados por tipo de delito y distrito/circuito.
    """
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta") or date.today()
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde") or (
            fecha_hasta - timedelta(days=30)
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    params = {
        **scope.geo_params,
        "fecha_desde": datetime.combine(fecha_desde, datetime.min.time()),
        "fecha_hasta": datetime.combine(fecha_hasta, datetime.max.time().replace(microsecond=0)),
    }

    sql_tipo = (
        "SELECT tipo_delito, toUInt32(count()) AS total "
        f"FROM {FACT} WHERE 1 = 1 "
        + scope.geo_sql
        + " AND fecha_hora >= {fecha_desde:DateTime}"
        + " AND fecha_hora <= {fecha_hasta:DateTime}"
        + " GROUP BY tipo_delito ORDER BY total DESC LIMIT 30"
    )
    sql_sector = (
        "SELECT sector_zona AS distrito, tipo_delito, toUInt32(count()) AS total "
        f"FROM {FACT} WHERE 1 = 1 "
        + scope.geo_sql
        + " AND fecha_hora >= {fecha_desde:DateTime}"
        + " AND fecha_hora <= {fecha_hasta:DateTime}"
        + " AND sector_zona != ''"
        + " GROUP BY sector_zona, tipo_delito"
        + " ORDER BY total DESC LIMIT 100"
    )
    try:
        por_tipo = execute_readonly(sql_tipo, params)
        por_distrito = execute_readonly(sql_sector, params)
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "filtros": {
                "fecha_desde": fecha_desde.isoformat(),
                "fecha_hasta": fecha_hasta.isoformat(),
            },
            "por_tipo": [
                {"tipo_delito": r.get("tipo_delito") or "Sin clasificar", "total": int(r.get("total") or 0)}
                for r in por_tipo
            ],
            "por_distrito": [
                {
                    "distrito": r.get("distrito") or "",
                    "tipo_delito": r.get("tipo_delito") or "Sin clasificar",
                    "total": int(r.get("total") or 0),
                }
                for r in por_distrito
            ],
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def partes_auditoria(request):
    """Auditoría de lectura: partes policiales de la zona (ClickHouse)."""
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
        limit = min(max(int(request.query_params.get("limit", 50)), 1), 500)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    q = (request.query_params.get("q") or "").strip()
    params = {**scope.geo_params, "limit": limit}
    clauses = ""
    if fecha_desde:
        clauses += " AND fecha_hora >= {fecha_desde:DateTime}"
        params["fecha_desde"] = datetime.combine(fecha_desde, datetime.min.time())
    if fecha_hasta:
        clauses += " AND fecha_hora <= {fecha_hasta:DateTime}"
        params["fecha_hasta"] = datetime.combine(
            fecha_hasta, datetime.max.time().replace(microsecond=0)
        )
    if q:
        clauses += (
            " AND ("
            "positionCaseInsensitive(numero_caso, {q:String}) > 0 OR "
            "positionCaseInsensitive(titulo, {q:String}) > 0 OR "
            "positionCaseInsensitive(tipo_delito, {q:String}) > 0 OR "
            "positionCaseInsensitive(agente, {q:String}) > 0"
            ")"
        )
        params["q"] = q

    sql = (
        "SELECT parte_id, numero_caso, titulo, tipo_delito, fecha_hora, prioridad, "
        "lugar, sector_zona, estado_revision, agente, latitud, longitud "
        f"FROM {FACT} WHERE 1 = 1 "
        + scope.geo_sql
        + clauses
        + " ORDER BY fecha_hora DESC"
        + " LIMIT {limit:UInt32}"
    )
    try:
        rows = execute_readonly(sql, params)
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    partes = []
    for r in rows:
        fh = r.get("fecha_hora")
        partes.append(
            {
                "parte_id": int(r.get("parte_id") or 0),
                "numero_caso": r.get("numero_caso") or "",
                "titulo": r.get("titulo") or "",
                "tipo_delito": r.get("tipo_delito") or "",
                "fecha_hora": fh.isoformat() if hasattr(fh, "isoformat") else str(fh or ""),
                "prioridad": r.get("prioridad") or "",
                "lugar": r.get("lugar") or "",
                "sector_zona": r.get("sector_zona") or "",
                "estado_revision": r.get("estado_revision") or "",
                "agente": r.get("agente") or "",
                "latitud": float(r["latitud"]) if r.get("latitud") is not None else None,
                "longitud": float(r["longitud"]) if r.get("longitud") is not None else None,
            }
        )

    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "total": len(partes),
            "partes": partes,
        }
    )
