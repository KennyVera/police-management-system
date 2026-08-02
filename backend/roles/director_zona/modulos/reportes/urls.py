from django.urls import path

from . import views

urlpatterns = [
    path("preview/", views.reporte_preview, name="dir-reporte-preview"),
    path("exportar/", views.reporte_exportar, name="dir-reporte-exportar"),
]
