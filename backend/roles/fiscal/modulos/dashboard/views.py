from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import FiscalOnly
from operativo.models import AsignacionCaso


@api_view(["GET"])
@permission_classes([FiscalOnly])
def home(request):
    qs = AsignacionCaso.objects.all()
    return Response(
        {
            "role": "Fiscal de Turno",
            "module": "dashboard",
            "status": "ready",
            "kpis": {
                "pendientes": qs.filter(estado=AsignacionCaso.Estado.PENDIENTE_FISCAL).count(),
                "despacho_admin": qs.filter(estado=AsignacionCaso.Estado.DESPACHO_ADMIN).count(),
                "en_investigacion": qs.filter(
                    estado=AsignacionCaso.Estado.EN_INVESTIGACION
                ).count(),
                "mios": qs.filter(fiscal=request.user).exclude(
                    estado=AsignacionCaso.Estado.PENDIENTE_FISCAL
                ).count(),
            },
        }
    )
