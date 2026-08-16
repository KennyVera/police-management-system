from django.urls import include, path

urlpatterns = [
    path("dashboard/", include("roles.fiscal.modulos.dashboard.urls")),
    path("bandeja/", include("roles.fiscal.modulos.bandeja.urls")),
]
