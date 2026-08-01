from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.director_zona.modulos.dashboard.urls")),
    path("zonas/", include("roles.director_zona.modulos.zonas.urls")),
    path("operaciones/", include("roles.director_zona.modulos.operaciones.urls")),
]
