# Generated manually for SuperAdmin planes / suscripciones

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("saas_core", "0001_saas_multitenant"),
    ]

    operations = [
        migrations.AlterField(
            model_name="plansuscripcion",
            name="codigo",
            field=models.CharField(
                help_text="Slug único, ej. BASICO, CORPORATIVO, GUBERNAMENTAL",
                max_length=40,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="precio_anual",
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="modulos",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista de módulos incluidos, ej. ['operativo','tactico','reportes']",
            ),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="caracteristicas",
            field=models.TextField(
                blank=True,
                help_text="Características visibles (una por línea o texto libre)",
            ),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="archivado",
            field=models.BooleanField(
                default=False,
                help_text="Archivado: no aparece en catálogo comercial ni onboarding",
            ),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="creado_en",
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="plansuscripcion",
            name="actualizado_en",
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name="institucion",
            name="fecha_renovacion",
            field=models.DateField(
                blank=True,
                help_text="Próxima renovación de suscripción",
                null=True,
            ),
        ),
        migrations.CreateModel(
            name="SuscripcionEvento",
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
                    "accion",
                    models.CharField(
                        choices=[
                            ("ASIGNAR", "Asignar plan"),
                            ("CAMBIAR", "Cambiar plan"),
                            ("RENOVAR", "Renovar"),
                            ("SUSPENDER", "Suspender"),
                            ("CANCELAR", "Cancelar"),
                            ("REACTIVAR", "Reactivar"),
                        ],
                        max_length=20,
                    ),
                ),
                ("estado_anterior", models.CharField(blank=True, max_length=20)),
                ("estado_nuevo", models.CharField(blank=True, max_length=20)),
                ("nota", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "creado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="eventos_suscripcion",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "institucion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="eventos_suscripcion",
                        to="saas_core.institucion",
                    ),
                ),
                (
                    "plan_anterior",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="saas_core.plansuscripcion",
                    ),
                ),
                (
                    "plan_nuevo",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="saas_core.plansuscripcion",
                    ),
                ),
            ],
            options={
                "verbose_name": "Evento de suscripción",
                "verbose_name_plural": "Eventos de suscripción",
                "ordering": ["-creado_en"],
            },
        ),
    ]
