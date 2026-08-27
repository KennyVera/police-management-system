"""
PDFs de Reportes Estratégicos (Visor Ejecutivo) con contenido demo rico.
Sustituir bloques DEMO_* por consultas reales MinIO/ClickHouse cuando exista ETL.
"""

from __future__ import annotations

from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

VIOLET = colors.HexColor("#3d2a6d")
VIOLET_SOFT = colors.HexColor("#ede9fe")
SLATE = colors.HexColor("#1f2937")
MUTED = colors.HexColor("#6b7280")
GREEN = colors.HexColor("#166534")
RED = colors.HexColor("#991b1b")
AMBER = colors.HexColor("#92400e")
GRID = colors.HexColor("#d1d5db")
ROW_ALT = colors.HexColor("#f8fafc")


def _styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "veCoverKicker",
            parent=base["Normal"],
            fontSize=9,
            textColor=VIOLET,
            fontName="Helvetica-Bold",
            spaceAfter=4,
        ),
        "cover_title": ParagraphStyle(
            "veCoverTitle",
            parent=base["Heading1"],
            fontSize=20,
            textColor=VIOLET,
            leading=24,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "veH2",
            parent=base["Heading2"],
            fontSize=12,
            textColor=VIOLET,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "veH3",
            parent=base["Heading3"],
            fontSize=10,
            textColor=SLATE,
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "veBody",
            parent=base["Normal"],
            fontSize=9.5,
            leading=13,
            textColor=SLATE,
            alignment=TA_JUSTIFY,
            spaceAfter=4,
        ),
        "muted": ParagraphStyle(
            "veMuted",
            parent=base["Normal"],
            fontSize=8.5,
            textColor=MUTED,
            spaceAfter=3,
        ),
        "kpi": ParagraphStyle(
            "veKpi",
            parent=base["Normal"],
            fontSize=9,
            textColor=SLATE,
            alignment=TA_CENTER,
            leading=12,
        ),
        "footer": ParagraphStyle(
            "veFooter",
            parent=base["Normal"],
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "bullet": ParagraphStyle(
            "veBullet",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            textColor=SLATE,
        ),
    }


def _header_table(titulo: str, username: str, periodo: str) -> Table:
    s = _styles()
    now = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    data = [
        [
            Paragraph("CRIMETRACK · VISOR EJECUTIVO", s["cover_kicker"]),
            Paragraph("CLASIFICADO · ALTO MANDO", s["muted"]),
        ],
        [
            Paragraph(titulo, s["cover_title"]),
            "",
        ],
        [
            Paragraph(
                f"<b>Periodo:</b> {periodo}<br/>"
                f"<b>Elaborado para:</b> Comandante General / Generales<br/>"
                f"<b>Solicitado por:</b> {username or '—'}<br/>"
                f"<b>Generado:</b> {now}",
                s["muted"],
            ),
            Paragraph(
                "Fuente mixta: MinIO (operativo) + "
                "ClickHouse (analítica). Datos de demostración "
                "para validación de producto.",
                s["muted"],
            ),
        ],
    ]
    t = Table(data, colWidths=[11.5 * cm, 5.5 * cm])
    t.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 1), (1, 1)),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), VIOLET_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("LINEBELOW", (0, 1), (-1, 1), 1, VIOLET),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return t


def _styled_table(rows: list[list], col_widths: list) -> Table:
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), VIOLET),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.35, GRID),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def _kpi_strip(items: list[tuple[str, str, str]]) -> Table:
    """items: (label, value, tone note)"""
    s = _styles()
    cells = []
    for label, value, note in items:
        cells.append(
            Paragraph(
                f"<b>{value}</b><br/>{label}<br/><font size='7' color='#6b7280'>{note}</font>",
                s["kpi"],
            )
        )
    t = Table([cells], colWidths=[17 / len(items) * cm] * len(items))
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), VIOLET_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, GRID),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def _bullets(texts: list[str]):
    s = _styles()
    return ListFlowable(
        [ListItem(Paragraph(t, s["bullet"]), leftIndent=8, bulletColor=VIOLET) for t in texts],
        bulletType="bullet",
        start="•",
    )


