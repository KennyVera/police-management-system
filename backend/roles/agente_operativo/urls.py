from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.agente_operativo.modulos.dashboard.urls")),
    path(
        "registro_operativo/",
        include("roles.agente_operativo.modulos.registro_operativo.urls"),
    ),
    path(
        "despacho_tareas/",
        include("roles.agente_operativo.modulos.despacho_tareas.urls"),
    ),
]
