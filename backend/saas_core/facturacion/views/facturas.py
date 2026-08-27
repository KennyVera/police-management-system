"""Facturas: listar, generar, anular, exportar PDF, historial."""

from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.serializers import (
    EventoFinancieroSerializer,
    FacturaSerializer,
)
from saas_core.facturacion.services.facturas_svc import generate_factura
from saas_core.facturacion.services.pdf_svc import build_factura_pdf
from saas_core.facturacion.utils import log_evento
from saas_core.models import EventoFinanciero, Factura, Institucion
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


@api_view(["GET"])
@permission_classes(PERMS)
def list_facturas(request):
    qs = Factura.objects.select_related("institucion", "plan").all()
    estado = request.query_params.get("estado")
    institucion_id = request.query_params.get("institucion_id")
    if estado:
        qs = qs.filter(estado=estado)
    if institucion_id:
        qs = qs.filter(institucion_id=institucion_id)
    instituciones = list(
        Institucion.objects.order_by("nombre_comercial").values("id", "nombre_comercial")
    )
    return Response(
        {
            "facturas": FacturaSerializer(qs[:200], many=True).data,
            "instituciones": instituciones,
        }
    )


@api_view(["POST"])
@permission_classes(PERMS)
def generar_factura(request):
    institucion_id = request.data.get("institucion_id")
    if not institucion_id:
        return Response({"detail": "institucion_id requerido"}, status=400)
    inst = get_object_or_404(Institucion, pk=institucion_id)
    try:
        factura = generate_factura(inst, actor=request.user)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(FacturaSerializer(factura).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes(PERMS)
def anular_factura(request, pk):
    factura = get_object_or_404(Factura, pk=pk)
    if factura.estado == Factura.Estado.ANULADA:
        return Response({"detail": "Ya está anulada"}, status=400)
    motivo = request.data.get("motivo") or "Anulada por administración"
    factura.estado = Factura.Estado.ANULADA
    factura.anulado_en = timezone.now()
    factura.anulado_motivo = motivo
    factura.save(update_fields=["estado", "anulado_en", "anulado_motivo", "actualizado_en"])
    log_evento(
        accion=EventoFinanciero.Accion.ANULAR_FACTURA,
        entidad_tipo=EventoFinanciero.EntidadTipo.FACTURA,
        entidad_id=factura.pk,
        institucion=factura.institucion,
        actor=request.user,
        detalle=motivo,
        metadata={"numero": factura.numero},
    )
    return Response(FacturaSerializer(factura).data)


@api_view(["GET"])
@permission_classes(PERMS)
def exportar_factura(request, pk):
    """Descarga la factura en PDF (ReportLab)."""
    factura = get_object_or_404(
        Factura.objects.select_related("institucion", "plan"), pk=pk
    )
    emisor = (
        f"{request.user.first_name} {request.user.last_name}".strip()
        or request.user.get_username()
    )
    pdf = build_factura_pdf(factura, emisor=emisor)
    filename = f"{factura.numero or f'factura_{pk}'}.pdf".replace(" ", "_")
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    resp["Content-Length"] = str(len(pdf))
    resp["Cache-Control"] = "no-store"
    return resp


@api_view(["GET"])
@permission_classes(PERMS)
def historial_factura(request, pk):
    factura = get_object_or_404(Factura, pk=pk)
    eventos = EventoFinanciero.objects.filter(
        entidad_tipo=EventoFinanciero.EntidadTipo.FACTURA,
        entidad_id=factura.pk,
    )
    return Response(
        {
            "factura": FacturaSerializer(factura).data,
            "historial": EventoFinancieroSerializer(eventos, many=True).data,
        }
    )
