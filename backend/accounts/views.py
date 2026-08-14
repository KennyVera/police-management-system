from django.contrib.auth import login
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccesoEvento, SystemRole, UserSession
from .serializers import LoginSerializer, UserSerializer


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    token, _ = Token.objects.get_or_create(user=user)
    ip = _client_ip(request)

    UserSession.objects.update_or_create(
        token_key=token.key,
        defaults={
            "user": user,
            "ip_address": ip,
            "user_agent": (request.META.get("HTTP_USER_AGENT") or "")[:255],
            "last_seen": timezone.now(),
            "is_active": True,
        },
    )

    if getattr(user, "profile", None) and user.profile.role in (
        SystemRole.ADMIN_SISTEMA,
        SystemRole.SUPERADMIN_SAAS,
    ):
        AccesoEvento.objects.create(
            usuario=user,
            actor=user,
            accion=AccesoEvento.Accion.LOGIN,
            detalle="Login exitoso",
            ip_address=ip,
        )

    if serializer.validated_data.get("remember"):
        login(request, user)

    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
            "redirect": f"/app/{user.profile.role_slug}",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    auth = request.auth
    key = getattr(auth, "key", None)
    ip = _client_ip(request)
    if key:
        UserSession.objects.filter(token_key=key).update(is_active=False)
        Token.objects.filter(key=key).delete()
    else:
        Token.objects.filter(user=request.user).delete()
        UserSession.objects.filter(user=request.user, is_active=True).update(is_active=False)

    if getattr(request.user, "profile", None) and request.user.profile.role in (
        SystemRole.ADMIN_SISTEMA,
        SystemRole.SUPERADMIN_SAAS,
    ):
        AccesoEvento.objects.create(
            usuario=request.user,
            actor=request.user,
            accion=AccesoEvento.Accion.LOGOUT,
            detalle="Logout",
            ip_address=ip,
        )
    return Response({"detail": "Sesión cerrada."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def roles_catalog(request):
    from .models import SystemRole, ROLE_ROUTE_MAP

    data = [
        {
            "code": code,
            "label": label,
            "slug": ROLE_ROUTE_MAP[code],
        }
        for code, label in SystemRole.choices
    ]
    return Response(data)
