"""Modelos de facturación SaaS: Factura, Pago, EventoFinanciero."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Factura(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        EMITIDA = "EMITIDA", "Emitida"
        PAGADA = "PAGADA", "Pagada"
        ANULADA = "ANULADA", "Anulada"
        VENCIDA = "VENCIDA", "Vencida"

    class Modalidad(models.TextChoices):
        SAAS = "SAAS", "SaaS"
        ON_PREMISE = "ON_PREMISE", "On-Premise"

    institucion = models.ForeignKey(
        "saas_core.Institucion", on_delete=models.CASCADE, related_name="facturas"
    )
    plan = models.ForeignKey(
        "saas_core.PlanSuscripcion",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    numero = models.CharField(max_length=40, unique=True)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.BORRADOR
    )
    periodo_inicio = models.DateField()
    periodo_fin = models.DateField()
    fecha_emision = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    metodo_pago = models.CharField(max_length=40, blank=True, default="")
    modalidad = models.CharField(
        max_length=20, choices=Modalidad.choices, default=Modalidad.SAAS
    )
    nota = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    anulado_en = models.DateTimeField(null=True, blank=True)
    anulado_motivo = models.TextField(blank=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Factura"
        verbose_name_plural = "Facturas"

    def __str__(self) -> str:
        return f"{self.numero} · {self.estado}"


class Pago(models.Model):
    class Tipo(models.TextChoices):
        PAGO = "PAGO", "Pago"
        REEMBOLSO = "REEMBOLSO", "Reembolso"
        AJUSTE = "AJUSTE", "Ajuste"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        CONFIRMADO = "CONFIRMADO", "Confirmado"
        VENCIDO = "VENCIDO", "Vencido"
        ANULADO = "ANULADO", "Anulado"

    class Metodo(models.TextChoices):
        TARJETA = "tarjeta", "Tarjeta"
        TRANSFERENCIA = "transferencia", "Transferencia"
        ORDEN_COMPRA = "orden_compra", "Orden de compra"
        OTRO = "otro", "Otro"

    institucion = models.ForeignKey(
        "saas_core.Institucion", on_delete=models.CASCADE, related_name="pagos"
    )
    factura = models.ForeignKey(
        Factura, null=True, blank=True, on_delete=models.SET_NULL, related_name="pagos"
    )
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.PAGO)
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    metodo = models.CharField(
        max_length=20, choices=Metodo.choices, default=Metodo.TARJETA
    )
    referencia = models.CharField(max_length=120, blank=True)
    fecha_pago = models.DateTimeField(default=timezone.now)
    nota = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_pago"]
        verbose_name = "Pago"
        verbose_name_plural = "Pagos"

    def __str__(self) -> str:
        return f"{self.tipo} {self.monto} · {self.estado}"


class EventoFinanciero(models.Model):
    class Accion(models.TextChoices):
        EMITIR_FACTURA = "EMITIR_FACTURA", "Emitir factura"
        ANULAR_FACTURA = "ANULAR_FACTURA", "Anular factura"
        CONFIRMAR_PAGO = "CONFIRMAR_PAGO", "Confirmar pago"
        REGISTRAR_PAGO = "REGISTRAR_PAGO", "Registrar pago"
        REEMBOLSO = "REEMBOLSO", "Reembolso"
        RENOVAR = "RENOVAR", "Renovar"
        CAMBIAR_PERIODO = "CAMBIAR_PERIODO", "Cambiar periodo"
        GRACIA = "GRACIA", "Días de gracia"
        VENCIMIENTO = "VENCIMIENTO", "Vencimiento"
        OTRO = "OTRO", "Otro"

    class EntidadTipo(models.TextChoices):
        FACTURA = "FACTURA", "Factura"
        PAGO = "PAGO", "Pago"
        SUSCRIPCION = "SUSCRIPCION", "Suscripción"
        SISTEMA = "SISTEMA", "Sistema"

    institucion = models.ForeignKey(
        "saas_core.Institucion",
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="eventos_financieros",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL,
        related_name="eventos_financieros",
    )
    accion = models.CharField(max_length=30, choices=Accion.choices)
    entidad_tipo = models.CharField(max_length=20, choices=EntidadTipo.choices)
    entidad_id = models.PositiveIntegerField(null=True, blank=True)
    detalle = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evento financiero"
        verbose_name_plural = "Eventos financieros"

    def __str__(self) -> str:
        return f"{self.accion} · {self.entidad_tipo}"
