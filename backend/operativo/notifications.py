from django.utils import timezone
from django.core.cache import cache

from operativo.models import Notificacion


def _bump_notif_stream(user_id: int, notif_id: int):
    cache.set(f"notif_stream:{user_id}", notif_id, timeout=3600)


def notify_user(*, user, tipo, titulo, mensaje, parte=None, enlace=""):
    n = Notificacion.objects.create(
        destinatario=user,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        parte=parte,
        enlace=enlace or "",
    )
    _bump_notif_stream(user.id, n.id)
    return n


def mark_read(notif: Notificacion):
    if notif.leida:
        return notif
    notif.leida = True
    notif.leida_en = timezone.now()
    notif.save(update_fields=["leida", "leida_en"])
    return notif
