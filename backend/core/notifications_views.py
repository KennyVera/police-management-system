from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from operativo.models import Notificacion
from operativo.notifications import mark_read
from operativo.serializers import NotificacionSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notificaciones(request):
    qs = Notificacion.objects.filter(destinatario=request.user)
    solo = request.query_params.get("unread")
    if solo in ("1", "true", "yes"):
        qs = qs.filter(leida=False)
    data = NotificacionSerializer(qs[:50], many=True).data
    unread = Notificacion.objects.filter(destinatario=request.user, leida=False).count()
    return Response({"unread": unread, "items": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def marcar_leida(request, pk):
    try:
        n = Notificacion.objects.get(pk=pk, destinatario=request.user)
    except Notificacion.DoesNotExist:
        return Response({"detail": "Notificación no encontrada."}, status=404)
    mark_read(n)
    return Response(NotificacionSerializer(n).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def marcar_todas_leidas(request):
    now = timezone.now()
    Notificacion.objects.filter(destinatario=request.user, leida=False).update(
        leida=True, leida_en=now
    )
    return Response({"ok": True})
