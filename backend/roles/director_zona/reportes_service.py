"""Reportes de zona (PDF / Excel) a partir de ClickHouse, con aislamiento geográfico."""

from __future__ import annotations

import io
from datetime import date, datetime, timedelta
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from tactico.services.clickhouse_client import execute_readonly
from tactico.services.geo_scope import ZoneScope

FACT = "police_analytics.fact_partes_policiales"


def _dt_bounds(fecha_desde: date | None, fecha_hasta: date | None):
    hasta = fecha_hasta or date.today()
    desde = fecha_desde or (hasta - timedelta(days=30))
    return (
        desde,
        hasta,
        datetime.combine(desde, datetime.min.time()),
        datetime.combine(hasta, datetime.max.time().replace(microsecond=0)),
    )


def collect_zone_report_data(
    scope: ZoneScope,
    *,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    audiencia: str = "ALTO_MANDO",
) -> dict[str, Any]:
    """Agrega KPIs tácticos de la zona desde ClickHouse (solo lectura)."""
    desde, hasta, dt_desde, dt_hasta = _dt_bounds(fecha_desde, fecha_hasta)
    params = {
        **scope.geo_params,
        "fecha_desde": dt_desde,
        "fecha_hasta": dt_hasta,
    }
    date_clause = (
        " AND fecha_hora >= {fecha_desde:DateTime}"
        " AND fecha_hora <= {fecha_hasta:DateTime}"
    )

    stats_sql = (
        "SELECT "
        "countIf(toYYYYMM(fecha_hora) = toYYYYMM(today())) AS mes_actual, "
        "countIf(toYYYYMM(fecha_hora) = toYYYYMM(addMonths(today(), -1))) AS mes_anterior, "
        "toUInt32(count()) AS total_rango "
        f"FROM {FACT} WHERE 1 = 1 " + scope.geo_sql + date_clause
    )
    tipo_sql = (
        "SELECT tipo_delito, toUInt32(count()) AS total "
        f"FROM {FACT} WHERE 1 = 1 " + scope.geo_sql + date_clause
        + " GROUP BY tipo_delito ORDER BY total DESC LIMIT 25"
    )
    dist_sql = (
        "SELECT sector_zona AS distrito, toUInt32(count()) AS total_partes, "
        "toUInt32(countIf(upper(prioridad) IN ('ALTA','CRITICA','ALTO','CRITICO'))) AS criticos "
        f"FROM {FACT} WHERE 1 = 1 " + scope.geo_sql + date_clause
        + " AND sector_zona != '' GROUP BY sector_zona ORDER BY total_partes DESC LIMIT 30"
    )

    stats = execute_readonly(stats_sql, params)
    por_tipo = execute_readonly(tipo_sql, params)
    por_distrito = execute_readonly(dist_sql, params)
    row = stats[0] if stats else {}

    return {
        "audiencia": audiencia,
        "generado_en": datetime.now().isoformat(timespec="seconds"),
        "jurisdiccion": {
            "id": scope.jurisdiccion_id,
            "nombre": scope.jurisdiccion_nombre,
            "codigo": scope.jurisdiccion_codigo,
        },
        "periodo": {
            "fecha_desde": desde.isoformat(),
            "fecha_hasta": hasta.isoformat(),
        },
        "resumen": {
            "total_rango": int(row.get("total_rango") or 0),
            "mes_actual": int(row.get("mes_actual") or 0),
            "mes_anterior": int(row.get("mes_anterior") or 0),
        },
        "por_tipo": [
            {
                "tipo_delito": r.get("tipo_delito") or "Sin clasificar",
                "total": int(r.get("total") or 0),
            }
            for r in por_tipo
        ],
        "por_distrito": [
            {
                "distrito": r.get("distrito") or "",
                "total_partes": int(r.get("total_partes") or 0),
                "criticos": int(r.get("criticos") or 0),
            }
            for r in por_distrito
        ],
    }


