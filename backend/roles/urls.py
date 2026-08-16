from django.urls import include, path

urlpatterns = [
    path("administrador/", include("roles.administrador.urls")),
    path("visor_ejecutivo/", include("roles.visor_ejecutivo.urls")),
    path("director_zona/", include("roles.director_zona.urls")),
    path("supervisor_unidad/", include("roles.supervisor_unidad.urls")),
    path("detective/", include("roles.detective.urls")),
    path("fiscal/", include("roles.fiscal.urls")),
    path("agente_operativo/", include("roles.agente_operativo.urls")),
]
