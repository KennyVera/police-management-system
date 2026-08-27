"""Bitácora / auditoría automática de expedientes."""

from __future__ import annotations

from django.utils import timezone

from operativo.models import BitacoraInvestigacion


def registrar_bitacora(
    *,
    expediente,
    user,
    relato: str,
    tipo: str = BitacoraInvestigacion.TipoAccion.SISTEMA,
    lugar: str = "",
):
    """Registra una entrada de auditoría en la bitácora del expediente."""
    if not expediente or not user:
        return None
    texto = (relato or "").strip()
    if not texto:
        return None
    return BitacoraInvestigacion.objects.create(
        expediente=expediente,
        tipo=tipo,
        fecha_hora=timezone.now(),
        lugar=(lugar or "").strip(),
        relato=texto[:4000],
        registrado_por=user,
    )
