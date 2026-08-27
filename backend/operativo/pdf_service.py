"""PDF profesional del parte policial (ReportLab)."""

from __future__ import annotations

from io import BytesIO
from urllib.parse import urlparse
from urllib.request import urlopen

from django.utils import timezone

from operativo.minio_service import download_object, upload_evidencia

IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}

# Paleta (navy + púrpura institucional)
NAVY = (0.07, 0.15, 0.31)  # #12284F
PURPLE = (0.42, 0.30, 0.70)  # #6B4DB3
PURPLE_SOFT = (0.93, 0.90, 0.98)
GRAY = (0.35, 0.38, 0.45)
DARK = (0.12, 0.14, 0.20)
FOOTER_BG = (0.93, 0.90, 0.98)
WHITE = (1, 1, 1)
ORANGE = (0.90, 0.55, 0.13)


def _rgb(c, color):
    c.setFillColorRGB(*color)
    c.setStrokeColorRGB(*color)


def _proxy_object_key(url: str, prefixes: tuple[str, ...]) -> str | None:
    if not url:
        return None
    path = urlparse(url).path if "://" in url else url
    for prefix in prefixes:
        if path.startswith(prefix):
            return path[len(prefix) :].lstrip("/")
    return None


def _load_image_bytes(raw: bytes):
    """Normaliza imagen a JPEG para ReportLab."""
    from reportlab.lib.utils import ImageReader

    buf = BytesIO(raw)
    try:
        from PIL import Image

        pil = Image.open(buf)
        if pil.mode not in ("RGB", "L"):
            pil = pil.convert("RGB")
        out = BytesIO()
        pil.save(out, format="JPEG", quality=88)
        out.seek(0)
        return ImageReader(out)
    except Exception:
        buf.seek(0)
        return ImageReader(buf)


def _load_branding_logo():
    try:
        from saas_core.configuracion.services.config_svc import get_config

        cfg = get_config()
        proxy = (cfg.logo_reportes_url or cfg.logo_url or "").strip()
        key = _proxy_object_key(
            proxy,
            ("/api/saas/branding/", "api/saas/branding/"),
        )
        if key:
            return _load_image_bytes(download_object(key))
    except Exception:
        return None
    return None


def _load_user_avatar(user):
    if not user:
        return None
    try:
        profile = getattr(user, "profile", None)
        proxy = (getattr(profile, "avatar_url", None) or "").strip()
        key = _proxy_object_key(
            proxy,
            ("/api/auth/avatars/", "api/auth/avatars/"),
        )
        if key:
            return _load_image_bytes(download_object(key))
    except Exception:
        return None
    return None


def _user_label(user) -> str:
    if not user:
        return "—"
    return (user.get_full_name() or "").strip() or user.username


def _user_role_label(user) -> str:
    if not user:
        return ""
    profile = getattr(user, "profile", None)
    role = getattr(profile, "role", None) or ""
    mapping = {
        "SUPERVISOR_UNIDAD": "Supervisor",
        "AGENTE_OPERATIVO": "Agente operativo",
        "DIRECTOR_ZONA": "Jefe de zona",
        "FISCAL": "Fiscal",
        "DETECTIVE": "Detective",
        "ADMIN_SISTEMA": "Administrador",
        "SUPERADMIN_SAAS": "Superadmin",
        "VISOR_EJECUTIVO": "Visor ejecutivo",
    }
    if role in mapping:
        return mapping[role]
    # Prefer label from choices
    try:
        from accounts.models import SystemRole

        return SystemRole(role).label
    except Exception:
        return role.replace("_", " ").title() if role else "Usuario"


def _wrap_text(c, text, x, y, max_width, font="Helvetica", size=9, leading=12, color=DARK):
    from reportlab.pdfbase.pdfmetrics import stringWidth

    _rgb(c, color)
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
    c.drawString(x, y, line)
    return y - leading


def _fmt_size(n):
    n = int(n or 0)
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def _fetch_static_map(lat, lng, w=280, h=160):
    """Mapa estático opcional (OpenStreetMap). Falla en silencio si no hay red."""
    try:
        url = (
            "https://staticmap.openstreetmap.de/staticmap.php"
            f"?center={lat},{lng}&zoom=15&size={w}x{h}"
            f"&markers={lat},{lng},purpled-pushpin"
        )
        with urlopen(url, timeout=4) as resp:
            raw = resp.read()
        if raw:
            return _load_image_bytes(raw)
    except Exception:
        return None
    return None


