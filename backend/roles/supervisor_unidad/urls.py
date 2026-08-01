from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.supervisor_unidad.modulos.dashboard.urls")),
    path(
        "logistica_turnos/",
        include("roles.supervisor_unidad.modulos.logistica_turnos.urls"),
    ),
    path(
        "despacho_operativo/",
        include("roles.supervisor_unidad.modulos.despacho_operativo.urls"),
    ),
    path(
        "control_calidad/",
        include("roles.supervisor_unidad.modulos.revision_partes.urls"),
    ),
]
