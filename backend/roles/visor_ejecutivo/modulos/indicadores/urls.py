from django.urls import path

from .views import home, zona_ficha, zonas_list

urlpatterns = [
    path("", home, name="visor_ejecutivo-indicadores-home"),
    path("zonas/", zonas_list, name="visor_ejecutivo-ficha-zonas"),
    path("zonas/<int:pk>/", zona_ficha, name="visor_ejecutivo-ficha-zona"),
]
