from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import DirectorOnly


@api_view(["GET"])
@permission_classes([DirectorOnly])
def home(request):
    return Response(
        {
            "role": "Director / Jefe de Zona",
            "module": "dashboard",
            "status": "ready",
            "message": "Panel de zona. Listo para resumen territorial.",
            "user": request.user.get_username(),
        }
    )
