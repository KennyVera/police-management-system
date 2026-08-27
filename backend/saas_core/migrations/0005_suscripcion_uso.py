# Uso / cancelación para panel Suscripción y Uso (admin institucional)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("saas_core", "0004_configuracion"),
    ]

    operations = [
        migrations.AddField(
            model_name="institucion",
            name="cancelacion_solicitada",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="institucion",
            name="cancelacion_solicitada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="factura",
            name="pdf_url",
            field=models.CharField(
                blank=True,
                default="",
                help_text="URL/archivo PDF externo (opcional). Si vacío, se genera al vuelo.",
                max_length=512,
            ),
        ),
        migrations.CreateModel(
            name="UsageLog",
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
                ("fecha", models.DateField()),
                (
                    "metrica",
                    models.CharField(
                        choices=[
                            ("partes", "Partes policiales"),
                            ("usuarios_activos", "Usuarios activos"),
                            ("almacenamiento_mb", "Almacenamiento (MB)"),
                        ],
                        max_length=40,
                    ),
                ),
                ("cantidad", models.PositiveIntegerField(default=0)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "institucion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="usage_logs",
                        to="saas_core.institucion",
                    ),
                ),
            ],
            options={
                "verbose_name": "Registro de uso",
                "verbose_name_plural": "Registros de uso",
                "ordering": ["fecha", "metrica"],
                "unique_together": {("institucion", "fecha", "metrica")},
            },
        ),
    ]
