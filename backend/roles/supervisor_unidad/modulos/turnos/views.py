from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def home(request):
    return Response(
        {
            "role": "Supervisor de Unidad",
            "module": "turnos",
            "status": "ready",
            "message": "Turnos y novedades. Listo para cuadrantes.",
            "user": request.user.get_username(),
        }
    )
