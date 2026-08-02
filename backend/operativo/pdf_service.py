from io import BytesIO

from django.utils import timezone

from operativo.minio_service import download_object, upload_evidencia


IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}


def _wrap_text(c, text, x, y, max_width, font="Helvetica", size=10, leading=13):
    """Dibuja texto multilínea; devuelve y final."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    c.setFont(font, size)
    words = (text or "—").replace("\r", "").split()
    if not words:
        c.drawString(x, y, "—")
        return y - leading
    line = words[0]
    for w in words[1:]:
        trial = f"{line} {w}"
        if stringWidth(trial, font, size) <= max_width:
            line = trial
        else:
            c.drawString(x, y, line)
            y -= leading
            line = w
            if y < 50:
                c.showPage()
                y = 800
                c.setFont(font, size)
    c.drawString(x, y, line)
    return y - leading


def build_pdf_bytes(parte) -> bytes:
    """PDF profesional del parte, con evidencias multimedia embebidas."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    left = 1.8 * cm
    right = width - 1.8 * cm
    usable = right - left

    def header_band(titulo_doc):
        c.setFillColorRGB(0.24, 0.16, 0.43)
        c.rect(0, height - 2.4 * cm, width, 2.4 * cm, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(left, height - 1.1 * cm, "SISTEMA DE GESTIÓN POLICIAL")
        c.setFont("Helvetica", 9)
        c.drawString(left, height - 1.7 * cm, titulo_doc)
        c.setFillColorRGB(0.15, 0.18, 0.28)

    def footer():
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.45, 0.48, 0.55)
        c.drawString(left, 1.1 * cm, "Documento oficial — uso institucional")
        c.drawRightString(
            right,
            1.1 * cm,
            f"Generado: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}",
        )
        c.setFillColorRGB(0.15, 0.18, 0.28)

    def section(title, y):
        if y < 3.5 * cm:
            footer()
            c.showPage()
            header_band("PARTE POLICIAL DE APREHENSIÓN")
            y = height - 3.2 * cm
        c.setFillColorRGB(0.93, 0.91, 0.98)
        c.roundRect(left, y - 0.15 * cm, usable, 0.7 * cm, 4, fill=1, stroke=0)
        c.setFillColorRGB(0.35, 0.25, 0.58)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left + 0.25 * cm, y + 0.05 * cm, title.upper())
        c.setFillColorRGB(0.15, 0.18, 0.28)
        return y - 0.85 * cm

    def kv(label, value, y, x2=None):
        c.setFont("Helvetica-Bold", 9)
        c.drawString(left if x2 is None else x2, y, f"{label}:")
        c.setFont("Helvetica", 9)
        c.drawString((left if x2 is None else x2) + 3.2 * cm, y, str(value or "—")[:70])
        return y - 0.45 * cm

    estado = parte.get_estado_revision_display()
    header_band(f"PARTE POLICIAL DE APREHENSIÓN · {estado}")
    y = height - 3.2 * cm

    c.setFont("Helvetica-Bold", 16)
    c.drawString(left, y, parte.titulo or f"Parte #{parte.id}")
    y -= 0.55 * cm
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.4, 0.43, 0.5)
    c.drawString(
        left,
        y,
        f"Nº caso: {parte.numero_caso or parte.id}   ·   Estado: {estado}",
    )
    c.setFillColorRGB(0.15, 0.18, 0.28)
    y -= 0.7 * cm

    y = section("1. Identificación del caso", y)
    y = kv("Tipo de delito", parte.tipo_delito.nombre if parte.tipo_delito_id else "—", y)
    mid = left + usable / 2
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left, y, "Código IUCR:")
    c.setFont("Helvetica", 9)
    c.drawString(left + 3.2 * cm, y, str(parte.codigo_iucr or "—"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(mid, y, "Clasif. FBI:")
    c.setFont("Helvetica", 9)
    c.drawString(mid + 2.4 * cm, y, str(parte.clasificacion_fbi or "—"))
    y -= 0.45 * cm
    y = kv(
        "Fecha/hora",
        f"{parte.fecha_hecho} {parte.hora_hecho or ''}".strip(),
        y,
    )
    y = kv("Prioridad", parte.get_prioridad_display(), y)
    y = kv("Nivel de riesgo", parte.get_nivel_riesgo_display(), y)
    y = kv("Fuente", parte.get_fuente_reporte_display(), y)
    y -= 0.15 * cm

    y = section("2. Lugar de los hechos", y)
    y = kv("Lugar", parte.lugar, y)
    y = kv("Sector / zona", parte.sector_zona, y)
    y = kv(
        "Coordenadas",
        f"{parte.latitud}, {parte.longitud}"
        if parte.latitud is not None and parte.longitud is not None
        else "—",
        y,
    )
    y -= 0.15 * cm

    y = section("3. Persona detenida", y)
    det = " ".join(
        filter(None, [parte.detenido_nombres, parte.detenido_apellidos])
    ).strip()
    y = kv("Nombres", det or "—", y)
    y = kv("Cédula", parte.detenido_cedula, y)
    y = kv("Edad", parte.detenido_edad, y)
    y = kv("Derechos leídos", "Sí" if parte.derechos_leidos else "No / N/D", y)
    y -= 0.15 * cm

    y = section("4. Condiciones del incidente", y)
    y = kv("Heridos", parte.get_hay_heridos_display(), y)
    y = kv("Armas", parte.get_hay_armas_display(), y)
    y -= 0.15 * cm

    y = section("5. Relato / descripción", y)
    desc = (parte.descripcion or parte.relato_hechos or "").strip() or "Sin relato."
    y = _wrap_text(c, desc, left, y, usable, size=9, leading=12)
    y -= 0.35 * cm

    if parte.observaciones:
        y = section("6. Observaciones", y)
        y = _wrap_text(c, parte.observaciones, left, y, usable, size=9, leading=12)
        y -= 0.35 * cm

    y = section("7. Oficial a cargo", y)
    oficial = parte.creado_por.get_full_name() or parte.creado_por.username
    y = kv("Agente", oficial, y)
    if parte.alerta_id:
        y = kv("Alerta origen", parte.alerta.titulo, y)
    if parte.revisado_por_id:
        y = kv(
            "Revisado por",
            parte.revisado_por.get_full_name() or parte.revisado_por.username,
            y,
        )
    if parte.aprobado_en:
        y = kv("Aprobado el", parte.aprobado_en.strftime("%d/%m/%Y %H:%M"), y)
    if parte.bloqueado:
        y = kv("Estado documental", "BLOQUEADO (inmutable)", y)

    # Evidencias iniciales del parte (imágenes embebidas + referencias)
    evidencias = list(parte.multimedia.all().order_by("creado_en"))
    footer()
    c.showPage()
    header_band("ANEXO — EVIDENCIAS INICIALES DEL PARTE")
    y = height - 3.2 * cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, f"Evidencias iniciales ({len(evidencias)})")
    y -= 0.55 * cm
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.4, 0.43, 0.5)
    c.drawString(
        left,
        y,
        "Fotografías, videos y archivos adjuntos al parte en el momento del registro.",
    )
    c.setFillColorRGB(0.15, 0.18, 0.28)
    y -= 0.7 * cm

    if not evidencias:
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(left, y, "Sin evidencias iniciales registradas para este parte.")
        y -= 0.55 * cm
    else:
        for idx, ev in enumerate(evidencias, start=1):
            if y < 6 * cm:
                footer()
                c.showPage()
                header_band("ANEXO — EVIDENCIAS INICIALES DEL PARTE")
                y = height - 3.2 * cm

            c.setFont("Helvetica-Bold", 10)
            c.drawString(left, y, f"Evidencia {idx}: {ev.nombre_archivo}")
            y -= 0.4 * cm
            c.setFont("Helvetica", 8)
            c.setFillColorRGB(0.4, 0.43, 0.5)
            c.drawString(
                left,
                y,
                f"{ev.content_type or 'archivo'} · {ev.tamanio_bytes or 0} bytes"
                + (f" · {ev.descripcion}" if ev.descripcion else ""),
            )
            c.setFillColorRGB(0.15, 0.18, 0.28)
            y -= 0.35 * cm

            ct = (ev.content_type or "").lower()
            is_image = ct in IMAGE_TYPES or ev.nombre_archivo.lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp", ".gif")
            )
            if is_image:
                try:
                    from reportlab.lib.utils import ImageReader

                    raw = download_object(ev.object_key, ev.bucket or None)
                    img_buf = BytesIO(raw)
                    try:
                        from PIL import Image

                        pil = Image.open(img_buf)
                        if pil.mode not in ("RGB", "L"):
                            pil = pil.convert("RGB")
                        out = BytesIO()
                        pil.save(out, format="JPEG", quality=85)
                        out.seek(0)
                        img_reader = ImageReader(out)
                    except Exception:
                        img_buf.seek(0)
                        img_reader = ImageReader(img_buf)

                    max_w, max_h = usable, 8.5 * cm
                    c.drawImage(
                        img_reader,
                        left,
                        y - max_h,
                        width=max_w,
                        height=max_h,
                        preserveAspectRatio=True,
                        mask="auto",
                    )
                    y -= max_h + 0.55 * cm
                except Exception:
                    c.setFont("Helvetica-Oblique", 8)
                    c.drawString(left, y, "(No se pudo incrustar la imagen en el PDF)")
                    y -= 0.5 * cm
            else:
                c.setFont("Helvetica-Oblique", 8)
                c.drawString(
                    left,
                    y,
                    "Archivo no visualizable en PDF (video/audio/documento; "
                    "referencia conservada en el sistema).",
                )
                y -= 0.55 * cm

    footer()
    c.showPage()
    c.save()
    return buffer.getvalue()


def generar_pdf_parte(parte) -> dict:
    """Genera PDF del parte y lo sube a MinIO (aprobación definitiva)."""
    pdf_bytes = build_pdf_bytes(parte)
    filename = f"{parte.numero_caso or f'parte-{parte.id}'}.pdf"
    return upload_evidencia(
        file_bytes=pdf_bytes,
        filename=filename,
        content_type="application/pdf",
        folder="partes-aprobados",
    )
