# Generated manually for investigacion_iniciada + bitacora tipos auditoría

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operativo", "0023_involucradoparte"),
    ]

    operations = [
        migrations.AddField(
            model_name="expedientecaso",
            name="investigacion_iniciada",
            field=models.BooleanField(
                default=False,
                help_text="True cuando el detective pulsa Iniciar investigación.",
            ),
        ),
        migrations.AddField(
            model_name="expedientecaso",
            name="investigacion_iniciada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="bitacorainvestigacion",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("VIGILANCIA", "Vigilancia"),
                    ("ENTREVISTA", "Entrevista a testigo"),
                    ("DILIGENCIA", "Diligencia de campo"),
                    ("ANALISIS", "Análisis documental"),
                    ("INVOLUCRADO", "Registro de involucrado"),
                    ("EVIDENCIA", "Registro de evidencia"),
                    ("ESTADO", "Cambio de estado"),
                    ("SISTEMA", "Auditoría del sistema"),
                    ("OTRO", "Otro"),
                ],
                default="DILIGENCIA",
                max_length=20,
            ),
        ),
    ]
