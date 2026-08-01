from django.urls import path

from . import views

urlpatterns = [
    path("jurisdicciones/", views.jurisdicciones_collection),
    path("jurisdicciones/<int:pk>/", views.jurisdiccion_detail),
    path("jurisdicciones/<int:pk>/inactivar/", views.jurisdiccion_inactivar),
    path("departamentos/", views.departamentos_collection),
    path("departamentos/<int:pk>/", views.departamento_detail),
    path("departamentos/<int:pk>/inactivar/", views.departamento_inactivar),
    path("plazas/", views.plazas),
    path("catalogos/", views.catalogos),
]
