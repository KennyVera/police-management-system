from django.urls import path

from . import views

urlpatterns = [
    path("", views.billing_dashboard),
    path("dashboard/", views.billing_dashboard),
    path("cancelar/", views.cancelar_suscripcion),
    path("facturas/<int:pk>/pdf/", views.factura_pdf),
]
