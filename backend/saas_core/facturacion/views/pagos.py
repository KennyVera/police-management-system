"""Pagos: listar, registrar, confirmar, reembolsos, transacciones."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.serializers import PagoSerializer
from saas_core.facturacion.utils import log_evento
from saas_core.models import EventoFinanciero, Factura, Institucion, Pago
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


@api_view(["GET", "POST"])
@permission_classes(PERMS)
def pagos_list_create(request):
    if request.method == "GET":
        qs = Pago.objects.select_related("institucion", "factura").all()
        estado = request.query_params.get("estado")
        tipo = request.query_params.get("tipo")
        institucion_id = request.query_params.get("institucion_id")
        if estado:
            qs = qs.filter(estado=estado)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if institucion_id:
            qs = qs.filter(institucion_id=institucion_id)
        instituciones = list(
            Institucion.objects.order_by("nombre_comercial").values(
                "id", "nombre_comercial"
            )
        )
        return Response(
            {
                "pagos": PagoSerializer(qs[:200], many=True).data,
                "instituciones": instituciones,
            }
        )

    institucion_id = request.data.get("institucion_id") or request.data.get("institucion")
    if not institucion_id:
        return Response({"detail": "institucion_id requerido"}, status=400)
    inst = get_object_or_404(Institucion, pk=institucion_id)
    try:
        monto = Decimal(str(request.data.get("monto", "0")))
    except (InvalidOperation, TypeError):
        return Response({"detail": "monto inválido"}, status=400)
    factura = None
    fid = request.data.get("factura_id") or request.data.get("factura")
    if fid:
        factura = get_object_or_404(Factura, pk=fid, institucion=inst)
    pago = Pago.objects.create(
        institucion=inst,
        factura=factura,
        monto=monto,
        tipo=request.data.get("tipo") or Pago.Tipo.PAGO,
        estado=Pago.Estado.PENDIENTE,
        metodo=request.data.get("metodo") or Pago.Metodo.TARJETA,
        referencia=request.data.get("referencia") or "",
        nota=request.data.get("nota") or "",
        fecha_pago=timezone.now(),
    )
    log_evento(
        accion=EventoFinanciero.Accion.REGISTRAR_PAGO,
        entidad_tipo=EventoFinanciero.EntidadTipo.PAGO,
        entidad_id=pago.pk,
        institucion=inst,
        actor=request.user,
        detalle=f"Pago registrado {pago.monto}",
        metadata={"monto": str(pago.monto)},
    )
    return Response(PagoSerializer(pago).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes(PERMS)
def confirmar_pago(request, pk):
    pago = get_object_or_404(Pago.objects.select_related("factura", "institucion"), pk=pk)
    pago.estado = Pago.Estado.CONFIRMADO
    pago.save(update_fields=["estado"])
    if pago.factura_id:
        pago.factura.estado = Factura.Estado.PAGADA
        pago.factura.save(update_fields=["estado", "actualizado_en"])
    inst = pago.institucion
    inst.estado_pago = Institucion.EstadoPago.ACTIVO
    inst.save(update_fields=["estado_pago"])
    log_evento(
        accion=EventoFinanciero.Accion.CONFIRMAR_PAGO,
        entidad_tipo=EventoFinanciero.EntidadTipo.PAGO,
        entidad_id=pago.pk,
        institucion=inst,
        actor=request.user,
        detalle=f"Pago {pago.pk} confirmado",
    )
    return Response(PagoSerializer(pago).data)


@api_view(["POST"])
@permission_classes(PERMS)
def reembolso_pago(request, pk):
    original = get_object_or_404(Pago, pk=pk)
    try:
        monto = Decimal(str(request.data.get("monto") or original.monto))
    except (InvalidOperation, TypeError):
        return Response({"detail": "monto inválido"}, status=400)
    reembolso = Pago.objects.create(
        institucion=original.institucion,
        factura=original.factura,
        monto=monto,
        tipo=Pago.Tipo.REEMBOLSO,
        estado=Pago.Estado.CONFIRMADO,
        metodo=original.metodo,
        referencia=f"REF-{original.pk}",
        nota=request.data.get("nota") or f"Reembolso de pago {original.pk}",
        fecha_pago=timezone.now(),
    )
    log_evento(
        accion=EventoFinanciero.Accion.REEMBOLSO,
        entidad_tipo=EventoFinanciero.EntidadTipo.PAGO,
        entidad_id=reembolso.pk,
        institucion=original.institucion,
        actor=request.user,
        detalle=f"Reembolso {monto} de pago {original.pk}",
        metadata={"pago_origen": original.pk, "monto": str(monto)},
    )
    return Response(PagoSerializer(reembolso).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes(PERMS)
def transacciones(request):
    qs = Pago.objects.select_related("institucion", "factura").all()[:500]
    return Response({"transacciones": PagoSerializer(qs, many=True).data})
