"""Comunicación vertical: disposiciones a personal de la zona."""

from __future__ import annotations

from accounts.models import SystemRole
from accounts.permissions import EsJefeDeZona
from operativo.models import DisposicionZona, Notificacion
from operativo.notifications import notify_user
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from roles.director_zona.scope import ZoneScopeError, users_in_zone, zone_scope

DEST_ROLES = {
    SystemRole.SUPERVISOR_UNIDAD,
    SystemRole.DETECTIVE,
    SystemRole.AGENTE_OPERATIVO,
}


def _serialize(d: DisposicionZona) -> dict:
    return {
        "id": d.id,
        "tipo": d.tipo,
        "tipo_label": d.get_tipo_display(),
        "prioridad": d.prioridad,
        "prioridad_label": d.get_prioridad_display(),
        "titulo": d.titulo,
        "cuerpo": d.cuerpo,
        "destinatarios_count": d.destinatarios_count,
        "jurisdiccion": getattr(d.jurisdiccion, "nombre", None) or "",
        "creado_en": d.creado_en.isoformat() if d.creado_en else None,
    }


@api_view(["GET", "POST"])
@permission_classes([EsJefeDeZona])
def disposiciones_collection(request):
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        qs = DisposicionZona.objects.filter(emisor=request.user).select_related("jurisdiccion")[
            :80
        ]
        return Response({"disposiciones": [_serialize(d) for d in qs]})

    titulo = (request.data.get("titulo") or "").strip()
    cuerpo = (request.data.get("cuerpo") or "").strip()
    tipo = (request.data.get("tipo") or DisposicionZona.Tipo.DISPOSICION).strip()
    prioridad = (request.data.get("prioridad") or DisposicionZona.Prioridad.ALTA).strip()

    if not titulo or not cuerpo:
        return Response({"detail": "titulo y cuerpo son obligatorios."}, status=400)
    if tipo not in {c.value for c in DisposicionZona.Tipo}:
        return Response({"detail": "tipo inválido."}, status=400)
    if prioridad not in {c.value for c in DisposicionZona.Prioridad}:
        return Response({"detail": "prioridad inválida."}, status=400)

    destinatarios = list(
        users_in_zone(request.user)
        .filter(profile__role__in=DEST_ROLES)
        .exclude(pk=request.user.pk)
        .distinct()
    )
    # Fallback demo: si la jurisdicción no tiene efectivos, notificar roles operativos globales
    if not destinatarios:
        from django.contrib.auth.models import User

        destinatarios = list(
            User.objects.filter(profile__role__in=DEST_ROLES)
            .exclude(pk=request.user.pk)
            .select_related("profile")[:200]
        )

    disp = DisposicionZona.objects.create(
        emisor=request.user,
        jurisdiccion_id=scope.jurisdiccion_id,
        tipo=tipo,
        prioridad=prioridad,
        titulo=titulo,
        cuerpo=cuerpo,
        destinatarios_count=len(destinatarios),
    )

    prefijo = "⚠ DISPOSICIÓN PRIORITARIA" if prioridad != DisposicionZona.Prioridad.NORMAL else "Disposición"
    for user in destinatarios:
        notify_user(
            user=user,
            tipo=Notificacion.Tipo.DISPOSICION_ZONA,
            titulo=f"{prefijo}: {titulo}",
            mensaje=cuerpo[:2000],
            enlace=_enlace_por_rol(user),
        )

    return Response(_serialize(disp), status=status.HTTP_201_CREATED)


def _enlace_por_rol(user) -> str:
    role = getattr(getattr(user, "profile", None), "role", "") or ""
    mapping = {
        SystemRole.SUPERVISOR_UNIDAD: "/app/supervisor_unidad/dashboard",
        SystemRole.DETECTIVE: "/app/detective/dashboard",
        SystemRole.AGENTE_OPERATIVO: "/app/agente_operativo/dashboard",
    }
    return mapping.get(role, "/app")


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def disposicion_detail(request, pk):
    try:
        zone_scope(request.user)
        obj = DisposicionZona.objects.select_related("jurisdiccion").get(
            pk=pk, emisor=request.user
        )
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except DisposicionZona.DoesNotExist:
        return Response({"detail": "Disposición no encontrada."}, status=404)
    return Response(_serialize(obj))