def _footer_block():
    s = _styles()
    return Paragraph(
        "Información clasificada — Uso exclusivo del Alto Mando Policial — "
        "Ley de Seguridad Pública y del Estado · CrimeTrack SaaS B2B",
        s["footer"],
    )


def _doc(buffer: BytesIO) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
    )


# ── Contenido ficticio por reporte ──────────────────────────────────────────


def build_dossier_presidencial(username: str) -> bytes:
    s = _styles()
    buf = BytesIO()
    story = []
    story.append(_header_table("Dossier Presidencial", username, "YTD 2026 (Ene–Jul) vs 2025"))
    story.append(Spacer(1, 0.45 * cm))
    story.append(
        _kpi_strip(
            [
                ("Delitos registrados", "125.430", "−8,1% vs 2025"),
                ("Tasa / 100k hab.", "712", "Meta nacional: ≤ 750"),
                ("Resolución judicial", "45%", "+5 pp vs trim. ant."),
                ("Zonas en rojo", "2 / 9", "Z8 Guayas · Z1 Esmeraldas"),
            ]
        )
    )
    story.append(Paragraph("1. Resumen ejecutivo nacional", s["h2"]))
    story.append(
        Paragraph(
            "El panorama estratégico del primer semestre 2026 muestra una <b>contracción "
            "moderada de la criminalidad agregada (−8,1%)</b> respecto al mismo periodo de 2025, "
            "impulsada por la baja de delitos patrimoniales y el sostenimiento de operaciones "
            "antinarcotráfico en el litoral. No obstante, el Alto Mando debe priorizar dos "
            "focos estructurales: (i) la concentración de homicidios en Zona 8 – Guayaquil y "
            "(ii) el desplazamiento de extorsión hacia distritos limítrofes de Zona 5.",
            s["body"],
        )
    )
    story.append(
        Paragraph(
            "La tasa de resolución de casos graves alcanzó el <b>45%</b>, por encima del umbral "
            "presidencial del 40%. El tiempo medio de cierre se deterioró a <b>28 días</b> "
            "(+3 días), señal de saturación en Fiscalía de Turno y en la capa de supervisión "
            "de partes.",
            s["body"],
        )
    )

    story.append(Paragraph("2. Mapa de calor macro (índice por zona)", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Zona", "Índice /100k", "Variación", "Delito dominante", "Semáforo"],
                ["Zona 8 – Guayaquil", "1.245", "+12%", "Sicariato / Narco", "ROJO"],
                ["Zona 9 – DMQ", "1.102", "+5%", "Extorsión", "AMARILLO"],
                ["Zona 4 – Manabí", "980", "−3%", "Robo agravado", "AMARILLO"],
                ["Zona 5 – Guayas Int.", "875", "+8%", "Extorsión", "AMARILLO"],
                ["Zona 1 – Esmeraldas", "820", "+15%", "Narcotráfico", "ROJO"],
                ["Zona 7 – El Oro", "710", "−2%", "Tráfico armas", "VERDE"],
                ["Zona 3 – Sto. Domingo", "640", "+4%", "Robo", "VERDE"],
                ["Zona 6 – Azuay", "520", "−6%", "Estafa", "VERDE"],
                ["Zona Norte (demo)", "410", "−1%", "Hurto", "VERDE"],
            ],
            [4.2 * cm, 2.4 * cm, 2.2 * cm, 4.2 * cm, 2.5 * cm],
        )
    )

    story.append(Paragraph("3. Matriz de delitos de alto impacto", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Tipología", "Casos YTD", "% del total", "Tendencia"],
                ["Narcotráfico", "43.900", "35%", "Estable"],
                ["Sicariato / Homicidios", "35.120", "28%", "Alza en Z8"],
                ["Extorsión", "22.577", "18%", "Alza en Z5/Z9"],
                ["Secuestro", "12.543", "10%", "Baja leve"],
                ["Tráfico de armas", "6.272", "5%", "Estable"],
                ["Otros delitos graves", "5.018", "4%", "Baja"],
            ],
            [5.5 * cm, 3 * cm, 3 * cm, 4 * cm],
        )
    )

    story.append(Paragraph("4. Lectura política / recomendaciones al Gobierno", s["h2"]))
    story.append(
        _bullets(
            [
                "Refuerzo inmediato de 180 efectivos y 25 patrulleros a Zona 8 (Guayaquil) "
                "durante 90 días, con métrica quincenal de homicidios.",
                "Mesa interinstitucional Extorsión (Policía + Fiscalía + SNAI) con foco "
                "Zona 5 y Zona 9; meta: −10% denuncias en 1 trimestre.",
                "Mantener el corredor antinarco del Litoral: no reducir operaciones aunque "
                "el índice agregado nacional mejore.",
                "Publicar tablero presidencial semanal (CrimeTrack Visor) con semáforo por zona.",
            ]
        )
    )
    story.append(Spacer(1, 0.6 * cm))
    story.append(_footer_block())
    _doc(buf).build(story)
    return buf.getvalue()


