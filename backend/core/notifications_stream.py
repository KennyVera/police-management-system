import json
import time

from django.http import StreamingHttpResponse
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated

from operativo.models import Notificacion
from operativo.serializers import NotificacionSerializer


class QueryTokenAuthentication(TokenAuthentication):
    """Permite autenticación SSE vía ?token= en la URL."""

    keyword = "Token"

    def authenticate(self, request):
        raw = request.GET.get("token")
        if raw:
            return self.authenticate_credentials(raw)
        return super().authenticate(request)


@api_view(["GET"])
@authentication_classes([QueryTokenAuthentication])
@permission_classes([IsAuthenticated])
def stream_notificaciones(request):
    """SSE: empuja notificaciones nuevas al cliente (~cada 3 s, máx. 2 min)."""

    def event_stream():
        try:
            since = int(request.query_params.get("since", 0))
        except (TypeError, ValueError):
            since = 0
        last_id = since
        ticks = 0
        while ticks < 40:
            qs = (
                Notificacion.objects.filter(destinatario=request.user, pk__gt=last_id)
                .order_by("id")[:20]
            )
            for n in qs:
                last_id = n.id
                payload = json.dumps(NotificacionSerializer(n).data, default=str)
                yield f"data: {payload}\n\n"
            unread = Notificacion.objects.filter(
                destinatario=request.user, leida=False
            ).count()
            yield f"event: ping\ndata: {json.dumps({'unread': unread, 'last_id': last_id})}\n\n"
            ticks += 1
            time.sleep(3)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
