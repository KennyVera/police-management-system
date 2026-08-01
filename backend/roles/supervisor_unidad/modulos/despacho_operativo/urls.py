from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="sup-despacho-meta"),
    path("alertas/", views.alertas_collection, name="sup-despacho-alertas"),
    path("alertas/<int:pk>/sugerencias/", views.alerta_sugerencias, name="sup-alerta-sugerencias"),
    path("alertas/<int:pk>/asignar/", views.alerta_asignar, name="sup-alerta-asignar"),
    path("ordenes/", views.ordenes_collection, name="sup-despacho-ordenes"),
    path("ordenes/<int:pk>/decidir/", views.orden_decidir, name="sup-orden-decidir"),
]
