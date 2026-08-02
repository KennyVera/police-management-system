from django.urls import path

from . import views

urlpatterns = [
    path("unidades/", views.unidades_gps, name="sup-monitoreo-unidades"),
    path("estadisticas/", views.estadisticas, name="sup-monitoreo-stats"),
]
