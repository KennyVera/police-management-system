"""Utilidades de facturación: eventos, numeración y helpers."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Max
from django.utils import timezone

from saas_core.models import EventoFinanciero, Factura, Institucion


def log_evento(
    *,
    accion: str,
    entidad_tipo: str,
    entidad_id: int | None = None,
    institucion=None,
    actor=None,
    detalle: str = "",
    metadata: dict | None = None,
) -> EventoFinanciero:
    return EventoFinanciero.objects.create(
        institucion=institucion,
        actor=actor,
        accion=accion,
        entidad_tipo=entidad_tipo,
        entidad_id=entidad_id,
        detalle=detalle or "",
        metadata=metadata or {},
    )


def next_factura_numero(prefijo: str = "FAC") -> str:
    year = timezone.now().year
    pattern = f"{prefijo}-{year}-"
    last = (
        Factura.objects.filter(numero__startswith=pattern)
        .aggregate(m=Max("numero"))
        .get("m")
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except ValueError:
            seq = Factura.objects.filter(numero__startswith=pattern).count() + 1
    return f"{pattern}{seq:05d}"


def precio_institucion(inst: Institucion) -> Decimal:
    plan = inst.plan_actual
    if not plan:
        return Decimal("0.00")
    if inst.periodo_facturacion == "ANUAL":
        return plan.precio_anual if plan.precio_anual is not None else plan.precio_mensual * 12
    return plan.precio_mensual


def modalidad_desde_plan(inst: Institucion) -> str:
    plan = inst.plan_actual
    if plan and plan.on_premise:
        return Factura.Modalidad.ON_PREMISE
    return Factura.Modalidad.SAAS


def hoy() -> date:
    return timezone.localdate()


def en_n_dias(n: int) -> date:
    return hoy() + timedelta(days=n)


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    dim = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(y, m, min(d.day, dim[m - 1]))
