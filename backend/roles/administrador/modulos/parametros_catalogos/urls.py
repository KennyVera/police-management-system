from django.urls import path

from . import views

urlpatterns = [
    path("tipos-delito/", views.tipos_delito_collection),
    path("tipos-delito/<int:pk>/", views.tipo_delito_detail),
    path("tipos-delito/<int:pk>/inactivar/", views.tipo_delito_inactivar),
    path("catalogos-operativos/", views.catalogos_collection),
    path("catalogos-operativos/<int:pk>/", views.catalogo_detail),
    path("catalogos-operativos/<int:pk>/inactivar/", views.catalogo_inactivar),
    path("variables-globales/", views.variables_collection),
    path("variables-globales/<int:pk>/", views.variable_detail),
    path("meta/", views.meta_catalogos),
]
