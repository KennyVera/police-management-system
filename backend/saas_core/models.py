"""Multi-tenancy SaaS: planes, instituciones (tenants) y facturación simulada."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class PlanSuscripcion(models.Model):
    """Catálogo de planes comerciales editables por SuperAdmin SaaS."""

    codigo = models.CharField(
        max_length=40,
        unique=True,
        help_text="Slug único, ej. BASICO, CORPORATIVO, GUBERNAMENTAL",
    )
    nombre = models.CharField(max_length=80)
    descripcion = models.TextField(blank=True)
    audiencia = models.CharField(
        max_length=120,
        blank=True,
        help_text="Ej. Metropolitana/Municipal, Seguridad Privada, Enterprise",
    )
    precio_mensual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_anual = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    limite_usuarios = models.PositiveIntegerField(default=25)
    almacenamiento_gb = models.PositiveIntegerField(
        default=50, help_text="Cuota MinIO (GB)"
    )
    tiene_analitica_avanzada = models.BooleanField(
        default=False, help_text="Analítica ClickHouse avanzada"
    )
    on_premise = models.BooleanField(default=False)
    modulos = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de módulos incluidos, ej. ['operativo','tactico','reportes']",
    )
    caracteristicas = models.TextField(
        blank=True,
        help_text="Características visibles (una por línea o texto libre)",
    )
    activo = models.BooleanField(default=True)
    archivado = models.BooleanField(
        default=False,
        help_text="Archivado: no aparece en catálogo comercial ni onboarding",
    )
    orden = models.PositiveSmallIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True, null=True)
    actualizado_en = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        ordering = ["orden", "precio_mensual"]
        verbose_name = "Plan de suscripción"
        verbose_name_plural = "Planes de suscripción"

    def __str__(self) -> str:
        return f"{self.nombre} (${self.precio_mensual}/mes)"


class Institucion(models.Model):
    """Tenant SaaS: cada cliente institucional aislado."""

    class EstadoPago(models.TextChoices):
        ACTIVO = "ACTIVO", "Activo"
        SUSPENDIDO = "SUSPENDIDO", "Suspendido por falta de pago"
        PRUEBA = "PRUEBA", "Prueba gratuita"
        CANCELADO = "CANCELADO", "Cancelado"

    nombre_comercial = models.CharField(max_length=180)
    ruc = models.CharField(max_length=32, unique=True)
    direccion = models.CharField(max_length=255, blank=True)
    plan_actual = models.ForeignKey(
        PlanSuscripcion,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instituciones",
    )
    esta_activa = models.BooleanField(default=True)
    estado_pago = models.CharField(
        max_length=20, choices=EstadoPago.choices, default=EstadoPago.PRUEBA
    )
    metodo_facturacion = models.CharField(
        max_length=40,
        blank=True,
        default="tarjeta",
        help_text="tarjeta | transferencia | orden_compra",
    )
    fecha_registro = models.DateTimeField(default=timezone.now)
    fecha_renovacion = models.DateField(
        null=True,
        blank=True,
        help_text="Próxima renovación de suscripción",
    )
    admin_institucional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="instituciones_administradas",
        help_text="Master Admin (rol ADMIN_SISTEMA) de esta institución",
    )
    periodo_facturacion = models.CharField(
        max_length=10,
        choices=[("MENSUAL", "Mensual"), ("ANUAL", "Anual")],
        default="MENSUAL",
    )
    dias_gracia = models.PositiveSmallIntegerField(default=7)
    # Cancelación solicitada por el admin institucional: acceso hasta fecha_renovacion.
    cancelacion_solicitada = models.BooleanField(default=False)
    cancelacion_solicitada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-fecha_registro"]
        verbose_name = "Institución (Tenant)"
        verbose_name_plural = "Instituciones (Tenants)"

    def __str__(self) -> str:
        return self.nombre_comercial

    @property
    def plan_nombre(self) -> str:
        return self.plan_actual.nombre if self.plan_actual_id else "Sin plan"


class SuscripcionEvento(models.Model):
    """Historial de cambios de plan / estado de pago por institución."""

    class Accion(models.TextChoices):
        ASIGNAR = "ASIGNAR", "Asignar plan"
        CAMBIAR = "CAMBIAR", "Cambiar plan"
        RENOVAR = "RENOVAR", "Renovar"
        SUSPENDER = "SUSPENDER", "Suspender"
        CANCELAR = "CANCELAR", "Cancelar"
        REACTIVAR = "REACTIVAR", "Reactivar"

    institucion = models.ForeignKey(
        Institucion, on_delete=models.CASCADE, related_name="eventos_suscripcion"
    )
    accion = models.CharField(max_length=20, choices=Accion.choices)
    plan_anterior = models.ForeignKey(
        PlanSuscripcion,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    plan_nuevo = models.ForeignKey(
        PlanSuscripcion,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    estado_anterior = models.CharField(max_length=20, blank=True)
    estado_nuevo = models.CharField(max_length=20, blank=True)
    nota = models.TextField(blank=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="eventos_suscripcion",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evento de suscripción"
        verbose_name_plural = "Eventos de suscripción"

    def __str__(self) -> str:
        return f"{self.institucion_id} · {self.accion}"


from .models_facturacion import (  # noqa: E402,F401
    EventoFinanciero,
    Factura,
    Pago,
    UsageLog,
)
from .models_configuracion import ConfigAuditoria, ConfiguracionPlataforma  # noqa: E402,F401

# Aliases de dominio (panel «Suscripción y Uso» del admin institucional)
Subscription = Institucion  # plan_actual + estado_pago + fechas
Invoice = Factura
