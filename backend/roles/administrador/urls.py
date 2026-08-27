from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.administrador.modulos.dashboard.urls")),
    path(
        "identidad_accesos/",
        include("roles.administrador.modulos.identidad_accesos.urls"),
    ),
    path(
        "estructura_organizacional/",
        include("roles.administrador.modulos.estructura_organizacional.urls"),
    ),
    path(
        "parametros_catalogos/",
        include("roles.administrador.modulos.parametros_catalogos.urls"),
    ),
    path(
        "suscripcion_uso/",
        include("roles.administrador.modulos.suscripcion_uso.urls"),
    ),
]
