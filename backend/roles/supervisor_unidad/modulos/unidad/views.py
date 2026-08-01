from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def home(request):
    return Response(
        {
            "role": "Supervisor de Unidad",
            "module": "unidad",
            "status": "ready",
            "message": "Gestión de unidad. Listo para personal asignado.",
            "user": request.user.get_username(),
        }
    )
