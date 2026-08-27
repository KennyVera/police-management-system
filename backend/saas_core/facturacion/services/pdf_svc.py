"""PDF de reportes financieros y facturas (reportlab)."""

from __future__ import annotations

import io
from typing import Any

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


PURPLE = colors.HexColor("#7c5cbf")
LINE = colors.HexColor("#e8ecf3")
MUTED = colors.HexColor("#6b7280")
INK = colors.HexColor("#1f2937")


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


def _money(v) -> str:
    try:
        return f"USD {float(v):,.2f}"
    except (TypeError, ValueError):
        return str(v or "—")


def _d(v) -> str:
    if not v:
        return "—"
    if hasattr(v, "strftime"):
        return v.strftime("%d/%m/%Y")
    return str(v)[:10]


def build_factura_pdf(factura, *, emisor: str = "SuperAdmin") -> bytes:
    """PDF de factura individual para descarga desde SuperAdmin."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=factura.numero,
        author="CrimeTrack SaaS",
    )
    styles = getSampleStyleSheet()
    brand = ParagraphStyle(
        "Brand", parent=styles["Normal"], textColor=PURPLE,
        fontName="Helvetica-Bold", fontSize=10, spaceAfter=2,
    )
    title = ParagraphStyle(
        "FacTitle", parent=styles["Heading1"], textColor=INK,
        fontSize=18, spaceAfter=4, leading=22,
    )
    muted = ParagraphStyle(
        "FacMuted", parent=styles["Normal"], textColor=MUTED, fontSize=9, leading=12,
    )
    body = ParagraphStyle(
        "FacBody", parent=styles["Normal"], textColor=INK, fontSize=10, leading=13,
    )
    big = ParagraphStyle(
        "FacBig", parent=styles["Normal"], textColor=PURPLE,
        fontName="Helvetica-Bold", fontSize=16, alignment=2,
    )

    inst = factura.institucion
    plan = factura.plan
    estado = (
        factura.get_estado_display()
        if hasattr(factura, "get_estado_display")
        else factura.estado
    )
    modalidad = (
        factura.get_modalidad_display()
        if hasattr(factura, "get_modalidad_display")
        else factura.modalidad
    )

    head = Table(
        [[
            [
                Paragraph("CRIMETRACK SaaS", brand),
                Paragraph("FACTURA", title),
                Paragraph(f"N.º <b>{factura.numero}</b>", body),
            ],
            [
                Paragraph(str(estado).upper(), big),
                Paragraph(f"Emitida: {_d(factura.fecha_emision)}", muted),
                Paragraph(f"Vence: {_d(factura.fecha_vencimiento)}", muted),
            ],
        ]],
        colWidths=[10.5 * cm, 5.5 * cm],
    )
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))

    email = (
        getattr(inst, "email_facturacion", None)
        or getattr(inst, "email_contacto", None)
        or getattr(inst, "email", None)
        or "—"
    )
    cliente = Table(
        [
            ["Facturar a", "Detalle del servicio"],
            [
                Paragraph(
                    f"<b>{inst.nombre_comercial}</b><br/>"
                    f"RUC: {inst.ruc or '—'}<br/>"
                    f"{email}",
                    body,
                ),
                Paragraph(
                    f"Plan: <b>{plan.nombre if plan else '—'}</b><br/>"
                    f"Modalidad: {modalidad}<br/>"
                    f"Periodo: {_d(factura.periodo_inicio)} → {_d(factura.periodo_fin)}<br/>"
                    f"Método: {factura.metodo_pago or '—'}",
                    body,
                ),
            ],
        ],
        colWidths=[8 * cm, 8 * cm],
    )
    cliente.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1ebff")),
        ("TEXTCOLOR", (0, 0), (-1, 0), PURPLE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))

    concepto = (
        f"Suscripción {plan.nombre if plan else 'CrimeTrack'} "
        f"({_d(factura.periodo_inicio)} – {_d(factura.periodo_fin)})"
    )
    items = Table(
        [
            ["Concepto", "Cant.", "Precio", "Total"],
            [concepto, "1", _money(factura.monto), _money(factura.monto)],
        ],
        colWidths=[8.5 * cm, 2 * cm, 2.75 * cm, 2.75 * cm],
    )
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))

    totales = Table(
        [
            ["Subtotal", _money(factura.monto)],
            ["Impuestos", "USD 0.00"],
            ["TOTAL", _money(factura.monto)],
        ],
        colWidths=[4 * cm, 3.5 * cm],
        hAlign="RIGHT",
    )
    totales.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, -1), (-1, -1), PURPLE),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PURPLE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    nota = factura.nota or (
        "Gracias por confiar en CrimeTrack. Documento generado para uso interno / facturación B2B."
    )
    if factura.estado == "ANULADA" and factura.anulado_motivo:
        nota = f"ANULADA: {factura.anulado_motivo}"

    now = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    story = [
        head,
        Spacer(1, 0.35 * cm),
        HRFlowable(width="100%", thickness=1, color=PURPLE, spaceAfter=10),
        cliente,
        Spacer(1, 0.55 * cm),
        Paragraph(
            "Detalle",
            ParagraphStyle("H", parent=styles["Heading2"], fontSize=11, textColor=PURPLE),
        ),
        items,
        Spacer(1, 0.45 * cm),
        totales,
        Spacer(1, 0.7 * cm),
        Paragraph(f"<b>Notas:</b> {nota}", muted),
        Spacer(1, 1.2 * cm),
        Paragraph(
            f"Generado por {emisor} · {now} · CrimeTrack SuperAdmin · Clasificado",
            muted,
        ),
    ]
    doc.build(story)
    return buf.getvalue()
