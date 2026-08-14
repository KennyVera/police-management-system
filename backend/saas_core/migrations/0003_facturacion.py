# Generated manually for facturación SaaS

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("saas_core", "0002_planes_suscripciones_admin"),
    ]

    operations = [
        migrations.AddField(
            model_name="institucion",
            name="periodo_facturacion",
            field=models.CharField(
                choices=[("MENSUAL", "Mensual"), ("ANUAL", "Anual")],
                default="MENSUAL",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="institucion",
            name="dias_gracia",
            field=models.PositiveSmallIntegerField(default=7),
        ),
        migrations.CreateModel(
            name="Factura",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero", models.CharField(max_length=40, unique=True)),
                ("monto", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("BORRADOR", "Borrador"),
                            ("EMITIDA", "Emitida"),
                            ("PAGADA", "Pagada"),
                            ("ANULADA", "Anulada"),
                            ("VENCIDA", "Vencida"),
                        ],
                        default="BORRADOR",
                        max_length=20,
                    ),
                ),
                ("periodo_inicio", models.DateField()),
                ("periodo_fin", models.DateField()),
                ("fecha_emision", models.DateField(blank=True, null=True)),
                ("fecha_vencimiento", models.DateField(blank=True, null=True)),
                ("metodo_pago", models.CharField(blank=True, default="", max_length=40)),
                (
                    "modalidad",
                    models.CharField(
                        choices=[("SAAS", "SaaS"), ("ON_PREMISE", "On-Premise")],
                        default="SAAS",
                        max_length=20,
                    ),
                ),
                ("nota", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                ("anulado_en", models.DateTimeField(blank=True, null=True)),
                ("anulado_motivo", models.TextField(blank=True)),
                (
                    "institucion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="facturas",
                        to="saas_core.institucion",
                    ),
                ),
                (
                    "plan",
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
                "verbose_name": "Factura",
                "verbose_name_plural": "Facturas",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.CreateModel(
            name="Pago",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("monto", models.DecimalField(decimal_places=2, max_digits=12)),
                (
                    "tipo",
                    models.CharField(
                        choices=[
                            ("PAGO", "Pago"),
                            ("REEMBOLSO", "Reembolso"),
                            ("AJUSTE", "Ajuste"),
                        ],
                        default="PAGO",
                        max_length=20,
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("PENDIENTE", "Pendiente"),
                            ("CONFIRMADO", "Confirmado"),
                            ("VENCIDO", "Vencido"),
                            ("ANULADO", "Anulado"),
                        ],
                        default="PENDIENTE",
                        max_length=20,
                    ),
                ),
                (
                    "metodo",
                    models.CharField(
                        choices=[
                            ("tarjeta", "Tarjeta"),
                            ("transferencia", "Transferencia"),
                            ("orden_compra", "Orden de compra"),
                            ("otro", "Otro"),
                        ],
                        default="tarjeta",
                        max_length=20,
                    ),
                ),
                ("referencia", models.CharField(blank=True, max_length=120)),
                ("fecha_pago", models.DateTimeField(default=django.utils.timezone.now)),
                ("nota", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "factura",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="pagos",
                        to="saas_core.factura",
                    ),
                ),
                (
                    "institucion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pagos",
                        to="saas_core.institucion",
                    ),
                ),
            ],
            options={
                "verbose_name": "Pago",
                "verbose_name_plural": "Pagos",
                "ordering": ["-fecha_pago"],
            },
        ),
        migrations.CreateModel(
            name="EventoFinanciero",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "accion",
                    models.CharField(
                        choices=[
                            ("EMITIR_FACTURA", "Emitir factura"),
                            ("ANULAR_FACTURA", "Anular factura"),
                            ("CONFIRMAR_PAGO", "Confirmar pago"),
                            ("REGISTRAR_PAGO", "Registrar pago"),
                            ("REEMBOLSO", "Reembolso"),
                            ("RENOVAR", "Renovar"),
                            ("CAMBIAR_PERIODO", "Cambiar periodo"),
                            ("GRACIA", "Días de gracia"),
                            ("VENCIMIENTO", "Vencimiento"),
                            ("OTRO", "Otro"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "entidad_tipo",
                    models.CharField(
                        choices=[
                            ("FACTURA", "Factura"),
                            ("PAGO", "Pago"),
                            ("SUSCRIPCION", "Suscripción"),
                            ("SISTEMA", "Sistema"),
                        ],
                        max_length=20,
                    ),
                ),
                ("entidad_id", models.PositiveIntegerField(blank=True, null=True)),
                ("detalle", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="eventos_financieros",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "institucion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="eventos_financieros",
                        to="saas_core.institucion",
                    ),
                ),
            ],
            options={
                "verbose_name": "Evento financiero",
                "verbose_name_plural": "Eventos financieros",
                "ordering": ["-creado_en"],
            },
        ),
    ]
