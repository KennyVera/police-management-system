from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="TipoDelito",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codigo", models.CharField(max_length=40, unique=True)),
                ("nombre", models.CharField(max_length=160)),
                ("descripcion", models.TextField(blank=True)),
                ("articulo_penal", models.CharField(blank=True, max_length=120)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Tipo de delito",
                "verbose_name_plural": "Tipos de delitos",
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="CatalogoItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("MARCA_VEHICULO", "Marcas de vehículos"),
                            ("TIPO_ARMA", "Tipos de armas"),
                            ("COLOR", "Colores"),
                            ("TIPO_DROGA", "Tipos de drogas"),
                            ("OTRO", "Otro catálogo operativo"),
                        ],
                        max_length=40,
                    ),
                ),
                ("codigo", models.CharField(max_length=40)),
                ("nombre", models.CharField(max_length=160)),
                ("descripcion", models.TextField(blank=True)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Ítem de catálogo operativo",
                "verbose_name_plural": "Ítems de catálogos operativos",
                "ordering": ["tipo", "nombre"],
                "unique_together": {("tipo", "codigo")},
            },
        ),
        migrations.CreateModel(
            name="VariableGlobal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("clave", models.CharField(max_length=80, unique=True)),
                ("nombre", models.CharField(max_length=160)),
                ("valor", models.CharField(max_length=255)),
                ("unidad", models.CharField(blank=True, max_length=40)),
                ("descripcion", models.TextField(blank=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Variable global",
                "verbose_name_plural": "Variables globales",
                "ordering": ["clave"],
            },
        ),
    ]
