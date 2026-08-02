from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="det-casos-meta"),
    path("", views.expedientes_collection, name="det-expedientes"),
    path("<int:pk>/", views.expediente_detail, name="det-expediente-detail"),
    path("<int:pk>/estado/", views.expediente_cambiar_estado, name="det-expediente-estado"),
    path("<int:pk>/involucrados/", views.involucrados_collection, name="det-involucrados"),
    path(
        "<int:pk>/involucrados/<int:inv_id>/",
        views.involucrado_detail,
        name="det-involucrado-detail",
    ),
    path(
        "<int:pk>/involucrados/<int:inv_id>/foto/",
        views.involucrado_foto,
        name="det-involucrado-foto",
    ),
    path(
        "<int:pk>/involucrados/<int:inv_id>/perfil/",
        views.involucrado_perfil,
        name="det-involucrado-perfil",
    ),
]
