"""PDF de reportes financieros (reportlab)."""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


PURPLE = colors.HexColor("#7c5cbf")
LINE = colors.HexColor("#e8ecf3")
MUTED = colors.HexColor("#6b7280")


def build_reporte_pdf(data: dict[str, Any], *, nivel: str, emisor: str = "SuperAdmin") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=1.6 * cm, rightMargin=1.6 * cm,
        topMargin=1.4 * cm, bottomMargin=1.4 * cm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "T", parent=styles["Heading1"], textColor=PURPLE, fontSize=16, spaceAfter=4
    )
    sub = ParagraphStyle("S", parent=styles["Normal"], textColor=MUTED, fontSize=9, spaceAfter=12)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=11, textColor=PURPLE, spaceBefore=10)

    story = [
        Paragraph("CrimeTrack · Reporte financiero", title),
        Paragraph(f"Nivel: {nivel.upper()} · Emitido por {emisor}", sub),
    ]
    periodo = data.get("periodo") or {}
    story.append(Paragraph(f"Periodo: {periodo}", sub))

    kpis = data.get("kpis") or {}
    kpi_rows = [["Indicador", "Valor"]] + [[str(k), str(v)] for k, v in kpis.items()]
    t = Table(kpi_rows, colWidths=[9 * cm, 7 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f6ff")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([Paragraph("Indicadores", h2), t, Spacer(1, 0.4 * cm)])

    for key, label, cols in (
        ("por_plan", "Ingresos por plan", ["plan", "ingresos"]),
        ("por_institucion", "Ingresos por institución", ["institucion", "ingresos"]),
        ("evolucion_mensual", "Evolución mensual", ["mes", "ingresos"]),
    ):
        rows = data.get(key) or []
        if not rows:
            continue
        table_data = [cols] + [[str(r.get(c, "")) for c in cols] for r in rows]
        tb = Table(table_data, colWidths=[10 * cm, 6 * cm])
        tb.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1ebff")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([Paragraph(label, h2), tb])

    doc.build(story)
    return buf.getvalue()
