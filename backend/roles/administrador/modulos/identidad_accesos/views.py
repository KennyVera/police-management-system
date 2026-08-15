from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import ASSIGNABLE_ROLES, AccountStatus, SystemRole, UserSession
from accounts.permissions import AdminOnly
from accounts.serializers import (
    PoliceUserCreateSerializer,
    PoliceUserSerializer,
    PoliceUserUpdateSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
)
from operativo.pagination import paginate_qs


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def usuarios_collection(request):
    institucion = getattr(getattr(request.user, "profile", None), "institucion", None)

    if request.method == "GET":
        qs = (
            User.objects.select_related(
                "profile", "profile__departamento", "profile__jurisdiccion"
            )
            .exclude(profile__role__in=[SystemRole.ADMIN_SISTEMA, SystemRole.SUPERADMIN_SAAS])
            .order_by("last_name", "first_name")
        )
        if institucion:
            qs = qs.filter(profile__institucion=institucion)
        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(profile__estado=estado)
        role = request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(email__icontains=q)
                | Q(profile__cedula__icontains=q)
                | Q(profile__placa__icontains=q)
                | Q(profile__rango_policial__icontains=q)
            )
        return paginate_qs(request, qs, PoliceUserSerializer)

    serializer = PoliceUserCreateSerializer(
        data=request.data, context={"institucion": institucion}
    )
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(PoliceUserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def usuario_detail(request, user_id):
    try:
        user = User.objects.select_related(
            "profile", "profile__departamento", "profile__jurisdiccion"
        ).get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=404)

    if request.method == "GET":
        return Response(PoliceUserSerializer(user).data)

    serializer = PoliceUserUpdateSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(PoliceUserSerializer(user).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def usuario_estado(request, user_id):
    """Suspender o dar de baja (nunca borrar)."""
    try:
        user = User.objects.select_related("profile").get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=404)

    estado = request.data.get("estado")
    if estado not in dict(AccountStatus.choices):
        return Response({"detail": "Estado inválido."}, status=400)

    user.profile.estado = estado
    user.profile.save(update_fields=["estado"])
    user.profile.sync_user_active()

    if estado != AccountStatus.ACTIVO:
        Token.objects.filter(user=user).delete()
        UserSession.objects.filter(user=user, is_active=True).update(is_active=False)

    return Response(PoliceUserSerializer(user).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def reset_password(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=404)

    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user.set_password(serializer.validated_data["new_password"])
    user.save()
    Token.objects.filter(user=user).delete()
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False)
    return Response({"detail": "Contraseña restablecida. Sesiones cerradas."})


@api_view(["POST"])
@permission_classes([AdminOnly])
def toggle_2fa(request, user_id):
    try:
        user = User.objects.select_related("profile").get(pk=user_id)
    except User.DoesNotExist:
        return Response({"detail": "Usuario no encontrado."}, status=404)

    enabled = bool(request.data.get("enabled"))
    user.profile.two_factor_enabled = enabled
    user.profile.save(update_fields=["two_factor_enabled"])
    return Response(PoliceUserSerializer(user).data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def sesiones_activas(request):
    sessions = UserSession.objects.filter(is_active=True).select_related("user")
    return Response(SessionSerializer(sessions, many=True).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def forzar_cierre_sesion(request, session_id):
    try:
        session = UserSession.objects.get(pk=session_id, is_active=True)
    except UserSession.DoesNotExist:
        return Response({"detail": "Sesión no encontrada."}, status=404)

    Token.objects.filter(key=session.token_key).delete()
    session.is_active = False
    session.save(update_fields=["is_active"])
    return Response({"detail": "Sesión cerrada forzosamente."})


@api_view(["GET"])
@permission_classes([AdminOnly])
def roles_asignables(request):
    data = [
        {"code": code, "label": dict(SystemRole.choices).get(code, code)}
        for code in ASSIGNABLE_ROLES
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def generar_identificadores(request):
    """Genera cédula y placa únicas (no existentes en BD)."""
    import random
    from django.contrib.auth.models import User

    from accounts.models import UserProfile

    def _cedula_unica():
        for _ in range(80):
            cedula = f"09{random.randint(10000000, 99999999)}"
            if UserProfile.objects.filter(cedula=cedula).exists():
                continue
            if User.objects.filter(username=cedula).exists():
                continue
            return cedula
        raise RuntimeError("No se pudo generar cédula única")

    def _placa_unica():
        for _ in range(80):
            placa = f"P-{random.randint(1000, 9999)}"
            if UserProfile.objects.filter(placa__iexact=placa).exists():
                continue
            return placa
        # fallback más largo
        for _ in range(40):
            placa = f"P-{random.randint(10000, 99999)}"
            if not UserProfile.objects.filter(placa__iexact=placa).exists():
                return placa
        raise RuntimeError("No se pudo generar placa única")

    try:
        return Response({"cedula": _cedula_unica(), "placa": _placa_unica()})
    except RuntimeError as exc:
        return Response({"detail": str(exc)}, status=500)
