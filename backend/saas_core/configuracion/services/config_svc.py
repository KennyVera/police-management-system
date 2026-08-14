"""Servicio singleton de configuración + auditoría de cambios."""

from __future__ import annotations

from django.conf import settings

from saas_core.models import ConfigAuditoria, ConfiguracionPlataforma

SECCIONES = {
    "identidad": [
        "nombre_sistema",
        "nombre_comercial",
        "descripcion",
        "favicon_url",
        "logo_url",
        "empresa_nombre",
        "empresa_ruc",
        "empresa_direccion",
        "empresa_telefono",
        "empresa_web",
    ],
    "apariencia": [
        "color_principal",
        "color_secundario",
        "logo_login_url",
        "logo_reportes_url",
        "personalizacion_visual",
    ],
    "regional": [
        "zona_horaria",
        "formato_fecha",
        "formato_hora",
        "moneda",
        "idioma",
    ],
    "comunicaciones": [
        "correo_remitente",
        "nombre_remitente",
        "plantillas_correo",
        "notificaciones_globales",
        "notificaciones_mensaje",
    ],
    "plataforma": [
        "version_actual",
        "modo_mantenimiento",
        "mensaje_mantenimiento",
        "terminos_url",
        "privacidad_url",
    ],
}


def get_config() -> ConfiguracionPlataforma:
    return ConfiguracionPlataforma.get_solo()


def serialize_seccion(cfg: ConfiguracionPlataforma, seccion: str) -> dict:
    fields = SECCIONES[seccion]
    data = {f: getattr(cfg, f) for f in fields}
    if seccion == "comunicaciones":
        data["smtp_password_configured"] = bool(
            getattr(settings, "EMAIL_HOST_PASSWORD", "") or ""
        )
        data["smtp_host"] = getattr(settings, "EMAIL_HOST", "smtp.gmail.com")
        data["smtp_hint"] = (
            "La contraseña de aplicación se configura en el archivo .env "
            "como EMAIL_HOST_PASSWORD (nunca se guarda en la base)."
        )
    return data


def apply_seccion(seccion: str, payload: dict, actor=None) -> dict:
    if seccion not in SECCIONES:
        raise ValueError("Sección inválida")
    cfg = get_config()
    allowed = set(SECCIONES[seccion])
    updates = []
    for key, new_val in payload.items():
        if key not in allowed:
            continue
        old = getattr(cfg, key)
        # normalize bools from JSON
        if isinstance(old, bool):
            new_val = bool(new_val)
        if str(old) == str(new_val):
            continue
        setattr(cfg, key, new_val)
        updates.append((key, old, new_val))
    if updates:
        cfg.save()
        for key, old, new in updates:
            ConfigAuditoria.objects.create(
                seccion=seccion,
                campo=key,
                valor_anterior=str(old) if old is not None else "",
                valor_nuevo=str(new) if new is not None else "",
                actor=actor if getattr(actor, "is_authenticated", False) else None,
            )
    return serialize_seccion(cfg, seccion)
