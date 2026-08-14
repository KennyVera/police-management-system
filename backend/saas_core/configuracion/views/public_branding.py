"""Branding público (login + shells) — sin auth."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from saas_core.configuracion.services.config_svc import get_config


@api_view(["GET"])
@permission_classes([AllowAny])
def public_branding(request):
    cfg = get_config()
    return Response(
        {
            "nombre_sistema": cfg.nombre_sistema,
            "nombre_comercial": cfg.nombre_comercial,
            "descripcion": cfg.descripcion,
            "logo_url": cfg.logo_url,
            "favicon_url": cfg.favicon_url,
            "logo_login_url": cfg.logo_login_url,
            "logo_reportes_url": cfg.logo_reportes_url,
            "color_principal": cfg.color_principal,
            "color_secundario": cfg.color_secundario,
            "empresa_nombre": cfg.empresa_nombre,
        }
    )
