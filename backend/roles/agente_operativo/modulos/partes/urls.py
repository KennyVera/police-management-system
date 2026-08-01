from django.urls import path

from .views import home

urlpatterns = [
    path("", home, name="agente_operativo-partes-home"),
]
