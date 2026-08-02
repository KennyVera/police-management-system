from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="det-actividades-meta"),
    path("<int:pk>/bitacora/", views.bitacora_collection, name="det-bitacora"),
    path(
        "<int:pk>/bitacora/<int:entry_id>/",
        views.bitacora_detail,
        name="det-bitacora-detail",
    ),
    path("<int:pk>/bienes/", views.bienes_collection, name="det-bienes"),
    path("<int:pk>/bienes/<int:bien_id>/", views.bien_detail, name="det-bien-detail"),
    path(
        "<int:pk>/solicitudes/",
        views.solicitudes_collection,
        name="det-solicitudes",
    ),
    path(
        "<int:pk>/solicitudes/<int:sol_id>/enviar/",
        views.solicitud_enviar,
        name="det-solicitud-enviar",
    ),
    path("<int:pk>/informe/", views.informe_get, name="det-informe"),
    path("<int:pk>/cerrar/", views.cerrar_con_informe, name="det-cerrar"),
]
