from django.urls import path

from . import views

urlpatterns = [
    path("resumen/", views.resumen, name="agente-despacho-resumen"),
    path("mi-turno/", views.mi_turno, name="agente-mi-turno"),
    path("alertas/", views.alertas_collection, name="agente-alertas"),
    path("alertas/<int:pk>/", views.alerta_detail, name="agente-alerta-detail"),
    path("alertas/<int:pk>/en-camino/", views.alerta_en_camino, name="agente-alerta-en-camino"),
    path("alertas/<int:pk>/llegada/", views.alerta_llegada, name="agente-alerta-llegada"),
    path("alertas/<int:pk>/cerrar/", views.alerta_cerrar, name="agente-alerta-cerrar"),
]