def build_pdf_bytes(parte, generado_por=None) -> bytes:
    """PDF del parte con logo institucional y foto del generador."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    left = 1.6 * cm
    right = width - 1.6 * cm
    usable = right - left
    page_num = {"n": 0}
    total_pages_hint = 2  # se corrige en footer dinámico vía page_num

    generador = generado_por or getattr(parte, "revisado_por", None) or getattr(
        parte, "creado_por", None
    )
    gen_name = _user_label(generador)
    gen_role = _user_role_label(generador)
    gen_when = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    logo = _load_branding_logo()
    avatar = _load_user_avatar(generador)
    estado = parte.get_estado_revision_display()

    def draw_header(titulo_doc: str):
        band_h = 2.55 * cm
        _rgb(c, NAVY)
        c.rect(0, height - band_h, width, band_h, fill=1, stroke=0)

        # Logo
        logo_sz = 1.55 * cm
        lx = left
        ly = height - band_h + 0.45 * cm
        logo_ok = False
        if logo:
            try:
                c.drawImage(
                    logo,
                    lx,
                    ly,
                    width=logo_sz,
                    height=logo_sz,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                logo_ok = True
            except Exception:
                logo_ok = False
        if not logo_ok:
            _rgb(c, WHITE)
            c.circle(lx + logo_sz / 2, ly + logo_sz / 2, logo_sz / 2 - 1, fill=1, stroke=0)
            _rgb(c, NAVY)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(lx + logo_sz / 2, ly + logo_sz / 2 - 3, "CT")

        tx = left + logo_sz + 0.45 * cm
        _rgb(c, WHITE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(tx, height - 1.05 * cm, "SISTEMA DE GESTIÓN POLICIAL")
        c.setFont("Helvetica", 8.5)
        c.drawString(tx, height - 1.55 * cm, titulo_doc)

        # Avatar + supervisor
        av = 1.25 * cm
        ax = right - av
        ay = height - band_h + 0.6 * cm
        if avatar:
            try:
                # Clip circular aproximado con máscara
                c.saveState()
                p = c.beginPath()
                p.circle(ax + av / 2, ay + av / 2, av / 2)
                c.clipPath(p, stroke=0)
                c.drawImage(avatar, ax, ay, width=av, height=av, mask="auto")
                c.restoreState()
            except Exception:
                _rgb(c, (0.75, 0.78, 0.85))
                c.circle(ax + av / 2, ay + av / 2, av / 2, fill=1, stroke=0)
        else:
            _rgb(c, (0.55, 0.60, 0.72))
            c.circle(ax + av / 2, ay + av / 2, av / 2, fill=1, stroke=0)
            _rgb(c, WHITE)
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(ax + av / 2, ay + av / 2 - 3, (gen_name[:1] or "?").upper())

        _rgb(c, WHITE)
        c.setFont("Helvetica-Bold", 8.5)
        name_x = ax - 0.35 * cm
        c.drawRightString(name_x, height - 0.95 * cm, gen_name[:28])
        c.setFont("Helvetica", 7.5)
        c.drawRightString(name_x, height - 1.35 * cm, gen_role)
        c.drawRightString(name_x, height - 1.75 * cm, gen_when)

    def draw_footer(page_idx: int, page_total: int | None = None):
        _rgb(c, FOOTER_BG)
        c.rect(0, 0, width, 1.35 * cm, fill=1, stroke=0)
        _rgb(c, PURPLE)
        c.setFont("Helvetica", 7.5)
        c.drawString(left, 0.55 * cm, "Documento oficial — uso institucional")
        total = page_total or max(page_idx, total_pages_hint)
        c.drawRightString(right, 0.55 * cm, f"Pág. {page_idx} de {total}")
        _rgb(c, DARK)

    def new_page(titulo_doc: str):
        if page_num["n"] > 0:
            c.showPage()
        page_num["n"] += 1
        draw_header(titulo_doc)
        return height - 3.35 * cm

    def section_title(num: int, title: str, y: float) -> float:
        if y < 4.2 * cm:
            draw_footer(page_num["n"])
            y = new_page("PARTE POLICIAL DE APREHENSIÓN")
        r = 0.28 * cm
        _rgb(c, PURPLE)
        c.circle(left + r, y + 0.05 * cm, r, fill=1, stroke=0)
        _rgb(c, WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(left + r, y - 0.02 * cm, str(num))
        _rgb(c, DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left + r * 2 + 0.35 * cm, y - 0.02 * cm, title.upper())
        # línea suave
        _rgb(c, PURPLE_SOFT)
        c.setStrokeColorRGB(*PURPLE_SOFT)
        c.setLineWidth(1)
        c.line(left, y - 0.35 * cm, right, y - 0.35 * cm)
        return y - 0.75 * cm

    def field(label, value, x, y, w=None):
        _rgb(c, GRAY)
        c.setFont("Helvetica", 7.5)
        c.drawString(x, y, label)
        _rgb(c, DARK)
        c.setFont("Helvetica-Bold", 9)
        text = str(value if value not in (None, "") else "—")
        if w:
            return _wrap_text(c, text, x, y - 0.32 * cm, w, font="Helvetica-Bold", size=9, leading=11)
        c.drawString(x, y - 0.32 * cm, text[:55])
        return y - 0.75 * cm

    def dot_label(label, value, x, y, color=ORANGE):
        _rgb(c, GRAY)
        c.setFont("Helvetica", 7.5)
        c.drawString(x, y, label)
        _rgb(c, color)
        c.circle(x + 0.12 * cm, y - 0.38 * cm, 0.12 * cm, fill=1, stroke=0)
        _rgb(c, DARK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 0.4 * cm, y - 0.42 * cm, str(value or "—"))
        return y - 0.85 * cm

    # —— Página 1 ——
    y = new_page("PARTE POLICIAL DE APREHENSIÓN")

    # Título + meta
    title = parte.titulo or f"Parte #{parte.id}"
    c.setFont("Helvetica-Bold", 16)
    _rgb(c, DARK)
    y = _wrap_text(c, title, left, y, usable, font="Helvetica-Bold", size=16, leading=18)
    y -= 0.1 * cm
    _rgb(c, GRAY)
    c.setFont("Helvetica", 9)
    c.drawString(left, y, f"N° de caso: {parte.numero_caso or parte.id}  •  Estado: ")
    from reportlab.pdfbase.pdfmetrics import stringWidth

    prefix_w = stringWidth(
        f"N° de caso: {parte.numero_caso or parte.id}  •  Estado: ", "Helvetica", 9
    )
    _rgb(c, PURPLE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left + prefix_w, y, estado)

    y -= 0.85 * cm

    # 1. Identificación
    y = section_title(1, "Identificación del caso", y)
    col1 = left
    col2 = left + usable * 0.34
    col3 = left + usable * 0.66
    row_y = y
    field("Tipo de delito", parte.tipo_delito.nombre if parte.tipo_delito_id else "—", col1, row_y)
    field("Código IUCR", parte.codigo_iucr or "—", col2, row_y)
    field("Clasificación FBI", parte.clasificacion_fbi or "—", col3, row_y, w=usable * 0.32)
    row_y -= 1.05 * cm
    fecha_txt = "—"
    if parte.fecha_hecho:
        fecha_txt = str(parte.fecha_hecho)
        if parte.hora_hecho:
            fecha_txt = f"{fecha_txt} {parte.hora_hecho}"
    field("Fecha / hora del hecho", fecha_txt, col1, row_y)
    dot_label("Prioridad", parte.get_prioridad_display(), col2, row_y)
    dot_label("Nivel de riesgo", parte.get_nivel_riesgo_display(), col3, row_y)
    row_y -= 1.05 * cm
    field("Fuente del reporte", parte.get_fuente_reporte_display(), col1, row_y)
    y = row_y - 0.95 * cm

    # 2. Lugar
    y = section_title(2, "Lugar de los hechos", y)
    map_w, map_h = 4.2 * cm, 2.6 * cm
    text_w = usable - map_w - 0.45 * cm
    map_img = None
    if parte.latitud is not None and parte.longitud is not None:
        map_img = _fetch_static_map(float(parte.latitud), float(parte.longitud))

    place_y = y
    place_y = field("Lugar del hecho", parte.lugar, left, place_y, w=text_w)
    place_y = field("Sector / zona", parte.sector_zona or "—", left, place_y, w=text_w)
    coords = (
        f"{parte.latitud}, {parte.longitud}"
        if parte.latitud is not None and parte.longitud is not None
        else "—"
    )
    place_y = field("Coordenadas GPS", coords, left, place_y, w=text_w)

    mx = right - map_w
    my = y - map_h + 0.2 * cm
    if map_img:
        try:
            c.drawImage(map_img, mx, my, width=map_w, height=map_h, preserveAspectRatio=True, mask="auto")
            _rgb(c, PURPLE)
            c.setStrokeColorRGB(*PURPLE)
            c.setLineWidth(1)
            c.rect(mx, my, map_w, map_h, fill=0, stroke=1)
        except Exception:
            map_img = None
    if not map_img:
        _rgb(c, PURPLE_SOFT)
        c.roundRect(mx, my, map_w, map_h, 6, fill=1, stroke=0)
        _rgb(c, PURPLE)
        c.setFont("Helvetica", 8)
        c.drawCentredString(mx + map_w / 2, my + map_h / 2, "Mapa no disponible")
        if coords != "—":
            c.setFont("Helvetica", 7)
            c.drawCentredString(mx + map_w / 2, my + map_h / 2 - 12, coords[:40])

    y = min(place_y, my) - 0.45 * cm

    # 3. Personas / detenido
    y = section_title(3, "Persona detenida / involucrados", y)
    sospechosos = []
    try:
        involucrados = list(parte.involucrados.all())
        sospechosos = [i for i in involucrados if i.tipo == "SOSPECHOSO"]
    except Exception:
        involucrados = []

    if parte.detenido_nombres or parte.detenido_apellidos or parte.detenido_cedula:
        det = " ".join(
            filter(None, [parte.detenido_nombres, parte.detenido_apellidos])
        ).strip()
        row_y = y
        field("Nombres", det or "—", col1, row_y)
        field("Cédula", parte.detenido_cedula or "—", col2, row_y)
        field("Edad", parte.detenido_edad if parte.detenido_edad is not None else "—", col3, row_y)
        row_y -= 1.0 * cm
        field("Derechos leídos", "Sí" if parte.derechos_leidos else "No / N/D", col1, row_y)
        y = row_y - 0.9 * cm
    elif sospechosos:
        for inv in sospechosos[:3]:
            nombre = f"{inv.nombres} {inv.apellidos}".strip()
            row_y = y
            field("Nombres", nombre, col1, row_y)
            field("Cédula", inv.cedula or "—", col2, row_y)
            field("Tipo", inv.get_tipo_display(), col3, row_y)
            y = row_y - 1.0 * cm
    else:
        field("Nombres", "—", col1, y)
        field("Cédula", "—", col2, y)
        field("Edad", "—", col3, y)
        y -= 1.0 * cm

    otros = [i for i in involucrados if i.tipo != "SOSPECHOSO"]
    if otros:
        _rgb(c, GRAY)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(left, y, f"Otras personas registradas: {len(otros)}")
        y -= 0.35 * cm
        for inv in otros[:4]:
            line = f"· {inv.get_tipo_display()}: {inv.nombres} {inv.apellidos}".strip()
            if inv.cedula:
                line += f" ({inv.cedula})"
            y = _wrap_text(c, line, left, y, usable, size=8, leading=10, color=DARK)
        y -= 0.2 * cm

    # 4. Condiciones
    y = section_title(4, "Condiciones del incidente", y)
    row_y = y
    field("Heridos", parte.get_hay_heridos_display(), col1, row_y)
    field("Armas", parte.get_hay_armas_display(), col2, row_y)
    y = row_y - 1.0 * cm

    # 5. Relato
    y = section_title(5, "Relato / descripción", y)
    desc = (parte.descripcion or parte.relato_hechos or "").strip() or "Sin relato."
    box_top = y + 0.35 * cm
    # estimar alto
    approx_lines = max(3, min(12, len(desc) // 90 + 2))
    box_h = approx_lines * 0.38 * cm + 0.5 * cm
    if y - box_h < 3.2 * cm:
        draw_footer(page_num["n"])
        y = new_page("PARTE POLICIAL DE APREHENSIÓN")
        y = section_title(5, "Relato / descripción", y)
        box_top = y + 0.35 * cm
    _rgb(c, (0.95, 0.96, 0.99))
    c.roundRect(left, y - box_h + 0.35 * cm, usable, box_h, 8, fill=1, stroke=0)
    _rgb(c, (0.75, 0.82, 0.95))
    c.setFont("Helvetica-Bold", 28)
    c.drawRightString(right - 0.35 * cm, y - 0.15 * cm, "“")
    y = _wrap_text(
        c,
        desc,
        left + 0.35 * cm,
        y - 0.15 * cm,
        usable - 0.9 * cm,
        size=9,
        leading=12,
    )
    y = min(y, box_top - box_h) - 0.35 * cm

    if parte.observaciones:
        y = section_title(6, "Observaciones", y)
        y = _wrap_text(c, parte.observaciones, left, y, usable, size=9, leading=12)
        y -= 0.25 * cm
        next_num = 7
    else:
        next_num = 6

    # Oficial
    y = section_title(next_num, "Oficial a cargo", y)
    row_y = y
    field("Agente", _user_label(parte.creado_por), col1, row_y)
    alerta_txt = parte.alerta.titulo if parte.alerta_id else "—"
    field("Alerta origen", alerta_txt, col2, row_y, w=usable * 0.55)
    y = row_y - 1.0 * cm
    if parte.revisado_por_id:
        field("Revisado por", _user_label(parte.revisado_por), col1, y)
        y -= 0.9 * cm

    draw_footer(page_num["n"])

    # —— Anexo evidencias ——
    evidencias = list(parte.multimedia.all().order_by("creado_en"))
    y = new_page("ANEXO — EVIDENCIAS INICIALES DEL PARTE")

    c.setFont("Helvetica-Bold", 12)
    _rgb(c, DARK)
    c.drawString(left, y, f"Evidencias iniciales ({len(evidencias)})")
    y -= 0.55 * cm
    _rgb(c, GRAY)
    c.setFont("Helvetica", 8.5)
    c.drawString(
        left,
        y,
        "Fotografías y archivos adjuntos al parte en el momento del registro.",
    )
    y -= 0.7 * cm
    _rgb(c, DARK)

    if not evidencias:
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(left, y, "Sin evidencias iniciales registradas para este parte.")
        y -= 0.6 * cm
    else:
        for idx, ev in enumerate(evidencias, start=1):
            if y < 7 * cm:
                draw_footer(page_num["n"])
                y = new_page("ANEXO — EVIDENCIAS INICIALES DEL PARTE")

            c.setFont("Helvetica-Bold", 10)
            _rgb(c, DARK)
            c.drawString(left, y, f"Evidencia {idx}: {ev.nombre_archivo}")
            y -= 0.38 * cm
            _rgb(c, GRAY)
            c.setFont("Helvetica", 8)
            meta = f"{ev.content_type or 'archivo'} · {_fmt_size(ev.tamanio_bytes)}"
            if ev.descripcion:
                meta += f" · {ev.descripcion}"
            c.drawString(left, y, meta[:110])
            y -= 0.35 * cm
            _rgb(c, DARK)

            ct = (ev.content_type or "").lower()
            is_image = ct in IMAGE_TYPES or (ev.nombre_archivo or "").lower().endswith(
                (".jpg", ".jpeg", ".png", ".webp", ".gif")
            )
            if is_image:
                try:
                    raw = download_object(ev.object_key, ev.bucket or None)
                    img_reader = _load_image_bytes(raw)
                    max_w, max_h = usable, 8.2 * cm
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
                    "Archivo no visualizable en PDF (referencia conservada en el sistema).",
                )
                y -= 0.55 * cm

    # Caja info documento
    if y < 4.5 * cm:
        draw_footer(page_num["n"])
        y = new_page("ANEXO — EVIDENCIAS INICIALES DEL PARTE")

    box_h = 2.2 * cm
    _rgb(c, (0.93, 0.95, 0.99))
    c.setStrokeColorRGB(0.55, 0.65, 0.85)
    c.setLineWidth(1)
    c.roundRect(left, y - box_h, usable, box_h, 8, fill=1, stroke=1)
    _rgb(c, NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(left + 0.35 * cm, y - 0.45 * cm, "Información del documento")
    _rgb(c, DARK)
    c.setFont("Helvetica", 8.5)
    c.drawString(left + 0.35 * cm, y - 0.95 * cm, f"Generado por: {gen_name} ({gen_role})")
    c.drawString(left + 0.35 * cm, y - 1.35 * cm, f"Fecha / hora: {gen_when}")
    c.drawString(
        left + 0.35 * cm,
        y - 1.75 * cm,
        "Sistema: CrimeTrack — Sistema de Gestión Policial",
    )

    draw_footer(page_num["n"], page_num["n"])
    c.save()
    return buffer.getvalue()


def generar_pdf_parte(parte, generado_por=None) -> dict:
    """Genera PDF del parte y lo sube a MinIO (aprobación definitiva)."""
    pdf_bytes = build_pdf_bytes(parte, generado_por=generado_por)
    filename = f"{parte.numero_caso or f'parte-{parte.id}'}.pdf"
    return upload_evidencia(
        file_bytes=pdf_bytes,
        filename=filename,
        content_type="application/pdf",
        folder="partes-aprobados",
    )
