from django.urls import path

from . import views

urlpatterns = [
    path("casos-criticos/", views.casos_criticos, name="dir-casos-criticos"),
    path("casos-criticos/<int:pk>/", views.caso_critico_detail, name="dir-caso-critico-detail"),
    path("partes/<int:pk>/pdf/", views.parte_pdf, name="dir-parte-pdf"),
]
