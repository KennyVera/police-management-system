from django.urls import path

from . import views

urlpatterns = [
    path("pendientes/", views.partes_pendientes, name="sup-partes-pendientes"),
    path("historial/", views.partes_historial, name="sup-partes-historial"),
    path("<int:pk>/", views.parte_detalle, name="sup-parte-detalle"),
    path("<int:pk>/rechazar/", views.rechazar_parte, name="sup-parte-rechazar"),
    path("<int:pk>/aprobar/", views.aprobar_parte, name="sup-parte-aprobar"),
]
