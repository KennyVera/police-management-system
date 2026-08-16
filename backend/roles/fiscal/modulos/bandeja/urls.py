from django.urls import path

from . import views

urlpatterns = [
    path("meta/", views.meta, name="fiscal-bandeja-meta"),
    path("", views.casos_collection, name="fiscal-bandeja"),
    path("<int:pk>/", views.caso_detail, name="fiscal-caso-detail"),
    path("<int:pk>/pdf/", views.caso_pdf, name="fiscal-caso-pdf"),
    path("<int:pk>/despacho-admin/", views.despacho_admin, name="fiscal-despacho-admin"),
    path(
        "<int:pk>/abrir-investigacion/",
        views.abrir_investigacion,
        name="fiscal-abrir-investigacion",
    ),
]
