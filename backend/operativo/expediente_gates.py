"""Gates de edición para expedientes del detective."""

from rest_framework import status
from rest_framework.response import Response

from operativo.models import ExpedienteCaso


def expediente_edit_blocked(exp, *, require_started: bool = True):
    """
    Devuelve Response 403 si no se puede editar, o None si OK.
    - Bloqueado / cerrado → nunca editar
    - Sin iniciar investigación → no editar (salvo require_started=False)
    """
    if exp.bloqueado or exp.estado == ExpedienteCaso.Estado.CERRADO:
        return Response(
            {"detail": "Expediente bloqueado (completado / enviado a Fiscalía)."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if require_started and not getattr(exp, "investigacion_iniciada", False):
        return Response(
            {
                "detail": (
                    "Debes pulsar «Iniciar investigación» antes de registrar "
                    "cambios en el expediente."
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None
