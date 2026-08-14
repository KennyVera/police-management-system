"""Generación de facturas para instituciones."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from saas_core.facturacion.utils import (
    add_months,
    log_evento,
    modalidad_desde_plan,
    next_factura_numero,
    precio_institucion,
)
from saas_core.models import EventoFinanciero, Factura, Institucion


def generate_factura(
    institucion: Institucion, actor=None, crear_evento: bool = True
) -> Factura:
    if not institucion.plan_actual_id:
        raise ValueError("La institución no tiene plan asignado.")

    hoy = timezone.localdate()
    meses = 12 if institucion.periodo_facturacion == "ANUAL" else 1
    periodo_fin = add_months(hoy, meses) - timedelta(days=1)
    venc = institucion.fecha_renovacion or (hoy + timedelta(days=30))

    factura = Factura.objects.create(
        institucion=institucion,
        plan=institucion.plan_actual,
        numero=next_factura_numero(),
        monto=precio_institucion(institucion),
        estado=Factura.Estado.EMITIDA,
        periodo_inicio=hoy,
        periodo_fin=periodo_fin,
        fecha_emision=hoy,
        fecha_vencimiento=venc,
        metodo_pago=institucion.metodo_facturacion or "",
        modalidad=modalidad_desde_plan(institucion),
    )
    if crear_evento:
        log_evento(
            accion=EventoFinanciero.Accion.EMITIR_FACTURA,
            entidad_tipo=EventoFinanciero.EntidadTipo.FACTURA,
            entidad_id=factura.pk,
            institucion=institucion,
            actor=actor,
            detalle=f"Factura {factura.numero} emitida por {factura.monto}",
            metadata={"numero": factura.numero, "monto": str(factura.monto)},
        )
    return factura
