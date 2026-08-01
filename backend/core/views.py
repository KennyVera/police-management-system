from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import cache_page
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    db_ok = False
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"status": "degraded", "database": False, "detail": str(exc)},
            status=503,
        )

    redis_ok = False
    try:
        cache.set("sgp:healthcheck", "ok", timeout=10)
        redis_ok = cache.get("sgp:healthcheck") == "ok"
    except Exception:  # noqa: BLE001
        redis_ok = False

    return Response(
        {
            "status": "ok" if db_ok else "degraded",
            "service": "police-management-backend",
            "database": db_ok,
            "cache": redis_ok,
        }
    )


# Ejemplo 1: caché de página completa (60s) — evita recalcular la respuesta
@cache_page(60)
@api_view(["GET"])
@permission_classes([AllowAny])
def catalogos_meta_cached(request):
    from catalogos.models import CatalogoOperativoTipo

    return Response(
        {
            "source": "db_or_cache_page",
            "tipos_catalogo_operativo": [
                {"code": c, "label": l} for c, l in CatalogoOperativoTipo.choices
            ],
        }
    )


# Ejemplo 2: caché manual con cache.set / cache.get
@api_view(["GET"])
@permission_classes([AllowAny])
def delitos_count_cached(request):
    key = "catalogos:tipos_delito:count"
    total = cache.get(key)
    from_cache = total is not None
    if not from_cache:
        from catalogos.models import TipoDelito

        total = TipoDelito.objects.filter(activo=True).count()
        cache.set(key, total, timeout=120)  # 2 minutos

    return Response({"total_delitos_activos": total, "from_cache": from_cache})


def root(_request):
    return JsonResponse(
        {
            "message": "Sistema de Gestión Policial API",
            "auth": "/api/auth/login/",
            "health": "/api/health/",
            "cache_examples": [
                "/api/cache/catalogos-meta/",
                "/api/cache/delitos-count/",
            ],
        }
    )
