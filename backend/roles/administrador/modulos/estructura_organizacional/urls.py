from django.urls import path

from . import views

urlpatterns = [
    path("jurisdicciones/", views.jurisdicciones_collection),
    path("jurisdicciones/<int:pk>/", views.jurisdiccion_detail),
    path("jurisdicciones/<int:pk>/personal/", views.jurisdiccion_personal),
    path("jurisdicciones/<int:pk>/personal/pdf/", views.jurisdiccion_personal_pdf),
    path(
        "jurisdicciones/<int:pk>/restablecer-asignaciones/",
        views.jurisdiccion_restablecer_asignaciones,
    ),
    path("jurisdicciones/<int:pk>/inactivar/", views.jurisdiccion_inactivar),
    path("plazas/", views.plazas),
    # GET catalogos/?jurisdiccion_id=5 — eco para preselección en el dual-listbox
    path("catalogos/", views.catalogos),
]
