from datetime import date

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import AsignacionDiaria, Escuadra, GestionHorario, ParteAprehension


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def home(request):
    hoy = date.today()
    pendientes = ParteAprehension.objects.filter(
        estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
    ).count()
    escuadras_hoy = Escuadra.objects.filter(fecha=hoy, activo=True).count()
    asignaciones_hoy = AsignacionDiaria.objects.filter(fecha=hoy, activo=True).count()
    horarios_pendientes = GestionHorario.objects.filter(
        estado=GestionHorario.Estado.PENDIENTE
    ).count()

    return Response(
        {
            "role": "Supervisor de Unidad",
            "module": "dashboard",
            "status": "ready",
            "user": request.user.get_username(),
            "stats": {
                "partes_pendientes": pendientes,
                "escuadras_hoy": escuadras_hoy,
                "asignaciones_hoy": asignaciones_hoy,
                "horarios_pendientes": horarios_pendientes,
            },
        }
    )
