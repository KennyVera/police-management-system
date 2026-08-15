"""PDF de personal asignado a una zona/jurisdicción."""

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
OK = colors.HexColor("#047857")


def build_zona_personal_pdf(data: dict[str, Any], *, emisor: str = "Administrador") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.3 * cm,
        bottomMargin=1.3 * cm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "T", parent=styles["Heading1"], textColor=PURPLE, fontSize=15, spaceAfter=4
    )
    sub = ParagraphStyle(
        "S", parent=styles["Normal"], textColor=MUTED, fontSize=9, spaceAfter=8
    )
    cell = ParagraphStyle("C", parent=styles["Normal"], fontSize=8, leading=11)

    jur = data.get("jurisdiccion") or {}
    jefe = data.get("jefe_zona") or {}
    personal = data.get("personal") or []

    story = [
        Paragraph("CrimeTrack · Detalle de zona", title),
        Paragraph(
            f"{jur.get('tipo_label') or 'Zona'}: <b>{jur.get('nombre') or '—'}</b> "
            f"({jur.get('codigo') or '—'})",
            sub,
        ),
        Paragraph(
            f"Jefe / Líder: {jefe.get('nombre') or '— Sin asignar —'} · "
            f"Total personal: {data.get('total', len(personal))} · Emitido por {emisor}",
            sub,
        ),
        Spacer(1, 0.35 * cm),
    ]

    rows = [
        [
            Paragraph("<b>Nombre</b>", cell),
            Paragraph("<b>Rol</b>", cell),
            Paragraph("<b>Correo</b>", cell),
            Paragraph("<b>Placa</b>", cell),
            Paragraph("<b>Estado</b>", cell),
        ]
    ]
    for u in personal:
        nombre = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip() or (
            u.get("email") or "—"
        )
        rows.append(
            [
                Paragraph(nombre, cell),
                Paragraph(u.get("role_label") or u.get("role") or "—", cell),
                Paragraph(u.get("email") or "—", cell),
                Paragraph(u.get("placa") or "—", cell),
                Paragraph(u.get("estado") or "—", cell),
            ]
        )

    if len(rows) == 1:
        rows.append(
            [
                Paragraph("Sin personal asignado a esta zona.", cell),
                "",
                "",
                "",
                "",
            ]
        )

    table = Table(rows, colWidths=[4.2 * cm, 3.6 * cm, 4.4 * cm, 2.2 * cm, 2.2 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f8f6ff")],
                ),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buf.getvalue()
