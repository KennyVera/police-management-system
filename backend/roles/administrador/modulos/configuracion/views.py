from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import AdminOnly


@api_view(["GET"])
@permission_classes([AdminOnly])
def home(request):
    return Response(
        {
            "role": "Administrador de Institución",
            "module": "configuracion",
            "status": "ready",
            "message": "Configuración del sistema. Listo para parámetros globales.",
            "user": request.user.get_username(),
        }
    )
