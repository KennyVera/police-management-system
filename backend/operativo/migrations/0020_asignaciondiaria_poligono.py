# Generated manually for poligono on AsignacionDiaria

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operativo", "0019_saas_multitenant"),
    ]

    operations = [
        migrations.AddField(
            model_name="asignaciondiaria",
            name="poligono",
            field=models.JSONField(
                blank=True,
                help_text="GeoJSON Polygon del área de patrullaje (coordenadas [lng, lat]).",
                null=True,
            ),
        ),
    ]
