# Generated manually for AsignacionCaso + notificación tipos

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("operativo", "0021_alertadespacho_escuadra"),
    ]

    operations = [
        migrations.CreateModel(
            name="AsignacionCaso",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("PENDIENTE_FISCAL", "Pendiente de revisión fiscal"),
                            ("DESPACHO_ADMIN", "Despacho administrativo"),
                            ("EN_INVESTIGACION", "Indagación previa (detective asignado)"),
                            ("CERRADO", "Cerrado"),
                        ],
                        default="PENDIENTE_FISCAL",
                        max_length=30,
                    ),
                ),
                (
                    "decision_notas",
                    models.TextField(
                        blank=True,
                        help_text="Fundamento jurídico / observaciones del Fiscal.",
                    ),
                ),
                ("decidido_en", models.DateTimeField(blank=True, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "detective",
                    models.ForeignKey(
                        blank=True,
                        help_text="Detective asignado si se abre indagación previa.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="casos_como_detective",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "expediente",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asignaciones_fiscales",
                        to="operativo.expedientecaso",
                    ),
                ),
                (
                    "fiscal",
                    models.ForeignKey(
                        blank=True,
                        help_text="Fiscal de turno que toma la decisión.",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="casos_como_fiscal",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "parte",
                    models.OneToOneField(
                        help_text="Parte policial aprobado que ingresa a Fiscalía.",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asignacion_caso",
                        to="operativo.parteaprehension",
                    ),
                ),
            ],
            options={
                "verbose_name": "Asignación de caso (Fiscalía)",
                "verbose_name_plural": "Asignaciones de caso (Fiscalía)",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.AlterField(
            model_name="notificacion",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("PARTE_RECHAZADO", "Parte rechazado"),
                    ("PARTE_APROBADO", "Parte aprobado"),
                    ("EXPEDIENTE_ASIGNADO", "Expediente asignado"),
                    ("DISPOSICION_ZONA", "Disposición de zona"),
                    ("ALERTA", "Alerta"),
                    ("SISTEMA", "Sistema"),
                    ("PARTE_FISCAL", "Parte remitido a Fiscalía"),
                    ("CASO_FISCAL", "Caso asignado por Fiscal"),
                ],
                default="SISTEMA",
                max_length=40,
            ),
        ),
    ]
