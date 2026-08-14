"""SuperAdmin: administradores institucionales y gestión de acceso."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import (
    DEFAULT_ADMIN_PERMISOS,
    PLATFORM_PERMISSION_CATALOG,
    AccesoEvento,
    AccountStatus,
    SystemRole,
    UserSession,
)
from accounts.serializers import SessionSerializer
from saas_core.models import Institucion
from saas_core.permissions import IsSuperAdminGlobal


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _log_acceso(*, usuario, accion, actor=None, detalle="", ip=None):
    return AccesoEvento.objects.create(
        usuario=usuario,
        actor=actor,
        accion=accion,
        detalle=detalle or "",
        ip_address=ip,
    )


def _admin_qs():
    return (
        User.objects.select_related("profile", "profile__institucion")
        .filter(profile__role=SystemRole.ADMIN_SISTEMA)
        .order_by("last_name", "first_name", "email")
    )


def _serialize_admin(user):
    p = user.profile
    inst = p.institucion
    perms = p.permisos_plataforma or []
    if not perms:
        perms = list(DEFAULT_ADMIN_PERMISOS)
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "nombre": f"{user.first_name} {user.last_name}".strip() or user.username,
        "telefono": p.telefono or "",
        "estado": p.estado,
        "estado_label": p.get_estado_display(),
        "is_active": user.is_active,
        "two_factor_enabled": p.two_factor_enabled,
        "institucion_id": inst.id if inst else None,
        "institucion_nombre": inst.nombre_comercial if inst else "Sin institución",
        "institucion_ruc": inst.ruc if inst else None,
        "es_admin_institucional": bool(
            inst and inst.admin_institucional_id == user.id
        ),
        "permisos_plataforma": perms,
        "ultima_sesion": None,
        "sesiones_activas": UserSession.objects.filter(
            user=user, is_active=True
        ).count(),
    }


def _get_admin_or_404(user_id):
    try:
        return _admin_qs().get(pk=user_id)
    except User.DoesNotExist:
        return None


def _enrich_ultima_sesion(items):
    user_ids = [i["id"] for i in items]
    sessions = UserSession.objects.filter(user_id__in=user_ids).order_by("-last_seen")
    latest = {}
    for s in sessions:
        if s.user_id not in latest:
            latest[s.user_id] = s.last_seen.isoformat() if s.last_seen else None
    for item in items:
        item["ultima_sesion"] = latest.get(item["id"])
    return items


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucionales_list(request):
    qs = _admin_qs()
    estado = request.query_params.get("estado")
    if estado:
        qs = qs.filter(profile__estado=estado)
    institucion_id = request.query_params.get("institucion_id")
    if institucion_id:
        qs = qs.filter(profile__institucion_id=institucion_id)
    q = request.query_params.get("q")
    if q:
        qs = qs.filter(
            Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(email__icontains=q)
            | Q(profile__institucion__nombre_comercial__icontains=q)
        )
    items = _enrich_ultima_sesion([_serialize_admin(u) for u in qs[:200]])
    instituciones = list(
        Institucion.objects.order_by("nombre_comercial").values(
            "id", "nombre_comercial", "ruc"
        )
    )
    return Response(
        {
            "administradores": items,
            "instituciones": instituciones,
            "permisos_catalogo": PLATFORM_PERMISSION_CATALOG,
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_detalle(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    if request.method == "GET":
        data = _serialize_admin(user)
        _enrich_ultima_sesion([data])
        return Response(data)

    data = request.data
    changed = []
    if "first_name" in data:
        user.first_name = (data.get("first_name") or "").strip()
        changed.append("first_name")
    if "last_name" in data:
        user.last_name = (data.get("last_name") or "").strip()
        changed.append("last_name")
    if "email" in data:
        email = (data.get("email") or "").strip().lower()
        if (
            email
            and User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
        ):
            return Response({"detail": "Ya existe un usuario con este correo."}, status=400)
        user.email = email
        changed.append("email")
    if changed:
        user.save(update_fields=changed)

    profile = user.profile
    profile_fields = []
    if "telefono" in data:
        profile.telefono = (data.get("telefono") or "").strip()
        profile_fields.append("telefono")
    if "institucion_id" in data:
        inst_id = data.get("institucion_id")
        if inst_id in (None, "", 0, "0"):
            profile.institucion = None
        else:
            try:
                profile.institucion = Institucion.objects.get(pk=inst_id)
            except Institucion.DoesNotExist:
                return Response({"detail": "Institución no encontrada."}, status=404)
        profile_fields.append("institucion")
    if "two_factor_enabled" in data:
        profile.two_factor_enabled = bool(data.get("two_factor_enabled"))
        profile_fields.append("two_factor_enabled")
    if profile_fields:
        profile.save(update_fields=profile_fields)

    # Marcar como admin institucional del tenant si se solicita
    if data.get("marcar_admin_institucional") and profile.institucion_id:
        inst = profile.institucion
        inst.admin_institucional = user
        inst.save(update_fields=["admin_institucional"])

    _log_acceso(
        usuario=user,
        accion=AccesoEvento.Accion.EDITAR,
        actor=request.user,
        detalle="Actualización de datos por SuperAdmin",
        ip=_client_ip(request),
    )
    data_out = _serialize_admin(user)
    _enrich_ultima_sesion([data_out])
    return Response(data_out)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_estado(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    estado = request.data.get("estado")
    if estado not in dict(AccountStatus.choices):
        return Response({"detail": "Estado inválido."}, status=400)

    user.profile.estado = estado
    user.profile.save(update_fields=["estado"])
    user.profile.sync_user_active()

    if estado != AccountStatus.ACTIVO:
        Token.objects.filter(user=user).delete()
        UserSession.objects.filter(user=user, is_active=True).update(is_active=False)
        accion = AccesoEvento.Accion.DESACTIVAR
    else:
        accion = AccesoEvento.Accion.ACTIVAR

    _log_acceso(
        usuario=user,
        accion=accion,
        actor=request.user,
        detalle=request.data.get("nota") or f"Estado → {estado}",
        ip=_client_ip(request),
    )
    return Response(_serialize_admin(user))


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_restablecer(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    new_password = request.data.get("new_password") or ""
    if len(new_password) < 8:
        return Response(
            {"detail": "La contraseña debe tener al menos 8 caracteres."}, status=400
        )

    user.set_password(new_password)
    user.save()
    Token.objects.filter(user=user).delete()
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

    # Reactivar si estaba suspendido (opcional)
    if request.data.get("reactivar"):
        user.profile.estado = AccountStatus.ACTIVO
        user.profile.save(update_fields=["estado"])
        user.profile.sync_user_active()

    _log_acceso(
        usuario=user,
        accion=AccesoEvento.Accion.RESTABLECER,
        actor=request.user,
        detalle="Contraseña restablecida; sesiones cerradas",
        ip=_client_ip(request),
    )
    return Response({"detail": "Acceso restablecido. Sesiones cerradas."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_revocar(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    user.profile.estado = AccountStatus.BAJA
    user.profile.save(update_fields=["estado"])
    user.profile.sync_user_active()
    Token.objects.filter(user=user).delete()
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

    # Si era admin_institucional del tenant, limpiar referencia
    Institucion.objects.filter(admin_institucional=user).update(admin_institucional=None)

    _log_acceso(
        usuario=user,
        accion=AccesoEvento.Accion.REVOCAR,
        actor=request.user,
        detalle=request.data.get("nota") or "Acceso revocado (baja)",
        ip=_client_ip(request),
    )
    return Response(_serialize_admin(user))


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_permisos(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    if request.method == "GET":
        perms = user.profile.permisos_plataforma or list(DEFAULT_ADMIN_PERMISOS)
        return Response(
            {
                "user_id": user.id,
                "permisos": perms,
                "catalogo": PLATFORM_PERMISSION_CATALOG,
            }
        )

    permisos = request.data.get("permisos")
    if not isinstance(permisos, list):
        return Response({"detail": "permisos debe ser una lista."}, status=400)
    valid = {p["code"] for p in PLATFORM_PERMISSION_CATALOG}
    cleaned = [str(c) for c in permisos if str(c) in valid]
    user.profile.permisos_plataforma = cleaned
    user.profile.save(update_fields=["permisos_plataforma"])
    _log_acceso(
        usuario=user,
        accion=AccesoEvento.Accion.PERMISOS,
        actor=request.user,
        detalle=f"Permisos: {', '.join(cleaned) or '(ninguno)'}",
        ip=_client_ip(request),
    )
    return Response(
        {
            "user_id": user.id,
            "permisos": cleaned,
            "catalogo": PLATFORM_PERMISSION_CATALOG,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_institucional_actividad(request, user_id):
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)

    eventos = (
        AccesoEvento.objects.filter(usuario=user)
        .select_related("actor")
        .order_by("-creado_en")[:100]
    )
    sesiones = (
        UserSession.objects.filter(user=user)
        .order_by("-last_seen")[:50]
    )
    return Response(
        {
            "administrador": _serialize_admin(user),
            "eventos": [
                {
                    "id": e.id,
                    "accion": e.accion,
                    "accion_label": e.get_accion_display(),
                    "detalle": e.detalle,
                    "ip_address": e.ip_address,
                    "actor_email": e.actor.email if e.actor_id else None,
                    "creado_en": e.creado_en.isoformat() if e.creado_en else None,
                }
                for e in eventos
            ],
            "sesiones": SessionSerializer(sesiones, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def acceso_sesiones(request):
    """Sesiones activas de administradores institucionales (y opcionalmente todas)."""
    solo_admins = request.query_params.get("todos") != "1"
    qs = UserSession.objects.filter(is_active=True).select_related(
        "user", "user__profile", "user__profile__institucion"
    )
    if solo_admins:
        qs = qs.filter(user__profile__role=SystemRole.ADMIN_SISTEMA)
    qs = qs.order_by("-last_seen")[:200]
    data = []
    for s in qs:
        row = SessionSerializer(s).data
        p = getattr(s.user, "profile", None)
        row["role"] = p.role if p else None
        row["institucion_nombre"] = (
            p.institucion.nombre_comercial
            if p and p.institucion_id
            else None
        )
        data.append(row)
    return Response({"sesiones": data})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def acceso_cerrar_sesion(request, session_id):
    try:
        session = UserSession.objects.select_related("user").get(
            pk=session_id, is_active=True
        )
    except UserSession.DoesNotExist:
        return Response({"detail": "Sesión no encontrada."}, status=404)

    Token.objects.filter(key=session.token_key).delete()
    session.is_active = False
    session.save(update_fields=["is_active"])
    _log_acceso(
        usuario=session.user,
        accion=AccesoEvento.Accion.CERRAR_SESION,
        actor=request.user,
        detalle=f"Sesión #{session.id} cerrada por SuperAdmin",
        ip=_client_ip(request),
    )
    return Response({"detail": "Sesión cerrada."})


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def acceso_cerrar_sesiones_usuario(request):
    user_id = request.data.get("user_id")
    user = _get_admin_or_404(user_id)
    if not user:
        return Response({"detail": "Administrador no encontrado."}, status=404)
    Token.objects.filter(user=user).delete()
    n = UserSession.objects.filter(user=user, is_active=True).update(is_active=False)
    _log_acceso(
        usuario=user,
        accion=AccesoEvento.Accion.CERRAR_SESION,
        actor=request.user,
        detalle=f"Cierre masivo: {n} sesión(es)",
        ip=_client_ip(request),
    )
    return Response({"detail": f"{n} sesión(es) cerrada(s)."})


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def acceso_historial(request):
    qs = AccesoEvento.objects.select_related(
        "usuario", "usuario__profile", "usuario__profile__institucion", "actor"
    ).order_by("-creado_en")

    user_id = request.query_params.get("user_id")
    if user_id:
        qs = qs.filter(usuario_id=user_id)
    accion = request.query_params.get("accion")
    if accion:
        qs = qs.filter(accion=accion)

    # Solo eventos de admins institucionales por defecto
    if request.query_params.get("todos") != "1":
        qs = qs.filter(usuario__profile__role=SystemRole.ADMIN_SISTEMA)

    eventos = []
    for e in qs[:150]:
        p = getattr(e.usuario, "profile", None)
        eventos.append(
            {
                "id": e.id,
                "accion": e.accion,
                "accion_label": e.get_accion_display(),
                "detalle": e.detalle,
                "ip_address": e.ip_address,
                "creado_en": e.creado_en.isoformat() if e.creado_en else None,
                "usuario_id": e.usuario_id,
                "usuario_email": e.usuario.email,
                "usuario_nombre": (
                    f"{e.usuario.first_name} {e.usuario.last_name}".strip()
                    or e.usuario.username
                ),
                "institucion_nombre": (
                    p.institucion.nombre_comercial
                    if p and p.institucion_id
                    else None
                ),
                "actor_email": e.actor.email if e.actor_id else None,
            }
        )
    return Response({"historial": eventos})
