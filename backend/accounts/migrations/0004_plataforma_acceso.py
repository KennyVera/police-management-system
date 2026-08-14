# Generated manually — permisos plataforma + bitácora de accesos

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0003_saas_multitenant"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="permisos_plataforma",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Permisos de plataforma para Admin institucional (códigos)",
            ),
        ),
        migrations.CreateModel(
            name="AccesoEvento",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "accion",
                    models.CharField(
                        choices=[
                            ("LOGIN", "Inicio de sesión"),
                            ("LOGOUT", "Cierre de sesión"),
                            ("EDITAR", "Editar información"),
                            ("ACTIVAR", "Activar acceso"),
                            ("DESACTIVAR", "Desactivar acceso"),
                            ("RESTABLECER", "Restablecer acceso"),
                            ("REVOCAR", "Revocar acceso"),
                            ("PERMISOS", "Cambiar permisos"),
                            ("CERRAR_SESION", "Cerrar sesión"),
                        ],
                        max_length=20,
                    ),
                ),
                ("detalle", models.TextField(blank=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="acciones_acceso_realizadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="eventos_acceso",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Evento de acceso",
                "verbose_name_plural": "Eventos de acceso",
                "ordering": ["-creado_en"],
            },
        ),
    ]
