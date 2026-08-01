from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="sup-logistica-meta"),
    path("escuadras/", views.escuadras_collection, name="sup-escuadras"),
    path("escuadras/<int:pk>/", views.escuadra_detail, name="sup-escuadra-detail"),
    path("escuadras/<int:pk>/inactivar/", views.escuadra_inactivar, name="sup-escuadra-inactivar"),
    path(
        "escuadras/<int:pk>/asignar_vehiculo/",
        views.escuadra_asignar_vehiculo,
        name="sup-escuadra-asignar-vehiculo",
    ),
    path("vehiculos/", views.vehiculos_collection, name="sup-vehiculos"),
    path("vehiculos/<int:pk>/", views.vehiculo_detail, name="sup-vehiculo-detail"),
    path("asignaciones/", views.asignaciones_collection, name="sup-asignaciones"),
    path("asignaciones/<int:pk>/", views.asignacion_detail, name="sup-asignacion-detail"),
    path("horarios/", views.horarios_collection, name="sup-horarios"),
    path("horarios/<int:pk>/decidir/", views.horario_decidir, name="sup-horario-decidir"),
]
