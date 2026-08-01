from io import BytesIO

from operativo.minio_service import upload_evidencia


def generar_pdf_parte(parte) -> dict:
    """Genera PDF del parte aprobado y lo sube a MinIO."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 2 * cm

    def line(txt, size=11, gap=16, bold=False):
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(2 * cm, y, str(txt)[:110])
        y -= gap
        if y < 2 * cm:
            c.showPage()
            y = height - 2 * cm

    line("SISTEMA DE GESTIÓN POLICIAL — PARTE APROBADO", 14, 22, bold=True)
    line(f"Nº caso: {parte.numero_caso or parte.id}", 12, 18, bold=True)
    line(f"Título: {parte.titulo or '—'}")
    line(f"Tipo de delito: {parte.tipo_delito.nombre if parte.tipo_delito_id else '—'}")
    line(f"Código IUCR: {parte.codigo_iucr or '—'}")
    line(f"Clasificación FBI: {parte.clasificacion_fbi or '—'}")
    line(f"Fecha del hecho: {parte.fecha_hecho} {parte.hora_hecho or ''}")
    line(
        f"Prioridad: {parte.get_prioridad_display()} · Riesgo: {parte.get_nivel_riesgo_display()}"
    )
    line(f"Lugar: {parte.lugar}")
    line(f"Sector/zona: {parte.sector_zona or '—'}")
    line(f"Fuente: {parte.get_fuente_reporte_display()}")
    line(
        f"Heridos: {parte.get_hay_heridos_display()} · Armas: {parte.get_hay_armas_display()}"
    )
    line(f"GPS: {parte.latitud}, {parte.longitud}")
    line(f"Oficial: {parte.creado_por.get_full_name() or parte.creado_por.username}")
    line("Descripción:", 11, 14, bold=True)
    desc = (parte.descripcion or parte.relato_hechos or "").strip() or "—"
    for chunk in [desc[i : i + 95] for i in range(0, len(desc), 95)]:
        line(chunk, 10, 13)
    line("", 10, 10)
    line("Documento bloqueado tras aprobación del Supervisor.", 10, 14, bold=True)
    line(f"Aprobado el: {parte.aprobado_en}", 10, 13)
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    filename = f"{parte.numero_caso or f'parte-{parte.id}'}.pdf"
    return upload_evidencia(
        file_bytes=pdf_bytes,
        filename=filename,
        content_type="application/pdf",
        folder="partes-aprobados",
    )
