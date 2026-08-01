from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.visor_ejecutivo.modulos.dashboard.urls")),
    path("reportes_estrategicos/", include("roles.visor_ejecutivo.modulos.reportes_estrategicos.urls")),
    path("indicadores/", include("roles.visor_ejecutivo.modulos.indicadores.urls")),
]
