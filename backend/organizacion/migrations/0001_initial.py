from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=160)),
                ("codigo", models.CharField(max_length=40, unique=True)),
                ("descripcion", models.TextField(blank=True)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Departamento",
                "verbose_name_plural": "Departamentos",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="Jurisdiction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("ZONA", "Zona"),
                            ("SUBZONA", "Subzona"),
                            ("DISTRITO", "Distrito"),
                            ("CIRCUITO", "Circuito"),
                            ("SUBCIRCUITO", "Subcircuito"),
                        ],
                        max_length=20,
                    ),
                ),
                ("nombre", models.CharField(max_length=160)),
                ("codigo", models.CharField(max_length=40, unique=True)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="hijos",
                        to="organizacion.jurisdiction",
                    ),
                ),
            ],
            options={
                "verbose_name": "Jurisdicción",
                "verbose_name_plural": "Jurisdicciones",
                "ordering": ["tipo", "nombre"],
            },
        ),
    ]
