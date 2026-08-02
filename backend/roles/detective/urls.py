from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.detective.modulos.dashboard.urls")),
    path("casos/", include("roles.detective.modulos.casos.urls")),
    path("evidencias/", include("roles.detective.modulos.evidencias.urls")),
    path("actividades/", include("roles.detective.modulos.actividades.urls")),
]
