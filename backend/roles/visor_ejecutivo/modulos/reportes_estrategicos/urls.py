from django.urls import path

from .views import home

urlpatterns = [
    path("", home, name="visor_ejecutivo-reportes_estrategicos-home"),
]
