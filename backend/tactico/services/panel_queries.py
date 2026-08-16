"""Consultas del panel táctico del Jefe de Zona (ClickHouse + Postgres)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from django.db.models import Q
from django.utils import timezone

from accounts.models import SystemRole
from operativo.models import AsignacionDiaria, ParteAprehension
from roles.director_zona.scope import users_in_zone
from tactico.services.clickhouse_client import execute_readonly
from tactico.services.geo_scope import ZoneScope

FACT = "police_analytics.fact_partes_policiales"

DIAS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
# ClickHouse toDayOfWeek: Monday=1 … Sunday=7


def _pct(part: float, whole: float) -> float:
    if not whole:
        return 0.0
    return round((part / whole) * 100, 1)


def _delta_pct(actual: float, anterior: float) -> float | None:
    if anterior > 0:
        return round(((actual - anterior) / anterior) * 100, 1)
    if actual > 0:
        return 100.0
    return None


def _dt_bounds(fecha_desde: date, fecha_hasta: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(fecha_desde, datetime.min.time()),
        datetime.combine(fecha_hasta, datetime.max.time().replace(microsecond=0)),
    )


def parse_range(fecha_desde: date | None, fecha_hasta: date | None) -> tuple[date, date]:
    hasta = fecha_hasta or date.today()
    desde = fecha_desde or (hasta - timedelta(days=30))
    if desde > hasta:
        desde, hasta = hasta, desde
    return desde, hasta


def previous_period(desde: date, hasta: date) -> tuple[date, date]:
    span = (hasta - desde).days + 1
    prev_hasta = desde - timedelta(days=1)
    prev_desde = prev_hasta - timedelta(days=span - 1)
    return prev_desde, prev_hasta


def build_filter_clause(
    scope: ZoneScope,
    *,
    distrito: str = "",
    tipo_delito: str = "",
    dia_semana: int | None = None,
    hora: int | None = None,
) -> tuple[str, dict[str, Any]]:
    """Fragmento AND extra + params (sin fechas)."""
    params: dict[str, Any] = {**scope.geo_params}
    clause = scope.geo_sql
    if distrito:
        clause += " AND sector_zona = {distrito:String}"
        params["distrito"] = distrito
    if tipo_delito:
        clause += " AND tipo_delito = {tipo_delito:String}"
        params["tipo_delito"] = tipo_delito
    if dia_semana is not None and 1 <= dia_semana <= 7:
        clause += " AND toDayOfWeek(fecha_hora) = {dia_semana:UInt8}"
        params["dia_semana"] = dia_semana
    if hora is not None and 0 <= hora <= 23:
        clause += " AND toHour(fecha_hora) = {hora:UInt8}"
        params["hora"] = hora
    return clause, params


def filtros_meta(scope: ZoneScope) -> dict:
    sql = f"""
    SELECT
        groupUniqArray(sector_zona) AS distritos,
        groupUniqArray(tipo_delito) AS tipos
    FROM {FACT}
    WHERE 1 = 1
      {scope.geo_sql}
      AND sector_zona != ''
    """
    rows = execute_readonly(sql, scope.geo_params)
    row = rows[0] if rows else {}
    distritos = sorted([d for d in (row.get("distritos") or []) if d])
    tipos = sorted([t for t in (row.get("tipos") or []) if t])
    # Incluir sectores del alcance aunque no haya hechos aún
    for s in scope.sectores:
        if s and s not in distritos:
            distritos.append(s)
    distritos = sorted(set(distritos))
    return {"distritos": distritos, "tipos_delito": tipos}


def count_incidentes(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
) -> int:
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1})
    sql = f"""
    SELECT toUInt32(count()) AS total
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
    """
    rows = execute_readonly(sql, params)
    return int((rows[0] if rows else {}).get("total") or 0)


def count_arrestos_pg(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
) -> int:
    """Arrestos desde Postgres (hubo_detenidos / datos de detenido)."""
    d0 = timezone.make_aware(datetime.combine(desde, datetime.min.time()))
    d1 = timezone.make_aware(datetime.combine(hasta, datetime.max.time()))
    qs = ParteAprehension.objects.filter(
        Q(sector_zona__in=scope.sectores) | Q(lugar__in=scope.sectores),
        fecha_hora__gte=d0,
        fecha_hora__lte=d1,
    ).filter(~Q(detenido_nombres="") | ~Q(detenido_apellidos="") | ~Q(detenido_cedula=""))
    if distrito:
        qs = qs.filter(Q(sector_zona=distrito) | Q(lugar__icontains=distrito))
    if tipo_delito:
        qs = qs.filter(
            Q(tipo_delito__nombre__iexact=tipo_delito) | Q(titulo__icontains=tipo_delito)
        )
    return qs.count()


def fuerza_efectiva(user) -> dict:
    hoy = timezone.localdate()
    personal = users_in_zone(user).filter(
        profile__role__in=[
            SystemRole.SUPERVISOR_UNIDAD,
            SystemRole.AGENTE_OPERATIVO,
            SystemRole.DETECTIVE,
        ]
    )
    total = personal.count()
    activos = (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True, agente__in=personal)
        .values("agente_id")
        .distinct()
        .count()
    )
    pct = round((activos / total) * 100) if total else 0
    return {
        "porcentaje": pct,
        "activos": activos,
        "total": total,
        "franco": max(total - activos, 0),
    }


ESTADO_LABELS = {
    "APROBADO": "Aprobado",
    "EN_REVISION": "Pendiente de revisión",
    "OBSERVADO": "Devuelto / observado",
    "BORRADOR": "Borrador",
}

ESTADO_TONES = {
    "APROBADO": "ok",
    "EN_REVISION": "warn",
    "OBSERVADO": "danger",
    "BORRADOR": "muted",
}


def estado_partes_resolucion(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
) -> dict:
    """
    Estado de partes y tasa de resolución desde Postgres (zona del jefe).

    Tasa de resolución = APROBADO / (APROBADO + EN_REVISION + OBSERVADO) × 100
    (excluye borradores: aún no enviados a control de calidad).
    """
    d0 = timezone.make_aware(datetime.combine(desde, datetime.min.time()))
    d1 = timezone.make_aware(datetime.combine(hasta, datetime.max.time()))
    qs = ParteAprehension.objects.filter(
        Q(sector_zona__in=scope.sectores) | Q(lugar__in=scope.sectores),
        fecha_hora__gte=d0,
        fecha_hora__lte=d1,
    )
    if distrito:
        qs = qs.filter(Q(sector_zona=distrito) | Q(lugar__icontains=distrito))
    if tipo_delito:
        qs = qs.filter(
            Q(tipo_delito__nombre__iexact=tipo_delito) | Q(titulo__icontains=tipo_delito)
        )

    from django.db.models import Count
    from django.db.models.functions import TruncDate

    raw = {
        row["estado_revision"]: int(row["c"])
        for row in qs.values("estado_revision").annotate(c=Count("id"))
    }
    order = ["APROBADO", "EN_REVISION", "OBSERVADO", "BORRADOR"]
    por_estado = []
    total = 0
    for key in order:
        n = int(raw.get(key) or 0)
        total += n
        por_estado.append(
            {
                "estado": key,
                "label": ESTADO_LABELS.get(key, key),
                "total": n,
                "pct": 0.0,
                "tone": ESTADO_TONES.get(key, "muted"),
            }
        )
    # Estados desconocidos
    for key, n in raw.items():
        if key not in order and n:
            total += int(n)
            por_estado.append(
                {
                    "estado": key,
                    "label": key,
                    "total": int(n),
                    "pct": 0.0,
                    "tone": "muted",
                }
            )
    for row in por_estado:
        row["pct"] = _pct(row["total"], total)

    aprobado = int(raw.get("APROBADO") or 0)
    pendiente = int(raw.get("EN_REVISION") or 0)
    observado = int(raw.get("OBSERVADO") or 0)
    borrador = int(raw.get("BORRADOR") or 0)
    pipeline = aprobado + pendiente + observado
    tasa = _pct(aprobado, pipeline) if pipeline else 0.0

    daily_qs = (
        qs.exclude(estado_revision=ParteAprehension.EstadoRevision.BORRADOR)
        .annotate(dia=TruncDate("fecha_hora"))
        .values("dia", "estado_revision")
        .annotate(c=Count("id"))
        .order_by("dia")
    )
    by_day: dict[str, dict[str, int]] = {}
    for row in daily_qs:
        dia = row["dia"]
        if not dia:
            continue
        key = dia.isoformat() if hasattr(dia, "isoformat") else str(dia)[:10]
        bucket = by_day.setdefault(key, {"aprobado": 0, "pendiente": 0, "observado": 0})
        est = row["estado_revision"]
        n = int(row["c"] or 0)
        if est == "APROBADO":
            bucket["aprobado"] += n
        elif est == "EN_REVISION":
            bucket["pendiente"] += n
        elif est == "OBSERVADO":
            bucket["observado"] += n

    evolucion = [
        {
            "fecha": fecha,
            "aprobado": vals["aprobado"],
            "pendiente": vals["pendiente"],
            "observado": vals["observado"],
            "total": vals["aprobado"] + vals["pendiente"] + vals["observado"],
        }
        for fecha, vals in sorted(by_day.items())
    ]

    return {
        "total": total,
        "aprobado": aprobado,
        "pendiente": pendiente,
        "observado": observado,
        "borrador": borrador,
        "pipeline": pipeline,
        "tasa_resolucion": tasa,
        "por_estado": por_estado,
        "evolucion": evolucion,
        "fuente": "postgres",
        "nota": (
            "Tasa de resolución = partes Aprobados ÷ (Aprobados + Pendientes + Devueltos). "
            "Los borradores no cuentan en la tasa."
        ),
    }


def evolucion_diaria(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
) -> list[dict]:
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1})
    sql = f"""
    SELECT
        toDate(fecha_hora) AS dia,
        toUInt32(count()) AS total
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
    GROUP BY dia
    ORDER BY dia
    """
    rows = execute_readonly(sql, params)
    by_day = {}
    for r in rows:
        dia = r.get("dia")
        key = dia.isoformat() if hasattr(dia, "isoformat") else str(dia)
        by_day[key] = int(r.get("total") or 0)
    out = []
    cur = desde
    while cur <= hasta:
        key = cur.isoformat()
        out.append({"fecha": key, "total": by_day.get(key, 0)})
        cur += timedelta(days=1)
    return out


def tipologia(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
    limit: int = 8,
) -> list[dict]:
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1, "limit": limit})
    sql = f"""
    SELECT tipo_delito, toUInt32(count()) AS total
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
    GROUP BY tipo_delito
    ORDER BY total DESC
    LIMIT {{limit:UInt32}}
    """
    rows = execute_readonly(sql, params)
    total = sum(int(r.get("total") or 0) for r in rows) or 1
    return [
        {
            "tipo_delito": r.get("tipo_delito") or "Sin clasificar",
            "total": int(r.get("total") or 0),
            "pct": _pct(int(r.get("total") or 0), total),
        }
        for r in rows
    ]


def ranking_distritos_barras(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
    limit: int = 12,
) -> list[dict]:
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1, "limit": limit})
    sql = f"""
    SELECT
        sector_zona AS distrito,
        toUInt32(count()) AS total,
        topK(3)(tipo_delito) AS top_tipos
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
      AND sector_zona != ''
    GROUP BY sector_zona
    ORDER BY total DESC
    LIMIT {{limit:UInt32}}
    """
    rows = execute_readonly(sql, params)
    totals = [int(r.get("total") or 0) for r in rows]
    avg = (sum(totals) / len(totals)) if totals else 0

    def nivel(n: int) -> str:
        if avg <= 0:
            return "bajo"
        if n >= avg * 1.5:
            return "critico"
        if n >= avg * 1.15:
            return "alto"
        if n >= avg * 0.75:
            return "medio"
        return "bajo"

    out = []
    for r in rows:
        total = int(r.get("total") or 0)
        tops = r.get("top_tipos") or []
        out.append(
            {
                "distrito": r.get("distrito") or "",
                "total": total,
                "nivel": nivel(total),
                "top_tipos": list(tops)[:3],
            }
        )
    return out


def alertas_rojas(ranking: list[dict]) -> dict:
    criticos = [r for r in ranking if r.get("nivel") == "critico"]
    return {
        "total": len(criticos),
        "distritos": [c["distrito"] for c in criticos],
    }


def mayor_impacto(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    prev_desde: date,
    prev_hasta: date,
    *,
    distrito: str = "",
) -> dict:
    actual = tipologia(scope, desde, hasta, distrito=distrito, limit=15)
    prev = {
        r["tipo_delito"]: r["total"]
        for r in tipologia(scope, prev_desde, prev_hasta, distrito=distrito, limit=30)
    }
    if not actual:
        return {
            "tipo_delito": "—",
            "total": 0,
            "pct": 0,
            "delta_pct": None,
            "nota": "Sin tipologías en el rango",
        }
    best = None
    best_score = None
    for row in actual:
        prev_n = prev.get(row["tipo_delito"], 0)
        growth = (row["total"] - prev_n) if prev_n else row["total"]
        # Prioriza el que más creció; desempate por volumen
        score = (growth, row["total"])
        if best_score is None or score > best_score:
            best_score = score
            best = row
            best_delta = _delta_pct(row["total"], prev_n)
    assert best is not None
    return {
        "tipo_delito": best["tipo_delito"],
        "total": best["total"],
        "pct": best["pct"],
        "delta_pct": best_delta,
        "nota": f"Concentra el {best['pct']}% de los casos",
    }


def radar_cronologia(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
) -> dict:
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1})
    # Buckets de 4 horas para un radar legible (6 ejes × 7 días → usamos por día + franja)
    sql = f"""
    SELECT
        toDayOfWeek(fecha_hora) AS dow,
        intDiv(toHour(fecha_hora), 4) AS franja,
        toUInt32(count()) AS total
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
    GROUP BY dow, franja
    ORDER BY dow, franja
    """
    rows = execute_readonly(sql, params)
    # También agregamos por día de semana (para radar simple de 7 puntas)
    by_dow = {i: 0 for i in range(1, 8)}
    celdas = []
    for r in rows:
        dow = int(r.get("dow") or 1)
        franja = int(r.get("franja") or 0)
        total = int(r.get("total") or 0)
        by_dow[dow] = by_dow.get(dow, 0) + total
        hora_inicio = franja * 4
        celdas.append(
            {
                "dia_semana": dow,
                "dia_label": DIAS_ES[dow - 1],
                "hora": hora_inicio,
                "franja_label": f"{hora_inicio:02d}:00–{(hora_inicio + 3):02d}:59",
                "total": total,
            }
        )
    series_dias = [
        {"dia_semana": i, "label": DIAS_ES[i - 1], "total": by_dow.get(i, 0)}
        for i in range(1, 8)
    ]
    picos = sorted(celdas, key=lambda x: x["total"], reverse=True)[:5]
    return {
        "dias": series_dias,
        "celdas": celdas,
        "picos": picos,
        "max": max([d["total"] for d in series_dias] + [0]),
    }


def mapa_puntos(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
    dia_semana: int | None = None,
    hora: int | None = None,
    limit: int = 2000,
) -> list[dict]:
    clause, params = build_filter_clause(
        scope,
        distrito=distrito,
        tipo_delito=tipo_delito,
        dia_semana=dia_semana,
        hora=hora,
    )
    d0, d1 = _dt_bounds(desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1, "limit": limit})
    sql = f"""
    SELECT
        latitud,
        longitud,
        tipo_delito,
        toUInt32(count()) AS peso
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
      AND isFinite(latitud) AND isFinite(longitud)
      AND (latitud != 0 OR longitud != 0)
    GROUP BY latitud, longitud, tipo_delito
    ORDER BY peso DESC
    LIMIT {{limit:UInt32}}
    """
    rows = execute_readonly(sql, params)
    return [
        {
            "latitud": float(r["latitud"]),
            "longitud": float(r["longitud"]),
            "peso": int(r["peso"] or 0),
            "tipo_delito": r.get("tipo_delito") or "",
        }
        for r in rows
    ]


def ranking_eficiencia(
    scope: ZoneScope,
    desde: date,
    hasta: date,
    *,
    distrito: str = "",
    tipo_delito: str = "",
    limit: int = 15,
) -> list[dict]:
    bars = ranking_distritos_barras(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito, limit=limit
    )
    # Sparklines últimos 7 días (dentro del rango o anclados a hasta)
    spark_desde = max(desde, hasta - timedelta(days=6))
    clause, params = build_filter_clause(scope, distrito=distrito, tipo_delito=tipo_delito)
    d0, d1 = _dt_bounds(spark_desde, hasta)
    params.update({"fecha_desde": d0, "fecha_hasta": d1})
    sql = f"""
    SELECT
        sector_zona AS distrito,
        toDate(fecha_hora) AS dia,
        toUInt32(count()) AS total
    FROM {FACT}
    WHERE 1 = 1
      {clause}
      AND fecha_hora >= {{fecha_desde:DateTime}}
      AND fecha_hora <= {{fecha_hasta:DateTime}}
      AND sector_zona != ''
    GROUP BY distrito, dia
    """
    spark_rows = execute_readonly(sql, params)
    spark_map: dict[str, dict[str, int]] = {}
    for r in spark_rows:
        dist = r.get("distrito") or ""
        dia = r.get("dia")
        key = dia.isoformat() if hasattr(dia, "isoformat") else str(dia)
        spark_map.setdefault(dist, {})[key] = int(r.get("total") or 0)

    out = []
    for row in bars:
        dist = row["distrito"]
        delitos = row["total"]
        arrestos = count_arrestos_pg(
            scope, desde, hasta, distrito=dist, tipo_delito=tipo_delito
        )
        # Cuadrante relativo
        if delitos >= (bars[0]["total"] * 0.5 if bars else 0) and arrestos == 0:
            cuadrante = "rojo"
        elif arrestos >= max(1, delitos * 0.4):
            cuadrante = "verde"
        elif delitos > 0 and arrestos > 0:
            cuadrante = "amarillo"
        else:
            cuadrante = "neutro"

        spark = []
        cur = spark_desde
        while cur <= hasta:
            spark.append(spark_map.get(dist, {}).get(cur.isoformat(), 0))
            cur += timedelta(days=1)
        tendencia = 0
        if len(spark) >= 2:
            tendencia = spark[-1] - spark[0]

        out.append(
            {
                "distrito": dist,
                "delitos": delitos,
                "arrestos": arrestos,
                "nivel": row["nivel"],
                "cuadrante": cuadrante,
                "sparkline": spark,
                "tendencia": tendencia,
                "top_tipos": row.get("top_tipos") or [],
            }
        )
    return out


def resumen_ejecutivo(kpis: dict, tipologia_rows: list, ranking: list) -> list[dict]:
    items = []
    impacto = kpis.get("mayor_impacto") or {}
    if impacto.get("tipo_delito") and impacto["tipo_delito"] != "—":
        delta = impacto.get("delta_pct")
        delta_txt = (
            f"{'+' if delta and delta > 0 else ''}{delta}% vs periodo anterior"
            if delta is not None
            else "sin comparación"
        )
        items.append(
            {
                "icon": "warning",
                "tone": "warn",
                "texto": f"{impacto['tipo_delito']} concentra el {impacto.get('pct', 0)}% ({delta_txt}).",
            }
        )
    alerta = kpis.get("alerta_roja") or {}
    if alerta.get("total"):
        names = ", ".join(alerta.get("distritos") or [])
        items.append(
            {
                "icon": "crisis_alert",
                "tone": "danger",
                "texto": f"{alerta['total']} distrito(s) en alerta roja: {names}.",
            }
        )
    else:
        items.append(
            {
                "icon": "verified",
                "tone": "ok",
                "texto": "Ningún distrito supera el umbral crítico en el rango.",
            }
        )
    ef = kpis.get("efectividad") or {}
    items.append(
        {
            "icon": "handshake",
            "tone": "info",
            "texto": f"Efectividad operativa: {ef.get('detenidos', 0)} detenidos registrados.",
        }
    )
    fuerza = kpis.get("fuerza_efectiva") or {}
    items.append(
        {
            "icon": "groups",
            "tone": "info",
            "texto": (
                f"Fuerza desplegada hoy: {fuerza.get('porcentaje', 0)}% "
                f"({fuerza.get('activos', 0)}/{fuerza.get('total', 0)})."
            ),
        }
    )
    if ranking:
        top = ranking[0]
        items.append(
            {
                "icon": "leaderboard",
                "tone": "info",
                "texto": f"Mayor incidencia: {top['distrito']} ({top['total']} incidentes).",
            }
        )
    return items[:5]


def build_panel(
    user,
    scope: ZoneScope,
    *,
    fecha_desde: date | None,
    fecha_hasta: date | None,
    distrito: str = "",
    tipo_delito: str = "",
) -> dict:
    desde, hasta = parse_range(fecha_desde, fecha_hasta)
    prev_desde, prev_hasta = previous_period(desde, hasta)

    total = count_incidentes(scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito)
    total_prev = count_incidentes(
        scope, prev_desde, prev_hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    arrestos = count_arrestos_pg(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    arrestos_prev = count_arrestos_pg(
        scope, prev_desde, prev_hasta, distrito=distrito, tipo_delito=tipo_delito
    )

    tip = tipologia(scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito)
    ranking = ranking_distritos_barras(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    alerta = alertas_rojas(ranking)
    impacto = mayor_impacto(
        scope, desde, hasta, prev_desde, prev_hasta, distrito=distrito
    )
    fuerza = fuerza_efectiva(user)

    # Si filtra por tipo, el "mayor impacto" es ese tipo
    if tipo_delito and tip:
        impacto = {
            "tipo_delito": tip[0]["tipo_delito"],
            "total": tip[0]["total"],
            "pct": tip[0]["pct"],
            "delta_pct": None,
            "nota": f"Filtro activo · {tip[0]['pct']}% del total filtrado",
        }

    kpis = {
        "indice_delictivo": {
            "total": total,
            "delta_pct": _delta_pct(total, total_prev),
            "hint": "Total de incidentes",
        },
        "efectividad": {
            "detenidos": arrestos,
            "delta_pct": _delta_pct(arrestos, arrestos_prev),
            "hint": "Detenidos / flagrancias",
        },
        "mayor_impacto": impacto,
        "alerta_roja": {
            "total": alerta["total"],
            "distritos": alerta["distritos"],
            "hint": "Distritos críticos",
        },
        "fuerza_efectiva": {
            **fuerza,
            "delta_pct": None,
            "hint": "Operatividad hoy",
        },
    }

    evo = evolucion_diaria(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    radar = radar_cronologia(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    eficiencia = ranking_eficiencia(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )
    estado_partes = estado_partes_resolucion(
        scope, desde, hasta, distrito=distrito, tipo_delito=tipo_delito
    )

    return {
        "jurisdiccion": {
            "id": scope.jurisdiccion_id,
            "nombre": scope.jurisdiccion_nombre,
            "codigo": scope.jurisdiccion_codigo,
        },
        "filtros": {
            "fecha_desde": desde.isoformat(),
            "fecha_hasta": hasta.isoformat(),
            "distrito": distrito or None,
            "tipo_delito": tipo_delito or None,
        },
        "meta": filtros_meta(scope),
        "kpis": kpis,
        "evolucion": evo,
        "tipologia": tip,
        "ranking_barras": ranking,
        "resumen_ejecutivo": resumen_ejecutivo(kpis, tip, ranking),
        "radar": radar,
        "ranking_eficiencia": eficiencia,
        "estado_partes": estado_partes,
        "actualizado_en": timezone.localtime().strftime("%H:%M"),
    }
