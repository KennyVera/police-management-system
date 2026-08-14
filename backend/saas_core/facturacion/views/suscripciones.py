"""Suscripciones facturables: listar, renovar, periodo, historial."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.serializers import EventoFinancieroSerializer
from saas_core.facturacion.services.facturas_svc import generate_factura
from saas_core.facturacion.utils import add_months, log_evento, precio_institucion
from saas_core.models import EventoFinanciero, Institucion
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


def _serialize_sub(inst: Institucion) -> dict:
    plan = inst.plan_actual
    return {
        "id": inst.pk,
        "nombre_comercial": inst.nombre_comercial,
        "ruc": inst.ruc,
        "plan_id": plan.pk if plan else None,
        "plan_nombre": plan.nombre if plan else None,
        "estado_pago": inst.estado_pago,
        "estado_pago_label": inst.get_estado_pago_display(),
        "fecha_renovacion": inst.fecha_renovacion,
        "periodo_facturacion": inst.periodo_facturacion,
        "dias_gracia": inst.dias_gracia,
        "precio": str(precio_institucion(inst)),
        "metodo_facturacion": inst.metodo_facturacion,
        "esta_activa": inst.esta_activa,
    }


@api_view(["GET"])
@permission_classes(PERMS)
def list_suscripciones(request):
    qs = Institucion.objects.select_related("plan_actual").all()
    items = [_serialize_sub(i) for i in qs]
    return Response({"suscripciones": items, "instituciones": items})


@api_view(["POST"])
@permission_classes(PERMS)
def renovar_suscripcion(request, pk):
    inst = get_object_or_404(Institucion, pk=pk)
    default_m = 12 if inst.periodo_facturacion == "ANUAL" else 1
    meses = int(request.data.get("meses") or default_m)
    base = inst.fecha_renovacion or timezone.localdate()
    if base < timezone.localdate():
        base = timezone.localdate()
    inst.fecha_renovacion = add_months(base, meses)
    inst.estado_pago = Institucion.EstadoPago.ACTIVO
    inst.save(update_fields=["fecha_renovacion", "estado_pago"])
    factura = None
    if request.data.get("generar_factura", True):
        try:
            factura = generate_factura(inst, actor=request.user)
        except ValueError:
            factura = None
    log_evento(
        accion=EventoFinanciero.Accion.RENOVAR,
        entidad_tipo=EventoFinanciero.EntidadTipo.SUSCRIPCION,
        entidad_id=inst.pk,
        institucion=inst,
        actor=request.user,
        detalle=f"Renovación +{meses} meses → {inst.fecha_renovacion}",
        metadata={"meses": meses},
    )
    data = _serialize_sub(inst)
    data["factura_id"] = factura.pk if factura else None
    return Response(data)


@api_view(["POST"])
@permission_classes(PERMS)
def cambiar_periodo(request, pk):
    inst = get_object_or_404(Institucion, pk=pk)
    periodo = (request.data.get("periodo_facturacion") or "").upper()
    if periodo not in ("MENSUAL", "ANUAL"):
        return Response(
            {"detail": "periodo_facturacion debe ser MENSUAL o ANUAL"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    anterior = inst.periodo_facturacion
    inst.periodo_facturacion = periodo
    inst.save(update_fields=["periodo_facturacion"])
    log_evento(
        accion=EventoFinanciero.Accion.CAMBIAR_PERIODO,
        entidad_tipo=EventoFinanciero.EntidadTipo.SUSCRIPCION,
        entidad_id=inst.pk,
        institucion=inst,
        actor=request.user,
        detalle=f"{anterior} → {periodo}",
        metadata={"anterior": anterior, "nuevo": periodo},
    )
    return Response(_serialize_sub(inst))


@api_view(["GET"])
@permission_classes(PERMS)
def historial_suscripcion(request, pk):
    inst = get_object_or_404(Institucion, pk=pk)
    eventos = EventoFinanciero.objects.filter(institucion=inst)[:100]
    return Response(
        {
            "institucion": {"id": inst.pk, "nombre_comercial": inst.nombre_comercial},
            "historial": EventoFinancieroSerializer(eventos, many=True).data,
        }
    )
