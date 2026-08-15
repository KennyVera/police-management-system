from django.contrib.auth import login
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import AccesoEvento, SystemRole, UserSession
from operativo.minio_service import download_object, upload_evidencia
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    UserSerializer,
)

AVATAR_FOLDER = "perfil-avatars"
ALLOWED_AVATAR_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
MAX_AVATAR_BYTES = 3 * 1024 * 1024


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


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me_view(request):
    if request.method == "GET":
        return Response(UserSerializer(request.user).data)

    serializer = MeUpdateSerializer(
        data=request.data, context={"request": request}, partial=True
    )
    serializer.is_valid(raise_exception=True)
    user = serializer.update(request.user, serializer.validated_data)
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(
        data=request.data, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    user = request.user
    user.set_password(serializer.validated_data["new_password"])
    user.save()
    # Cierra otras sesiones / tokens
    Token.objects.filter(user=user).delete()
    UserSession.objects.filter(user=user, is_active=True).update(is_active=False)
    token = Token.objects.create(user=user)
    UserSession.objects.create(
        user=user,
        token_key=token.key,
        ip_address=_client_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
        is_active=True,
    )
    return Response(
        {
            "detail": "Contraseña actualizada.",
            "token": token.key,
            "user": UserSerializer(user).data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar_view(request):
    archivo = request.FILES.get("file") or request.FILES.get("avatar")
    if not archivo:
        return Response({"detail": "Archivo requerido (file)."}, status=400)

    content_type = (archivo.content_type or "").lower()
    if content_type not in ALLOWED_AVATAR_TYPES:
        return Response(
            {"detail": "Solo imágenes PNG, JPG o WEBP."},
            status=400,
        )
    data = archivo.read()
    if len(data) > MAX_AVATAR_BYTES:
        return Response({"detail": "Máximo 3 MB."}, status=400)

    try:
        stored = upload_evidencia(
            file_bytes=data,
            filename=archivo.name,
            content_type=content_type,
            folder=AVATAR_FOLDER,
        )
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo subir la foto: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    url = f"/api/auth/avatars/{stored['object_key']}"
    profile = request.user.profile
    profile.avatar_url = url
    profile.save(update_fields=["avatar_url"])
    return Response(
        {"avatar_url": url, "user": UserSerializer(request.user).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def avatar_proxy(request, object_key: str):
    if ".." in object_key or not object_key.startswith(f"{AVATAR_FOLDER}/"):
        return Response({"detail": "Recurso no válido."}, status=404)
    try:
        raw = download_object(object_key)
    except Exception:  # noqa: BLE001
        return Response({"detail": "Archivo no encontrado."}, status=404)

    ctype = "image/jpeg"
    lower = object_key.lower()
    if lower.endswith(".png"):
        ctype = "image/png"
    elif lower.endswith(".webp"):
        ctype = "image/webp"
    resp = HttpResponse(raw, content_type=ctype)
    resp["Cache-Control"] = "public, max-age=86400"
    return resp


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
