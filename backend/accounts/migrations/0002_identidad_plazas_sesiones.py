from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("organizacion", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="cedula",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="placa",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="rango_policial",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="estado",
            field=models.CharField(
                choices=[
                    ("ACTIVO", "Activo"),
                    ("SUSPENDIDO", "Suspendido"),
                    ("BAJA", "Dado de baja"),
                ],
                default="ACTIVO",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="two_factor_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="departamento",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="miembros",
                to="organizacion.department",
            ),
        ),
        migrations.AddField(
            model_name="userprofile",
            name="jurisdiccion",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="efectivos",
                to="organizacion.jurisdiction",
            ),
        ),
        migrations.AlterField(
            model_name="userprofile",
            name="role",
            field=models.CharField(
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
        migrations.CreateModel(
            name="UserSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_key", models.CharField(max_length=64, unique=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sgp_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Sesión de usuario",
                "verbose_name_plural": "Sesiones de usuario",
                "ordering": ["-last_seen"],
            },
        ),
    ]
