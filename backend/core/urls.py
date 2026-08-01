from django.urls import path

from .views import catalogos_meta_cached, delitos_count_cached, health, root
from . import notifications_views

urlpatterns = [
    path("", root, name="api-root"),
    path("health/", health, name="health"),
    path("cache/catalogos-meta/", catalogos_meta_cached, name="cache-catalogos-meta"),
    path("cache/delitos-count/", delitos_count_cached, name="cache-delitos-count"),
    path("notificaciones/", notifications_views.list_notificaciones, name="notificaciones"),
    path(
        "notificaciones/leer-todas/",
        notifications_views.marcar_todas_leidas,
        name="notificaciones-leer-todas",
    ),
    path(
        "notificaciones/<int:pk>/leer/",
        notifications_views.marcar_leida,
        name="notificaciones-leer",
    ),
]
