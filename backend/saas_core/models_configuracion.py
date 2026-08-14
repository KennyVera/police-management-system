"""Configuración global de la plataforma CrimeTrack (singleton + auditoría)."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class ConfiguracionPlataforma(models.Model):
    """Parámetros generales SaaS. Una sola fila (pk=1)."""

    # Identidad
    nombre_sistema = models.CharField(max_length=120, default="CrimeTrack")
    nombre_comercial = models.CharField(max_length=120, default="CrimeTrack")
    descripcion = models.TextField(
        blank=True,
        default="Plataforma de gestión policial multi-institucional.",
    )
    favicon_url = models.CharField(max_length=512, blank=True, default="")
    logo_url = models.CharField(max_length=512, blank=True, default="")
    empresa_nombre = models.CharField(max_length=180, blank=True, default="CrimeTrack")
    empresa_ruc = models.CharField(max_length=40, blank=True, default="")
    empresa_direccion = models.CharField(max_length=255, blank=True, default="")
    empresa_telefono = models.CharField(max_length=40, blank=True, default="")
    empresa_web = models.CharField(max_length=180, blank=True, default="")

    # Apariencia
    color_principal = models.CharField(max_length=20, default="#6d4aff")
    color_secundario = models.CharField(max_length=20, default="#7c5cbf")
    logo_login_url = models.CharField(max_length=512, blank=True, default="")
    logo_reportes_url = models.CharField(max_length=512, blank=True, default="")
    personalizacion_visual = models.TextField(
        blank=True,
        default="",
        help_text="Notas o CSS ligero de personalización",
    )

    # Regional
    zona_horaria = models.CharField(max_length=64, default="America/Guayaquil")
    formato_fecha = models.CharField(max_length=32, default="DD/MM/YYYY")
    formato_hora = models.CharField(max_length=32, default="HH:mm")
    moneda = models.CharField(max_length=8, default="USD")
    idioma = models.CharField(max_length=16, default="es-EC")

    # Comunicaciones (password SMTP solo en .env)
    correo_remitente = models.EmailField(default="crimetracksoporte@gmail.com")
    nombre_remitente = models.CharField(max_length=120, default="CrimeTrack Soporte")
    plantillas_correo = models.TextField(
        blank=True,
        default="Bienvenida\nRestablecer acceso\nFactura emitida\nAviso de vencimiento",
    )
    notificaciones_globales = models.BooleanField(default=True)
    notificaciones_mensaje = models.TextField(blank=True, default="")

    # Plataforma
    version_actual = models.CharField(max_length=32, default="1.0.0")
    modo_mantenimiento = models.BooleanField(default=False)
    mensaje_mantenimiento = models.TextField(
        blank=True,
        default="Estamos en mantenimiento. Volvemos pronto.",
    )
    terminos_url = models.CharField(max_length=512, blank=True, default="/terminos")
    privacidad_url = models.CharField(max_length=512, blank=True, default="/privacidad")

    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración de plataforma"
        verbose_name_plural = "Configuración de plataforma"

    def __str__(self) -> str:
        return f"{self.nombre_sistema} ({self.version_actual})"

    @classmethod
    def get_solo(cls) -> "ConfiguracionPlataforma":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class ConfigAuditoria(models.Model):
    """Historial de cambios de configuración global."""

    seccion = models.CharField(max_length=40)
    campo = models.CharField(max_length=80)
    valor_anterior = models.TextField(blank=True)
    valor_nuevo = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="config_auditoria",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Auditoría de configuración"
        verbose_name_plural = "Auditoría de configuración"

    def __str__(self) -> str:
        return f"{self.seccion}.{self.campo}"
