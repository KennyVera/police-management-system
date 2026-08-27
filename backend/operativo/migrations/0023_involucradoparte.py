# Generated manually for InvolucradoParte

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("operativo", "0022_asignacioncaso_fiscal"),
    ]

    operations = [
        migrations.CreateModel(
            name="InvolucradoParte",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("SOSPECHOSO", "Sospechoso inicial"),
                            ("VICTIMA", "Víctima"),
                            ("TESTIGO", "Testigo"),
                            ("DENUNCIANTE", "Denunciante"),
                            ("OTRO", "Otra persona"),
                        ],
                        max_length=20,
                    ),
                ),
                ("nombres", models.CharField(max_length=150)),
                ("apellidos", models.CharField(blank=True, max_length=150)),
                ("cedula", models.CharField(blank=True, max_length=20)),
                ("alias", models.CharField(blank=True, max_length=120)),
                (
                    "genero",
                    models.CharField(
                        choices=[
                            ("NO_ESPECIFICADO", "No especificado"),
                            ("MASCULINO", "Masculino"),
                            ("FEMENINO", "Femenino"),
                            ("OTRO", "Otro"),
                        ],
                        default="NO_ESPECIFICADO",
                        max_length=20,
                    ),
                ),
                ("telefono", models.CharField(blank=True, max_length=40)),
                ("direccion", models.CharField(blank=True, max_length=255)),
                ("observaciones", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "parte",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="involucrados",
                        to="operativo.parteaprehension",
                    ),
                ),
            ],
            options={
                "verbose_name": "Involucrado de parte",
                "verbose_name_plural": "Involucrados de parte",
                "ordering": ["tipo", "id"],
            },
        ),
    ]
