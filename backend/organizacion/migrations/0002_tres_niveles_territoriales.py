from django.db import migrations, models


def remap_tipos_obsoletos(apps, schema_editor):
    Jurisdiction = apps.get_model("organizacion", "Jurisdiction")
    Jurisdiction.objects.filter(tipo__in=("CIRCUITO", "SUBCIRCUITO")).update(
        tipo="DISTRITO"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("organizacion", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(remap_tipos_obsoletos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="jurisdiction",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("ZONA", "Zona"),
                    ("SUBZONA", "Subzona (provincia)"),
                    ("DISTRITO", "Distrito (cantón)"),
                ],
                max_length=20,
            ),
        ),
    ]
