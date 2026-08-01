from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import AgenteOnly


@api_view(["GET"])
@permission_classes([AgenteOnly])
def home(request):
    return Response(
        {
            "role": "Agente Operativo",
            "module": "partes",
            "status": "ready",
            "message": "Partes policiales. Listo para registro de incidencias.",
            "user": request.user.get_username(),
        }
    )
