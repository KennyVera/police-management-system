"""Agregaciones de reportes diario / mensual / anual."""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime, time
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from saas_core.models import Factura, Pago


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def _filtros_comunes(qs, params, fecha_field: str):
    institucion_id = params.get("institucion_id")
    plan_id = params.get("plan_id")
    modalidad = params.get("modalidad")
    estado = params.get("estado")
    metodo = params.get("metodo")
    if institucion_id:
        qs = qs.filter(institucion_id=institucion_id)
    if plan_id and hasattr(qs.model, "plan_id"):
        qs = qs.filter(plan_id=plan_id)
    if modalidad and hasattr(qs.model, "modalidad"):
        qs = qs.filter(modalidad=modalidad)
    if estado:
        qs = qs.filter(estado=estado)
    if metodo:
        if hasattr(qs.model, "metodo_pago"):
            qs = qs.filter(metodo_pago=metodo)
        elif hasattr(qs.model, "metodo"):
            qs = qs.filter(metodo=metodo)
    return qs


def _rango_dia(fecha: date):
    start = timezone.make_aware(datetime.combine(fecha, time.min))
    end = timezone.make_aware(datetime.combine(fecha, time.max))
    return start, end


def _rango_mes(anio: int, mes: int):
    last = monthrange(anio, mes)[1]
    return date(anio, mes, 1), date(anio, mes, last)


def _rango_anio(anio: int):
    return date(anio, 1, 1), date(anio, 12, 31)


def _agregar(facturas, pagos) -> dict:
    f_agg = facturas.aggregate(
        total=Sum("monto"),
        n=Count("id"),
        pagadas=Count("id", filter=Q(estado="PAGADA")),
        emitidas=Count("id", filter=Q(estado="EMITIDA")),
        anuladas=Count("id", filter=Q(estado="ANULADA")),
    )
    p_agg = pagos.aggregate(
        total=Sum("monto"),
        n=Count("id"),
        confirmados=Count("id", filter=Q(estado="CONFIRMADO")),
        pendientes=Count("id", filter=Q(estado="PENDIENTE")),
        reembolsos=Sum("monto", filter=Q(tipo="REEMBOLSO")),
    )
    ingresos = p_agg["total"] or Decimal("0")
    reembolsos = p_agg["reembolsos"] or Decimal("0")
    neto = ingresos - reembolsos
    por_plan = list(
        facturas.values("plan__nombre")
        .annotate(ingresos=Sum("monto"))
        .order_by("-ingresos")[:20]
    )
    por_inst = list(
        pagos.filter(estado="CONFIRMADO", tipo="PAGO")
        .values("institucion__nombre_comercial")
        .annotate(ingresos=Sum("monto"))
        .order_by("-ingresos")[:20]
    )
    return {
        "kpis": {
            "ingresos": str(neto),
            "pagos_realizados": p_agg["confirmados"] or 0,
            "pagos_pendientes": p_agg["pendientes"] or 0,
            "facturas_emitidas": (f_agg["emitidas"] or 0) + (f_agg["pagadas"] or 0),
            "facturas_anuladas": f_agg["anuladas"] or 0,
            "vencimientos": 0,
            "renovaciones": 0,
            "nuevas_suscripciones": 0,
            "cancelaciones": 0,
            "morosidad": "0",
            "variacion_pct": 0,
            "crecimiento_pct": 0,
        },
        "por_plan": [
            {"plan": r["plan__nombre"] or "Sin plan", "ingresos": str(r["ingresos"] or 0)}
            for r in por_plan
        ],
        "por_institucion": [
            {
                "institucion": r["institucion__nombre_comercial"],
                "ingresos": str(r["ingresos"] or 0),
            }
            for r in por_inst
        ],
        "facturas": {
            "cantidad": f_agg["n"] or 0,
            "monto_total": str(f_agg["total"] or Decimal("0")),
            "pagadas": f_agg["pagadas"] or 0,
            "emitidas": f_agg["emitidas"] or 0,
            "anuladas": f_agg["anuladas"] or 0,
        },
        "pagos": {
            "cantidad": p_agg["n"] or 0,
            "monto_total": str(p_agg["total"] or Decimal("0")),
            "confirmados": p_agg["confirmados"] or 0,
            "reembolsos": str(reembolsos),
        },
    }


def reporte_diario(params) -> dict:
    fecha = _parse_date(params.get("fecha")) or timezone.localdate()
    start, end = _rango_dia(fecha)
    facturas = _filtros_comunes(
        Factura.objects.filter(fecha_emision=fecha), params, "fecha_emision"
    )
    pagos = _filtros_comunes(
        Pago.objects.filter(fecha_pago__range=(start, end)), params, "fecha_pago"
    )
    return {"periodo": {"tipo": "diario", "fecha": str(fecha)}, **_agregar(facturas, pagos)}


def reporte_mensual(params) -> dict:
    hoy = timezone.localdate()
    anio = int(params.get("anio") or hoy.year)
    mes = int(params.get("mes") or hoy.month)
    d0, d1 = _rango_mes(anio, mes)
    facturas = _filtros_comunes(
        Factura.objects.filter(fecha_emision__range=(d0, d1)), params, "fecha_emision"
    )
    pagos = _filtros_comunes(
        Pago.objects.filter(fecha_pago__date__range=(d0, d1)), params, "fecha_pago"
    )
    return {
        "periodo": {"tipo": "mensual", "anio": anio, "mes": mes},
        **_agregar(facturas, pagos),
    }


def reporte_anual(params) -> dict:
    hoy = timezone.localdate()
    anio = int(params.get("anio") or hoy.year)
    d0, d1 = _rango_anio(anio)
    facturas = _filtros_comunes(
        Factura.objects.filter(fecha_emision__range=(d0, d1)), params, "fecha_emision"
    )
    pagos = _filtros_comunes(
        Pago.objects.filter(fecha_pago__date__range=(d0, d1)), params, "fecha_pago"
    )
    return {"periodo": {"tipo": "anual", "anio": anio}, **_agregar(facturas, pagos)}
