from django.urls import path

from . import views

urlpatterns = [
    path("estadisticas/", views.estadisticas, name="tactico-estadisticas"),
    path("mapa-calor/", views.mapa_calor, name="tactico-mapa-calor"),
    path("ranking-distritos/", views.ranking_distritos, name="tactico-ranking-distritos"),
    path("delitos-desglose/", views.delitos_desglose, name="tactico-delitos-desglose"),
    path("partes/", views.partes_auditoria, name="tactico-partes"),
]
