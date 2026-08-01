# Generated manually for bootstrap — run makemigrations when models evolve.
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="HealthCheck",
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
                ("service", models.CharField(max_length=64)),
                ("checked_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-checked_at"],
            },
        ),
    ]
