"""Views de configuración global por sección."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from saas_core.configuracion.services.config_svc import (
    SECCIONES,
    apply_seccion,
    get_config,
    serialize_seccion,
)
from saas_core.models import ConfigAuditoria
from saas_core.permissions import IsSuperAdminGlobal

PERMS = [IsAuthenticated, IsSuperAdminGlobal]


def _section_view(seccion: str):
    @api_view(["GET", "PATCH"])
    @permission_classes(PERMS)
    def view(request):
        if request.method == "GET":
            return Response(serialize_seccion(get_config(), seccion))
        try:
            data = apply_seccion(seccion, request.data, actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(data)

    view.__name__ = f"config_{seccion}"
    return view


identidad = _section_view("identidad")
apariencia = _section_view("apariencia")
regional = _section_view("regional")
comunicaciones = _section_view("comunicaciones")
plataforma = _section_view("plataforma")


@api_view(["GET"])
@permission_classes(PERMS)
def auditoria(request):
    qs = ConfigAuditoria.objects.select_related("actor").all()
    seccion = request.query_params.get("seccion")
    if seccion:
        qs = qs.filter(seccion=seccion)
    items = [
        {
            "id": e.id,
            "seccion": e.seccion,
            "campo": e.campo,
            "valor_anterior": e.valor_anterior,
            "valor_nuevo": e.valor_nuevo,
            "actor_email": e.actor.email if e.actor_id else None,
            "creado_en": e.creado_en.isoformat() if e.creado_en else None,
        }
        for e in qs[:200]
    ]
    return Response({"eventos": items, "secciones": list(SECCIONES.keys())})


@api_view(["GET"])
@permission_classes(PERMS)
def resumen(request):
    cfg = get_config()
    return Response({s: serialize_seccion(cfg, s) for s in SECCIONES})
