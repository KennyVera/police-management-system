from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="agente-registro-meta"),
    path("partes/", views.partes_collection, name="agente-partes"),
    path("partes/<int:pk>/", views.parte_detail, name="agente-parte-detail"),
    path(
        "partes/<int:pk>/enviar-revision/",
        views.parte_enviar_revision,
        name="agente-parte-enviar-revision",
    ),
    path("partes/<int:pk>/pdf/", views.parte_pdf, name="agente-parte-pdf"),
    path("novedades/", views.novedades_collection, name="agente-novedades"),
    path("novedades/<int:pk>/", views.novedad_detail, name="agente-novedad-detail"),
    path("multimedia/", views.multimedia_collection, name="agente-multimedia"),
    path(
        "multimedia/<int:pk>/archivo/",
        views.multimedia_archivo,
        name="agente-multimedia-archivo",
    ),
]