def build_zone_report_pdf(data: dict[str, Any], *, titulo: str, emisor: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleZona",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#2f4d8a"),
        spaceAfter=8,
    )
    body = []
    audiencia = data.get("audiencia") or "ALTO_MANDO"
    audiencia_label = (
        "Alto Mando / Visor Ejecutivo"
        if audiencia == "ALTO_MANDO"
        else "Autoridades civiles (Gobernación / Alcaldía / Prefectura)"
    )
    jur = data.get("jurisdiccion") or {}
    periodo = data.get("periodo") or {}
    resumen = data.get("resumen") or {}

    body.append(Paragraph(titulo, title_style))
    body.append(Paragraph(f"<b>Audiencia:</b> {audiencia_label}", styles["Normal"]))
    body.append(
        Paragraph(
            f"<b>Jurisdicción:</b> {jur.get('nombre') or '—'} ({jur.get('codigo') or '—'})",
            styles["Normal"],
        )
    )
    body.append(
        Paragraph(
            f"<b>Periodo:</b> {periodo.get('fecha_desde')} → {periodo.get('fecha_hasta')}",
            styles["Normal"],
        )
    )
    body.append(Paragraph(f"<b>Elaborado por:</b> {emisor}", styles["Normal"]))
    body.append(Paragraph(f"<b>Generado:</b> {data.get('generado_en')}", styles["Normal"]))
    body.append(Spacer(1, 0.4 * cm))
    body.append(Paragraph("Resumen operativo", styles["Heading2"]))
    body.append(
        Paragraph(
            f"Total de partes en el periodo: <b>{resumen.get('total_rango', 0)}</b><br/>"
            f"Mes calendario actual: <b>{resumen.get('mes_actual', 0)}</b> · "
            f"Mes anterior: <b>{resumen.get('mes_anterior', 0)}</b>",
            styles["Normal"],
        )
    )
    body.append(Spacer(1, 0.35 * cm))

    body.append(Paragraph("Delitos por tipo", styles["Heading2"]))
    tipo_rows = [["Tipo de delito", "Total"]] + [
        [r["tipo_delito"], str(r["total"])] for r in data.get("por_tipo") or []
    ]
    if len(tipo_rows) == 1:
        tipo_rows.append(["Sin datos", "0"])
    t1 = Table(tipo_rows, colWidths=[12 * cm, 3 * cm])
    t1.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f4d8a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    body.append(t1)
    body.append(Spacer(1, 0.4 * cm))

    body.append(Paragraph("Ranking por distrito / sector", styles["Heading2"]))
    dist_rows = [["Distrito", "Partes", "Críticos"]] + [
        [r["distrito"], str(r["total_partes"]), str(r["criticos"])]
        for r in data.get("por_distrito") or []
    ]
    if len(dist_rows) == 1:
        dist_rows.append(["Sin datos", "0", "0"])
    t2 = Table(dist_rows, colWidths=[9 * cm, 3 * cm, 3 * cm])
    t2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    body.append(t2)
    body.append(Spacer(1, 0.5 * cm))
    body.append(
        Paragraph(
            "<i>Documento generado automáticamente por el Módulo de Inteligencia Táctica. "
            "Los datos están filtrados exclusivamente a la jurisdicción del emisor "
            "(aislamiento geográfico).</i>",
            styles["Normal"],
        )
    )
    doc.build(body)
    return buffer.getvalue()


def build_zone_report_excel(data: dict[str, Any]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "Resumen"
    jur = data.get("jurisdiccion") or {}
    periodo = data.get("periodo") or {}
    resumen = data.get("resumen") or {}
    ws.append(["Informe de seguridad de zona"])
    ws.append(["Jurisdicción", jur.get("nombre") or ""])
    ws.append(["Código", jur.get("codigo") or ""])
    ws.append(["Audiencia", data.get("audiencia") or ""])
    ws.append(["Desde", periodo.get("fecha_desde") or ""])
    ws.append(["Hasta", periodo.get("fecha_hasta") or ""])
    ws.append(["Generado", data.get("generado_en") or ""])
    ws.append([])
    ws.append(["Total periodo", resumen.get("total_rango", 0)])
    ws.append(["Mes actual", resumen.get("mes_actual", 0)])
    ws.append(["Mes anterior", resumen.get("mes_anterior", 0)])
    ws["A1"].font = Font(bold=True, size=14, color="2F4D8A")

    ws2 = wb.create_sheet("Por tipo")
    ws2.append(["Tipo de delito", "Total"])
    for r in data.get("por_tipo") or []:
        ws2.append([r["tipo_delito"], r["total"]])

    ws3 = wb.create_sheet("Por distrito")
    ws3.append(["Distrito", "Partes", "Críticos"])
    for r in data.get("por_distrito") or []:
        ws3.append([r["distrito"], r["total_partes"], r["criticos"]])

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
