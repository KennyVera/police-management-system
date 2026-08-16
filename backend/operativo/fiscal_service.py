"""Remisión automática de partes aprobados a la bandeja del Fiscal de Turno."""

from __future__ import annotations

from django.contrib.auth.models import User

from accounts.models import AccountStatus, SystemRole
from operativo.models import AsignacionCaso, Notificacion, ParteAprehension
from operativo.notifications import notify_user


def fiscales_activos_qs():
    return User.objects.filter(
        profile__role=SystemRole.FISCAL,
        profile__estado=AccountStatus.ACTIVO,
        is_active=True,
    ).select_related("profile")


def remitir_parte_a_fiscalia(parte: ParteAprehension) -> AsignacionCaso:
    """
    Crea (o reutiliza) AsignacionCaso al aprobar el parte y notifica a los fiscales.
    """
    asig, created = AsignacionCaso.objects.get_or_create(
        parte=parte,
        defaults={"estado": AsignacionCaso.Estado.PENDIENTE_FISCAL},
    )
    if not created and asig.estado != AsignacionCaso.Estado.PENDIENTE_FISCAL:
        return asig

    caso_label = parte.numero_caso or f"#{parte.id}"
    delito = getattr(parte.tipo_delito, "nombre", None) or parte.titulo or "delito"
    for fiscal in fiscales_activos_qs():
        notify_user(
            user=fiscal,
            tipo=Notificacion.Tipo.PARTE_FISCAL,
            titulo="Nuevo parte en bandeja fiscal",
            mensaje=(
                f"El parte {caso_label} ({delito}) fue aprobado por el supervisor "
                "y espera tu decisión jurídica."
            ),
            parte=parte,
            enlace="/app/fiscal/bandeja",
        )
    return asig
