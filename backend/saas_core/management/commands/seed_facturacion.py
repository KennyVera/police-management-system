"""Seed de facturas y pagos de ejemplo para InstitucionPrueba."""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from saas_core.facturacion.utils import next_factura_numero
from saas_core.models import EventoFinanciero, Factura, Institucion, Pago


class Command(BaseCommand):
    help = "Crea facturas/pagos de muestra para InstitucionPrueba"

    def handle(self, *args, **options):
        inst = Institucion.objects.filter(nombre_comercial="InstitucionPrueba").first()
        if not inst:
            self.stderr.write("InstitucionPrueba no existe. Ejecute seed_saas primero.")
            return

        with transaction.atomic():
            hoy = timezone.localdate()
            if not Factura.objects.filter(institucion=inst).exists():
                f1 = Factura.objects.create(
                    institucion=inst,
                    plan=inst.plan_actual,
                    numero=next_factura_numero(),
                    monto=inst.plan_actual.precio_mensual if inst.plan_actual else Decimal("100"),
                    estado=Factura.Estado.PAGADA,
                    periodo_inicio=hoy - timedelta(days=60),
                    periodo_fin=hoy - timedelta(days=30),
                    fecha_emision=hoy - timedelta(days=60),
                    fecha_vencimiento=hoy - timedelta(days=30),
                    metodo_pago=inst.metodo_facturacion or "orden_compra",
                    modalidad=(
                        Factura.Modalidad.ON_PREMISE
                        if inst.plan_actual and inst.plan_actual.on_premise
                        else Factura.Modalidad.SAAS
                    ),
                    nota="Factura demo pagada",
                )
                f2 = Factura.objects.create(
                    institucion=inst,
                    plan=inst.plan_actual,
                    numero=next_factura_numero(),
                    monto=f1.monto,
                    estado=Factura.Estado.EMITIDA,
                    periodo_inicio=hoy - timedelta(days=5),
                    periodo_fin=hoy + timedelta(days=25),
                    fecha_emision=hoy - timedelta(days=5),
                    fecha_vencimiento=hoy + timedelta(days=25),
                    metodo_pago=inst.metodo_facturacion or "orden_compra",
                    modalidad=f1.modalidad,
                    nota="Factura demo pendiente",
                )
                Pago.objects.create(
                    institucion=inst,
                    factura=f1,
                    monto=f1.monto,
                    tipo=Pago.Tipo.PAGO,
                    estado=Pago.Estado.CONFIRMADO,
                    metodo=Pago.Metodo.ORDEN_COMPRA,
                    referencia="SEED-001",
                    nota="Pago seed",
                )
                Pago.objects.create(
                    institucion=inst,
                    factura=f2,
                    monto=f2.monto,
                    tipo=Pago.Tipo.PAGO,
                    estado=Pago.Estado.PENDIENTE,
                    metodo=Pago.Metodo.TRANSFERENCIA,
                    referencia="SEED-002",
                    nota="Pago pendiente seed",
                )
                EventoFinanciero.objects.create(
                    institucion=inst,
                    accion=EventoFinanciero.Accion.EMITIR_FACTURA,
                    entidad_tipo=EventoFinanciero.EntidadTipo.FACTURA,
                    entidad_id=f1.pk,
                    detalle="Seed factura pagada",
                    metadata={"seed": True},
                )
                self.stdout.write(self.style.SUCCESS("Facturas y pagos seed creados."))
            else:
                self.stdout.write("Ya existen facturas para InstitucionPrueba.")