def build_auditoria_comandantes(username: str) -> bytes:
    s = _styles()
    buf = BytesIO()
    story = []
    story.append(
        _header_table(
            "Auditoría de Desempeño de Comandantes",
            username,
            "Trimestre II 2026 (Abr–Jun)",
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "Este informe cruza <b>fuerza logística y personal (MinIO)</b> con "
            "<b>resolución de delitos e incidentes (ClickHouse)</b> para rankear a los "
            "Jefes de Zona. El índice de eficiencia = (tasa de resolución × 0,5) + "
            "(ocupabilidad de flota × 0,2) + (inverso del SLA de aprobación × 0,3), "
            "normalizado a 100.",
            s["body"],
        )
    )
    story.append(Paragraph("1. Ranking de eficiencia de comandantes", s["h2"]))
    story.append(
        _styled_table(
            [
                ["#", "Comandante / Zona", "Efectivos", "Flota op.", "Resolución", "SLA (días)", "Índice"],
                ["1", "Cnl. M. Coronel · Zona Norte", "26", "92%", "58%", "0,9", "86"],
                ["2", "Cnl. Chelo Flor · Zona 8 GYE", "16", "78%", "41%", "1,2", "71"],
                ["3", "Tcrn. A. Rivadeneira · Z9 DMQ", "22", "85%", "47%", "1,8", "69"],
                ["4", "May. L. Cedeño · Zona 4", "18", "80%", "44%", "2,1", "64"],
                ["5", "Cnl. P. Andrade · Zona 5", "14", "70%", "38%", "2,6", "55"],
                ["6", "Tcrn. R. Mina · Zona 1", "12", "61%", "33%", "3,4", "42"],
                ["7", "Sin titular · Zona 9 vacante*", "0", "—", "—", "—", "—"],
            ],
            [1 * cm, 5.2 * cm, 1.8 * cm, 1.8 * cm, 2 * cm, 2 * cm, 1.5 * cm],
        )
    )
    story.append(
        Paragraph(
            "* Plaza de Jefe de Zona 9 – DMQ sin asignación activa en el padrón de CrimeTrack "
            "(dato demo).",
            s["muted"],
        )
    )

    story.append(Paragraph("2. Hallazgos de auditoría", s["h2"]))
    story.append(
        _bullets(
            [
                "<b>Zona Norte</b> lidera por alta resolución y SLA sub-diario; modelo a "
                "replicar en inducción de nuevos jefes.",
                "<b>Zona 8</b> sostiene volumen extremo: el índice cae por resolución (41%) "
                "no por falta de personal relativo al ranking.",
                "<b>Zona 1 – Esmeraldas</b>: flota al 61% operativa y SLA 3,4 días → cuello "
                "de botella de supervisión; requiere intervención de Inspectoría.",
                "Tres zonas con SLA ≥ 2,5 días concentran el 61% de partes observados "
                "reincidentes.",
            ]
        )
    )

    story.append(Paragraph("3. Plan de acción sugerido (90 días)", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Acción", "Responsable", "Plazo", "KPI"],
                ["Tutoría cruzada Norte → Zona 1", "Visor Ejecutivo", "30 días", "SLA &lt; 2 d"],
                ["Auditoría flota Esmeraldas", "Logística Nacional", "45 días", "Flota ≥ 80%"],
                ["Refuerzo detectives Z8", "PJ / Alto Mando", "60 días", "Resolución ≥ 48%"],
                ["Cubrir plaza Jefe Z9", "Talento Humano", "15 días", "Titular asignado"],
            ],
            [6 * cm, 4 * cm, 2.5 * cm, 3 * cm],
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(_footer_block())
    _doc(buf).build(story)
    return buf.getvalue()


def build_impacto_presupuestario(username: str) -> bytes:
    s = _styles()
    buf = BytesIO()
    story = []
    story.append(
        _header_table(
            "Análisis de Impacto Presupuestario",
            username,
            "Presupuesto 2025 ejecutado vs criminalidad 2026 YTD",
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "Relación <b>costo-beneficio</b> entre inversión logística (combustible, "
            "mantenimiento de flota, horas extra y tecnología CrimeTrack) y la "
            "reducción porcentual de criminalidad observada. Cifras en USD demo.",
            s["body"],
        )
    )
    story.append(
        _kpi_strip(
            [
                ("Inversión YTD", "USD 18,4 M", "Logística + TI"),
                ("Reducción delitos", "−8,1%", "vs YTD 2025"),
                ("Costo / delito evitado", "USD 1.620", "Benchmark: 2.100"),
                ("ROI estimado", "1 : 2,4", "Beneficio social"),
            ]
        )
    )

    story.append(Paragraph("1. Inversión por rubro", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Rubro", "Presupuesto", "Ejecutado", "%", "Notas"],
                ["Flota / mantenimiento", "6,2 M", "5,8 M", "94%", "Taller saturado Z1"],
                ["Combustible / patrullaje", "4,1 M", "4,4 M", "107%", "Sobrecosto Z8"],
                ["Horas extra / refuerzos", "3,5 M", "3,1 M", "89%", "Operativos litoral"],
                ["CrimeTrack + analítica", "2,0 M", "1,9 M", "95%", "SaaS + ClickHouse"],
                ["Capacitación mando", "1,2 M", "0,9 M", "75%", "Subejecución"],
                ["Contingencia", "1,4 M", "0,7 M", "50%", "Disponible"],
            ],
            [4.5 * cm, 2.5 * cm, 2.5 * cm, 1.5 * cm, 4.5 * cm],
        )
    )

    story.append(Paragraph("2. Costo-beneficio por zona", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Zona", "Inversión", "Δ criminalidad", "Delitos evitados*", "USD / evitado"],
                ["Zona Norte", "1,1 M", "−11%", "1.240", "887"],
                ["Zona 6 – Azuay", "0,9 M", "−9%", "780", "1.154"],
                ["Zona 7 – El Oro", "1,3 M", "−6%", "610", "2.131"],
                ["Zona 8 – GYE", "4,8 M", "+12%**", "—", "Sin retorno neto"],
                ["Zona 1 – Esmeraldas", "2,2 M", "+15%**", "—", "Sin retorno neto"],
                ["Resto zonas", "8,1 M", "−7% avg", "6.900", "1.174"],
            ],
            [3.8 * cm, 2.2 * cm, 2.8 * cm, 3 * cm, 3.5 * cm],
        )
    )
    story.append(
        Paragraph(
            "* Estimación contra baseline 2025. ** Zonas con alza: la inversión no ha "
            "compensado el shock de violencia; se recomienda reasignar 12% del "
            "presupuesto de contingencia hacia Z8/Z1.",
            s["muted"],
        )
    )

    story.append(Paragraph("3. Recomendaciones presupuestarias", s["h2"]))
    story.append(
        _bullets(
            [
                "Reasignar USD 1,1 M de contingencia a refuerzo táctico Z8/Z1 (Q3 2026).",
                "Congelar expansión de flota en zonas VERDE; priorizar mantenimiento "
                "predictivo donde ocupación &gt; 90%.",
                "Completar ejecución de capacitación de mando (subejecución 25%) antes "
                "de Q4 para mejorar SLA de aprobación.",
                "Mantener línea CrimeTrack: costo unitario de delito evitado ya está "
                "25% bajo el benchmark regional.",
            ]
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(_footer_block())
    _doc(buf).build(story)
    return buf.getvalue()


def build_cuellos_botella(username: str) -> bytes:
    s = _styles()
    buf = BytesIO()
    story = []
    story.append(
        _header_table(
            "Informe de Cuellos de Botella (Impunidad)",
            username,
            "Últimos 90 días · trazabilidad de partes",
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "Trazabilidad de <b>tiempos muertos</b> entre la creación del parte por el "
            "agente, el envío a revisión y la aprobación final del supervisor. Un SLA "
            "≥ 3 días se considera cuello de botella de impunidad operativa.",
            s["body"],
        )
    )
    story.append(
        _kpi_strip(
            [
                ("SLA nacional", "1,9 días", "Meta: ≤ 1,5"),
                ("Partes &gt; 3 días", "18%", "Riesgo impunidad"),
                ("Observados reincide.", "7,4%", "Calidad agente"),
                ("Zonas críticas", "Z1 · Z5", "SLA 3,4 / 2,6 d"),
            ]
        )
    )

    story.append(Paragraph("1. Embudo de aprobación (nacionales)", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Etapa", "Volumen", "% del ingreso", "Tiempo medio"],
                ["Partes creados (agente)", "14.820", "100%", "—"],
                ["Enviados a revisión", "13.105", "88%", "4,2 h"],
                ["Aprobados 1.ª vuelta", "9.870", "67%", "1,1 d"],
                ["Observados", "2.410", "16%", "—"],
                ["Reenviados y aprobados", "1.680", "11%", "+2,3 d"],
                ["Pendientes &gt; 72 h", "825", "6%", "Riesgo"],
            ],
            [5.5 * cm, 2.5 * cm, 3 * cm, 4.5 * cm],
        )
    )

    story.append(Paragraph("2. Ranking de cuellos por zona / supervisor", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Zona", "Supervisor (demo)", "Cola actual", "SLA días", "Diagnóstico"],
                ["Zona 1", "Cap. J. Quiñónez", "142", "3,4", "Sobrecarga + flota baja"],
                ["Zona 5", "Tnte. M. Solís", "98", "2,6", "Turnos sin respaldo"],
                ["Zona 8", "Cap. D. Paredes", "210", "1,2", "Alto volumen, SLA OK"],
                ["Zona 4", "Tnte. K. Vera", "55", "2,1", "Capacitación pendiente"],
                ["Zona Norte", "Cap. S. Álvarez", "18", "0,9", "Referente"],
            ],
            [2.8 * cm, 4 * cm, 2.2 * cm, 2 * cm, 4.5 * cm],
        )
    )

    story.append(Paragraph("3. Causas raíz (pareto demo)", s["h2"]))
    story.append(
        _bullets(
            [
                "42% — Supervisor único en turno nocturno sin delegado de calidad.",
                "27% — Partes incompletos (evidencia multimedia / georreferencia).",
                "18% — Retrabajo por observaciones reiteradas del mismo agente.",
                "13% — Incidentes de conectividad / sincronización CrimeTrack móvil.",
            ]
        )
    )

    story.append(Paragraph("4. Medidas anti-impunidad (inmediato)", s["h2"]))
    story.append(
        _bullets(
            [
                "Activar segundo supervisor de calidad en Zona 1 y Zona 5 (turno 18:00–06:00).",
                "Checklist obligatorio en app del agente antes de «Enviar a revisión».",
                "Alerta automática al Jefe de Zona cuando un parte supera 48 h en cola.",
                "Meta Q3: reducir cola &gt; 72 h del 6% al 2%.",
            ]
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(_footer_block())
    _doc(buf).build(story)
    return buf.getvalue()


def build_desplazamiento_criminal(username: str) -> bytes:
    s = _styles()
    buf = BytesIO()
    story = []
    story.append(
        _header_table(
            "Reporte de Desplazamiento Criminal",
            username,
            "Análisis macro-espacial · Ene–Jul 2026",
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "Detección de <b>migración delictiva entre zonas colindantes</b>: cuando la "
            "presión operativa baja el delito en un distrito, parte del volumen reaparece "
            "en vecinos (efecto globo). Metodología demo: correlación de series semanales "
            "ClickHouse + adyacencia territorial.",
            s["body"],
        )
    )
    story.append(
        _kpi_strip(
            [
                ("Corredores activos", "4", "Alta confianza"),
                ("Delitos desplazados", "~6.800", "Estimación YTD"),
                ("Corredor crítico", "Z8 → Z5", "Extorsión +12%"),
                ("Alerta temprana", "Z9 Norte", "Vigilancia 30 d"),
            ]
        )
    )

    story.append(Paragraph("1. Corredores de desplazamiento detectados", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Origen → Destino", "Tipología", "Δ origen", "Δ destino", "Confianza", "Lag"],
                ["Z8 Guayaquil → Z5 Guayas Int.", "Extorsión", "−9%", "+14%", "Alta", "2 sem"],
                ["Z8 Sur → Z7 El Oro", "Tráfico armas", "−6%", "+11%", "Media", "3 sem"],
                ["Z1 Esmeraldas → Z4 Manabí", "Narcotráfico", "−4%", "+8%", "Alta", "1 sem"],
                ["Z9 Centro → Z9 Norte*", "Robo agravado", "−12%", "+10%", "Media", "2 sem"],
                ["Z6 Azuay → Z3 Sto. Domingo", "Estafa", "−5%", "+3%", "Baja", "4 sem"],
            ],
            [4.5 * cm, 2.8 * cm, 2 * cm, 2 * cm, 2.2 * cm, 1.8 * cm],
        )
    )
    story.append(
        Paragraph(
            "* Desplazamiento intradistrital en DMQ (misma zona, circuitos colindantes).",
            s["muted"],
        )
    )

    story.append(Paragraph("2. Lectura operativa", s["h2"]))
    story.append(
        Paragraph(
            "El corredor <b>Z8 → Z5</b> es el de mayor impacto político: la baja de "
            "extorsión en Guayaquil coincide con el alza en cantones interiores de Guayas. "
            "Sin operación espejo en Z5, el éxito táctico de Z8 se traduce en "
            "exportación del delito. El corredor <b>Z1 → Z4</b> sugiere reacomodo de "
            "rutas marítimas/terrestres tras operativos en Esmeraldas.",
            s["body"],
        )
    )

    story.append(Paragraph("3. Matriz de respuesta coordinada", s["h2"]))
    story.append(
        _styled_table(
            [
                ["Corredor", "Acción conjunta", "Mando", "Horizonte"],
                ["Z8 ↔ Z5", "Patrullaje espejo + inteligencia financiera", "Z8+Z5", "Inmediato"],
                ["Z1 ↔ Z4", "Controles interprovinciales aleatorios", "Z1+Z4", "15 días"],
                ["Z8 ↔ Z7", "Barrido de armas en pasos fronterizos", "Z7 lead", "30 días"],
                ["Z9 interno", "Refuerzo circuitos norte DMQ", "Z9", "21 días"],
            ],
            [3 * cm, 7 * cm, 2.5 * cm, 3 * cm],
        )
    )

    story.append(Paragraph("4. Indicadores de seguimiento (tablero Visor)", s["h2"]))
    story.append(
        _bullets(
            [
                "Índice de desplazamiento semanal por corredor (umbral alerta: +8% destino "
                "con −5% origen en 14 días).",
                "Mapa de calor binacional de tipologías en fronteras de zona.",
                "Reporte automático al Alto Mando cada lunes 07:00 desde ClickHouse.",
            ]
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(_footer_block())
    _doc(buf).build(story)
    return buf.getvalue()


BUILDERS = {
    "dossier-presidencial": build_dossier_presidencial,
    "auditoria-comandantes": build_auditoria_comandantes,
    "impacto-presupuestario": build_impacto_presupuestario,
    "cuellos-botella": build_cuellos_botella,
    "desplazamiento-criminal": build_desplazamiento_criminal,
}


def build_reporte_pdf(slug: str, username: str) -> bytes:
    builder = BUILDERS.get(slug)
    if not builder:
        raise ValueError(f"Reporte desconocido: {slug}")
    return builder(username)
