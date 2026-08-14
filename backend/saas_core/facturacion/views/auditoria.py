"""Auditoría financiera: listado de EventoFinanciero."""

from datetime import datetime, time

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.facturacion.serializers import EventoFinancieroSerializer
from saas_core.models import EventoFinanciero
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


def _parse_day(value: str | None, end: bool = False):
    if not value:
        return None
    d = datetime.fromisoformat(value).date()
    t = time.max if end else time.min
    return timezone.make_aware(datetime.combine(d, t))


@api_view(["GET"])
@permission_classes(PERMS)
def list_auditoria(request):
    qs = EventoFinanciero.objects.select_related("actor", "institucion").all()
    usuario_id = request.query_params.get("usuario_id")
    institucion_id = request.query_params.get("institucion_id")
    accion = request.query_params.get("accion")
    desde = _parse_day(request.query_params.get("desde"))
    hasta = _parse_day(request.query_params.get("hasta"), end=True)
    if usuario_id:
        qs = qs.filter(actor_id=usuario_id)
    if institucion_id:
        qs = qs.filter(institucion_id=institucion_id)
    if accion:
        qs = qs.filter(accion=accion)
    if desde:
        qs = qs.filter(creado_en__gte=desde)
    if hasta:
        qs = qs.filter(creado_en__lte=hasta)
    from saas_core.models import Institucion

    instituciones = list(
        Institucion.objects.order_by("nombre_comercial").values("id", "nombre_comercial")
    )
    return Response(
        {
            "eventos": EventoFinancieroSerializer(qs[:300], many=True).data,
            "instituciones": instituciones,
        }
    )
