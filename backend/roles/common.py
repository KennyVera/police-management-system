from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response


def module_home(role_label: str, module_name: str, description: str):
    """Factory de endpoints placeholder listos para funcionalidades futuras."""

    @api_view(["GET"])
    def _view(request):
        return Response(
            {
                "role": role_label,
                "module": module_name,
                "status": "ready",
                "message": description,
                "user": request.user.username,
            }
        )

    return _view
