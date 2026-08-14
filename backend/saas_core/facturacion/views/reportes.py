"""Reportes diario / mensual / anual + PDF."""

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.services.pdf_svc import build_reporte_pdf
from saas_core.facturacion.services.reportes_svc import (
    reporte_anual,
    reporte_diario,
    reporte_mensual,
)
from saas_core.models import Institucion, PlanSuscripcion
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


def _meta():
    return {
        "planes": list(
            PlanSuscripcion.objects.filter(archivado=False).values("id", "nombre")
        ),
        "instituciones": list(
            Institucion.objects.order_by("nombre_comercial").values(
                "id", "nombre_comercial"
            )
        ),
    }


def _payload(nivel, params):
    if nivel == "mensual":
        data = reporte_mensual(params)
    elif nivel == "anual":
        data = reporte_anual(params)
    else:
        data = reporte_diario(params)
        nivel = "diario"
    return nivel, data


@api_view(["GET"])
@permission_classes(PERMS)
def reporte_diario_view(request):
    return Response({**reporte_diario(request.query_params), **_meta()})


@api_view(["GET"])
@permission_classes(PERMS)
def reporte_mensual_view(request):
    return Response({**reporte_mensual(request.query_params), **_meta()})


@api_view(["GET"])
@permission_classes(PERMS)
def reporte_anual_view(request):
    return Response({**reporte_anual(request.query_params), **_meta()})


@api_view(["GET"])
@permission_classes(PERMS)
def reporte_pdf_view(request):
    nivel = (request.query_params.get("nivel") or "diario").lower()
    nivel, data = _payload(nivel, request.query_params)
    emisor = getattr(request.user, "email", None) or request.user.get_username()
    pdf = build_reporte_pdf(data, nivel=nivel, emisor=emisor)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="reporte_financiero_{nivel}.pdf"'
    return resp
