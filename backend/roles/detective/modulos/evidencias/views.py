from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import DetectiveOnly


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def home(request):
    return Response(
        {
            "role": "Detective / Investigador",
            "module": "evidencias",
            "status": "ready",
            "message": "Evidencias. Listo para cadena de custodia.",
            "user": request.user.get_username(),
        }
    )
