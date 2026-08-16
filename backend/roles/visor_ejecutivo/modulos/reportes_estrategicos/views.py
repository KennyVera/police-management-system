from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EjecutivoOnly
from .views_reportes import REPORTES_CATALOGO


@api_view(["GET"])
@permission_classes([EjecutivoOnly])
def home(request):
    return Response(
        {
            "role": "Visor Ejecutivo (Alto Mando)",
            "module": "reportes_estrategicos",
            "status": "ready",
            "message": "Reportes estratégicos de alto mando. Catálogo y stubs de descarga activos.",
            "user": request.user.get_username(),
            "reportes": [r["slug"] for r in REPORTES_CATALOGO],
            "catalogo": "/api/roles/visor_ejecutivo/reportes_estrategicos/catalogo/",
        }
    )
