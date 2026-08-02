from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="det-evidencias-meta"),
    path("", views.evidencias_collection, name="det-evidencias"),
    path("digital/", views.evidencia_digital, name="det-evidencia-digital"),
    path("fisica/", views.evidencia_fisica, name="det-evidencia-fisica"),
    path("<int:pk>/", views.evidencia_detail, name="det-evidencia-detail"),
    path("<int:pk>/archivo/", views.evidencia_archivo, name="det-evidencia-archivo"),
    path("<int:pk>/custodia/", views.movimiento_custodia, name="det-evidencia-custodia"),
]
