from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import AgenteOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    MultimediaEvidencia,
    NovedadIncidente,
    ParteAprehension,
)


@api_view(["GET"])
@permission_classes([AgenteOnly])
def home(request):
    user = request.user
    hoy = timezone.localdate()
    partes = ParteAprehension.objects.filter(creado_por=user).count()
    novedades = NovedadIncidente.objects.filter(creado_por=user).count()
    multimedia = MultimediaEvidencia.objects.filter(subido_por=user).count()
    alertas = (
        AlertaDespacho.objects.filter(
            Q(agente=user)
            | Q(escuadra__agente_lider=user)
            | Q(escuadra__companeros=user),
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ],
        )
        .distinct()
        .count()
    )
    tiene_turno = AsignacionDiaria.objects.filter(
        agente=user, fecha=hoy, activo=True
    ).exists()
    return Response(
        {
            "role": "Agente Operativo",
            "module": "dashboard",
            "status": "ready",
            "message": "Panel operativo. Listo para jornada en calle.",
            "user": user.get_username(),
            "stats": {
                "partes": partes,
                "novedades": novedades,
                "multimedia": multimedia,
                "alertas_activas": alertas,
                "tiene_turno_hoy": tiene_turno,
            },
        }
    )
