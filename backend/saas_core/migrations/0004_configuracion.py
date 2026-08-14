# Configuración global plataforma + auditoría

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("saas_core", "0003_facturacion"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConfiguracionPlataforma",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre_sistema", models.CharField(default="CrimeTrack", max_length=120)),
                ("nombre_comercial", models.CharField(default="CrimeTrack", max_length=120)),
                ("descripcion", models.TextField(blank=True, default="Plataforma de gestión policial multi-institucional.")),
                ("favicon_url", models.CharField(blank=True, default="", max_length=512)),
                ("logo_url", models.CharField(blank=True, default="", max_length=512)),
                ("empresa_nombre", models.CharField(blank=True, default="CrimeTrack", max_length=180)),
                ("empresa_ruc", models.CharField(blank=True, default="", max_length=40)),
                ("empresa_direccion", models.CharField(blank=True, default="", max_length=255)),
                ("empresa_telefono", models.CharField(blank=True, default="", max_length=40)),
                ("empresa_web", models.CharField(blank=True, default="", max_length=180)),
                ("color_principal", models.CharField(default="#6d4aff", max_length=20)),
                ("color_secundario", models.CharField(default="#7c5cbf", max_length=20)),
                ("logo_login_url", models.CharField(blank=True, default="", max_length=512)),
                ("logo_reportes_url", models.CharField(blank=True, default="", max_length=512)),
                ("personalizacion_visual", models.TextField(blank=True, default="", help_text="Notas o CSS ligero de personalización")),
                ("zona_horaria", models.CharField(default="America/Guayaquil", max_length=64)),
                ("formato_fecha", models.CharField(default="DD/MM/YYYY", max_length=32)),
                ("formato_hora", models.CharField(default="HH:mm", max_length=32)),
                ("moneda", models.CharField(default="USD", max_length=8)),
                ("idioma", models.CharField(default="es-EC", max_length=16)),
                ("correo_remitente", models.EmailField(default="crimetracksoporte@gmail.com", max_length=254)),
                ("nombre_remitente", models.CharField(default="CrimeTrack Soporte", max_length=120)),
                ("plantillas_correo", models.TextField(blank=True, default="Bienvenida\nRestablecer acceso\nFactura emitida\nAviso de vencimiento")),
                ("notificaciones_globales", models.BooleanField(default=True)),
                ("notificaciones_mensaje", models.TextField(blank=True, default="")),
                ("version_actual", models.CharField(default="1.0.0", max_length=32)),
                ("modo_mantenimiento", models.BooleanField(default=False)),
                ("mensaje_mantenimiento", models.TextField(blank=True, default="Estamos en mantenimiento. Volvemos pronto.")),
                ("terminos_url", models.CharField(blank=True, default="/terminos", max_length=512)),
                ("privacidad_url", models.CharField(blank=True, default="/privacidad", max_length=512)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuración de plataforma",
                "verbose_name_plural": "Configuración de plataforma",
            },
        ),
        migrations.CreateModel(
            name="ConfigAuditoria",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("seccion", models.CharField(max_length=40)),
                ("campo", models.CharField(max_length=80)),
                ("valor_anterior", models.TextField(blank=True)),
                ("valor_nuevo", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="config_auditoria",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Auditoría de configuración",
                "verbose_name_plural": "Auditoría de configuración",
                "ordering": ["-creado_en"],
            },
        ),
    ]
