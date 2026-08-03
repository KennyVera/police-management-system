from django.urls import path

from . import views

urlpatterns = [
    path("estado/", views.estado_personal, name="dir-personal-estado"),
    path("estado/pdf/", views.estado_personal_pdf, name="dir-personal-estado-pdf"),
    path("informe-pdf/", views.estado_personal_pdf, name="dir-personal-informe-pdf"),
    path("evaluaciones/", views.evaluaciones_collection, name="dir-evaluaciones"),
    path("evaluaciones/<int:pk>/", views.evaluacion_detail, name="dir-evaluacion-detail"),
    path("supervisores/", views.list_supervisores, name="dir-supervisores"),
]
