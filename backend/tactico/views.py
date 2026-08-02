"""APIs de Inteligencia Táctica (proxy Django → ClickHouse)."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from tactico.permissions import EsJefeDeZona
from tactico.services.clickhouse_client import ClickHouseReadOnlyError, execute_readonly
from tactico.services.geo_scope import ZoneScopeError, resolve_zone_scope
from tactico.services import panel_queries as panel

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
    distrito = (request.query_params.get("distrito") or "").strip()
    try:
        limit = min(max(int(request.query_params.get("limit", 2000)), 1), 10000)
    except ValueError:
        return Response({"detail": "limit inválido."}, status=status.HTTP_400_BAD_REQUEST)

    dia_semana = None
    hora = None
    raw_dow = request.query_params.get("dia_semana")
    raw_hora = request.query_params.get("hora")
    try:
        if raw_dow not in (None, ""):
            dia_semana = int(raw_dow)
        if raw_hora not in (None, ""):
            hora = int(raw_hora)
    except ValueError:
        return Response(
            {"detail": "dia_semana/hora inválidos."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        puntos = panel.mapa_puntos(
            scope,
            fecha_desde,
            fecha_hasta,
            distrito=distrito,
            tipo_delito=tipo,
            dia_semana=dia_semana,
            hora=hora,
            limit=limit,
        )
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
                "tipo_delito": tipo or None,
                "distrito": distrito or None,
                "dia_semana": dia_semana,
                "hora": hora,
            },
            "total_puntos": len(puntos),
            "puntos": puntos,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def panel_dashboard(request):
    """
    Panel completo del Jefe de Zona: KPIs, evolución, tipología, ranking, radar.
    Query: fecha_desde, fecha_hasta, distrito, tipo_delito.
    """
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    distrito = (request.query_params.get("distrito") or "").strip()
    tipo = (request.query_params.get("tipo_delito") or "").strip()

    try:
        data = panel.build_panel(
            request.user,
            scope,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            distrito=distrito,
            tipo_delito=tipo,
        )
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error armando panel táctico: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response(data)


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def ranking_distritos(request):
    """
    Ranking de partes policiales agrupados por sub-jurisdicción (sector_zona).

    Query params opcionales: fecha_desde, fecha_hasta, distrito, tipo_delito, limit.
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

    distrito = (request.query_params.get("distrito") or "").strip()
    tipo = (request.query_params.get("tipo_delito") or "").strip()
    desde, hasta = panel.parse_range(fecha_desde, fecha_hasta)

    try:
        eficiencia = panel.ranking_eficiencia(
            scope,
            desde,
            hasta,
            distrito=distrito,
            tipo_delito=tipo,
            limit=limit,
        )
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
            "distrito": r["distrito"],
            "total_partes": r["delitos"],
            "arrestos": r["arrestos"],
            "partes_criticos": 0,
            "tipos_delito": len(r.get("top_tipos") or []),
            "agentes_reportantes": None,
            "nivel": r["nivel"],
            "cuadrante": r["cuadrante"],
            "sparkline": r["sparkline"],
            "tendencia": r["tendencia"],
        }
        for idx, r in enumerate(eficiencia, start=1)
    ]
    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "filtros": {
                "fecha_desde": desde.isoformat(),
                "fecha_hasta": hasta.isoformat(),
                "distrito": distrito or None,
                "tipo_delito": tipo or None,
            },
            "ranking": ranking,
            "ranking_eficiencia": eficiencia,
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

    distrito = (request.query_params.get("distrito") or "").strip()
    tipo = (request.query_params.get("tipo_delito") or "").strip()

    try:
        por_tipo = panel.tipologia(
            scope, fecha_desde, fecha_hasta, distrito=distrito, tipo_delito=tipo, limit=30
        )
        por_distrito_raw = panel.ranking_distritos_barras(
            scope, fecha_desde, fecha_hasta, distrito=distrito, tipo_delito=tipo, limit=50
        )
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    por_distrito = []
    for row in por_distrito_raw:
        tops = row.get("top_tipos") or ["—"]
        por_distrito.append(
            {
                "distrito": row["distrito"],
                "tipo_delito": tops[0] if tops else "—",
                "total": row["total"],
                "nivel": row["nivel"],
            }
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
                "distrito": distrito or None,
                "tipo_delito": tipo or None,
            },
            "por_tipo": por_tipo,
            "por_distrito": por_distrito,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def partes_auditoria(request):
    """Auditoría de lectura: partes policiales de la zona (ClickHouse), paginado."""
    scope, err = _scope_or_error(request)
    if err:
        return err

    try:
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
        page = max(1, int(request.query_params.get("page") or 1))
        page_size = min(max(int(request.query_params.get("page_size") or 10), 1), 50)
        # compat: limit legacy → page_size
        if request.query_params.get("limit") and not request.query_params.get("page_size"):
            page_size = min(max(int(request.query_params.get("limit")), 1), 50)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    q = (request.query_params.get("q") or "").strip()
    prioridad = (request.query_params.get("prioridad") or "").strip().upper()
    estado = (request.query_params.get("estado") or "").strip().upper()

    params = {**scope.geo_params}
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
            "positionCaseInsensitive(agente, {q:String}) > 0 OR "
            "positionCaseInsensitive(sector_zona, {q:String}) > 0 OR "
            "positionCaseInsensitive(lugar, {q:String}) > 0"
            ")"
        )
        params["q"] = q
    if prioridad:
        clauses += " AND upperUTF8(prioridad) = {prioridad:String}"
        params["prioridad"] = prioridad
    if estado:
        clauses += " AND upperUTF8(estado_revision) = {estado:String}"
        params["estado"] = estado

    where = " WHERE 1 = 1 " + scope.geo_sql + clauses
    count_sql = f"SELECT toUInt32(uniqExact(parte_id)) AS c FROM {FACT}{where}"
    offset = (page - 1) * page_size
    params_page = {**params, "limit": page_size, "offset": offset}

    # LIMIT 1 BY parte_id evita duplicados del ETL; luego pagina
    sql = (
        "SELECT parte_id, numero_caso, titulo, tipo_delito, fecha_hora, prioridad, "
        "lugar, sector_zona, estado_revision, agente, latitud, longitud "
        f"FROM {FACT}{where}"
        " ORDER BY fecha_hora DESC"
        " LIMIT 1 BY parte_id"
        " LIMIT {limit:UInt32} OFFSET {offset:UInt32}"
    )
    try:
        count_rows = execute_readonly(count_sql, params)
        total = int((count_rows[0] or {}).get("c") or 0) if count_rows else 0
        total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
        if page > total_pages:
            page = total_pages
            offset = (page - 1) * page_size
            params_page["offset"] = offset
        rows = execute_readonly(sql, params_page) if total else []
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
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "total": total,  # compat
            "partes": partes,
            "results": partes,  # compat unwrapPage
        }
    )
