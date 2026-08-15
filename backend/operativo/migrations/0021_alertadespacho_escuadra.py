# Generated manually for escuadra on AlertaDespacho

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("operativo", "0020_asignaciondiaria_poligono"),
    ]

    operations = [
        migrations.AddField(
            model_name="alertadespacho",
            name="escuadra",
            field=models.ForeignKey(
                blank=True,
                help_text="Escuadra asignada al auxilio (todos los integrantes reciben la alerta).",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="alertas_despacho",
                to="operativo.escuadra",
            ),
        ),
    ]
