from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
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
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("ADMIN_SISTEMA", "Administrador de Institución"),
                            ("VISOR_EJECUTIVO", "Visor Ejecutivo (Alto Mando)"),
                            ("DIRECTOR_ZONA", "Director / Jefe de Zona"),
                            ("SUPERVISOR_UNIDAD", "Supervisor de Unidad"),
                            ("DETECTIVE", "Detective / Investigador"),
                            ("AGENTE_OPERATIVO", "Agente Operativo"),
                        ],
                        max_length=32,
                    ),
                ),
                ("rango_tipico", models.CharField(blank=True, max_length=120)),
                ("unidad", models.CharField(blank=True, max_length=120)),
                ("zona", models.CharField(blank=True, max_length=120)),
                ("telefono", models.CharField(blank=True, max_length=32)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to="auth.user",
                    ),
                ),
            ],
            options={
                "verbose_name": "Perfil de usuario",
                "verbose_name_plural": "Perfiles de usuario",
            },
        ),
    ]
