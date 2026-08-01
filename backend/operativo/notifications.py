from django.utils import timezone

from operativo.models import Notificacion


def notify_user(*, user, tipo, titulo, mensaje, parte=None, enlace=""):
    return Notificacion.objects.create(
        destinatario=user,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        parte=parte,
        enlace=enlace or "",
    )


def mark_read(notif: Notificacion):
    if notif.leida:
        return notif
    notif.leida = True
    notif.leida_en = timezone.now()
    notif.save(update_fields=["leida", "leida_en"])
    return notif
