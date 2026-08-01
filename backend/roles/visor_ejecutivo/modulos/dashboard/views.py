from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EjecutivoOnly


@api_view(["GET"])
@permission_classes([EjecutivoOnly])
def home(request):
    return Response(
        {
            "role": "Visor Ejecutivo (Alto Mando)",
            "module": "dashboard",
            "status": "ready",
            "message": "Tablero ejecutivo. Listo para KPIs estratégicos.",
            "user": request.user.get_username(),
        }
    )
