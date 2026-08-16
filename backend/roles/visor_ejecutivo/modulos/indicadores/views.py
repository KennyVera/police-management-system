from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EjecutivoOnly
from roles.visor_ejecutivo.modulos.indicadores.ficha_service import (
    build_ficha,
    list_zonas,
)


def _institucion(request):
    profile = getattr(request.user, "profile", None)
    return getattr(profile, "institucion", None) if profile else None


@api_view(["GET"])
@permission_classes([EjecutivoOnly])
def home(request):
    return Response(
        {
            "role": "Visor Ejecutivo (Alto Mando)",
            "module": "ficha_tecnica_jurisdiccion",
            "status": "ready",
            "message": "Ficha Técnica de Jurisdicción.",
            "user": request.user.get_username(),
        }
    )


@api_view(["GET"])
@permission_classes([EjecutivoOnly])
def zonas_list(request):
    """Dataset de zonas registradas para el Alto Mando."""
    data = list_zonas(institucion=_institucion(request))
    return Response({"count": len(data), "results": data})


@api_view(["GET"])
@permission_classes([EjecutivoOnly])
def zona_ficha(request, pk: int):
    """Radiografía completa de una zona (expediente jurisdiccional)."""
    ficha = build_ficha(pk, institucion=_institucion(request))
    if not ficha:
        return Response({"detail": "Zona no encontrada."}, status=404)
    return Response(ficha)
