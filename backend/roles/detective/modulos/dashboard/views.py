from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import DetectiveOnly
from operativo.models import EvidenciaCaso, ExpedienteCaso


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def home(request):
    casos = ExpedienteCaso.objects.filter(detective_asignado=request.user)
    evidencias = EvidenciaCaso.objects.filter(expediente__detective_asignado=request.user)
    return Response(
        {
            "casos_asignados": casos.count(),
            "en_indagacion": casos.filter(
                estado=ExpedienteCaso.Estado.INDAGACION_PREVIA
            ).count(),
            "en_instruccion": casos.filter(
                estado=ExpedienteCaso.Estado.INSTRUCCION_FISCAL
            ).count(),
            "evidencias": evidencias.count(),
            "digitales": evidencias.filter(tipo=EvidenciaCaso.Tipo.DIGITAL).count(),
            "fisicas": evidencias.filter(tipo=EvidenciaCaso.Tipo.FISICA).count(),
        }
    )
