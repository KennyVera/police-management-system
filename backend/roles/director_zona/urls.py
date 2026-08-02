from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.director_zona.modulos.dashboard.urls")),
    path("zonas/", include("roles.director_zona.modulos.zonas.urls")),
    path("operaciones/", include("roles.director_zona.modulos.operaciones.urls")),
    path("supervision/", include("roles.director_zona.modulos.supervision.urls")),
    path("personal/", include("roles.director_zona.modulos.personal.urls")),
    path("reportes/", include("roles.director_zona.modulos.reportes.urls")),
    path("comunicacion/", include("roles.director_zona.modulos.comunicacion.urls")),
]
