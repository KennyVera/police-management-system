"""Vencimientos: próximos, vencidas, alertas, gracia, historial."""

from __future__ import annotations

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.serializers import EventoFinancieroSerializer
from saas_core.facturacion.utils import log_evento, precio_institucion
from saas_core.models import EventoFinanciero, Institucion
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


def _row(inst: Institucion, hoy) -> dict:
    dias = None
    if inst.fecha_renovacion:
        dias = (inst.fecha_renovacion - hoy).days
    return {
        "id": inst.pk,
        "nombre_comercial": inst.nombre_comercial,
        "estado_pago": inst.estado_pago,
        "fecha_renovacion": inst.fecha_renovacion,
        "dias_gracia": inst.dias_gracia,
        "dias_hasta_renovacion": dias,
        "periodo_facturacion": inst.periodo_facturacion,
        "precio": str(precio_institucion(inst)),
        "plan_nombre": inst.plan_actual.nombre if inst.plan_actual_id else None,
    }


@api_view(["GET"])
@permission_classes(PERMS)
def proximos(request):
    hoy = timezone.localdate()
    limite = hoy + timedelta(days=14)
    qs = (
        Institucion.objects.select_related("plan_actual")
        .exclude(estado_pago=Institucion.EstadoPago.CANCELADO)
        .filter(fecha_renovacion__gte=hoy, fecha_renovacion__lte=limite)
        .order_by("fecha_renovacion")
    )
    return Response({"items": [_row(i, hoy) for i in qs]})


@api_view(["GET"])
@permission_classes(PERMS)
def vencidas(request):
    hoy = timezone.localdate()
    qs = (
        Institucion.objects.select_related("plan_actual")
        .exclude(estado_pago=Institucion.EstadoPago.CANCELADO)
        .filter(fecha_renovacion__lt=hoy)
        .order_by("fecha_renovacion")
    )
    return Response({"items": [_row(i, hoy) for i in qs]})


@api_view(["GET"])
@permission_classes(PERMS)
def alertas(request):
    hoy = timezone.localdate()
    qs = (
        Institucion.objects.select_related("plan_actual")
        .exclude(estado_pago=Institucion.EstadoPago.CANCELADO)
        .exclude(fecha_renovacion__isnull=True)
    )
    result = []
    for inst in qs:
        delta = (inst.fecha_renovacion - hoy).days
        if -inst.dias_gracia <= delta <= 7:
            row = _row(inst, hoy)
            row["tipo_alerta"] = "pre_vencimiento" if delta >= 0 else "gracia"
            result.append(row)
    return Response({"items": result, "alertas": result})


@api_view(["POST"])
@permission_classes(PERMS)
def set_gracia(request, institucion_id):
    inst = get_object_or_404(Institucion, pk=institucion_id)
    dias = int(request.data.get("dias_gracia", 7))
    anterior = inst.dias_gracia
    inst.dias_gracia = max(0, dias)
    inst.save(update_fields=["dias_gracia"])
    log_evento(
        accion=EventoFinanciero.Accion.GRACIA,
        entidad_tipo=EventoFinanciero.EntidadTipo.SUSCRIPCION,
        entidad_id=inst.pk,
        institucion=inst,
        actor=request.user,
        detalle=f"dias_gracia {anterior} → {inst.dias_gracia}",
        metadata={"anterior": anterior, "nuevo": inst.dias_gracia},
    )
    return Response(_row(inst, timezone.localdate()))


@api_view(["GET"])
@permission_classes(PERMS)
def historial_vencimientos(request):
    eventos = EventoFinanciero.objects.filter(
        accion__in=[
            EventoFinanciero.Accion.VENCIMIENTO,
            EventoFinanciero.Accion.GRACIA,
            EventoFinanciero.Accion.RENOVAR,
        ]
    )[:200]
    return Response({"historial": EventoFinancieroSerializer(eventos, many=True).data})
