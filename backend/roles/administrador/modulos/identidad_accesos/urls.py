from django.urls import path

from . import views

urlpatterns = [
    path("usuarios/", views.usuarios_collection, name="admin-usuarios"),
    path("usuarios/<int:user_id>/", views.usuario_detail, name="admin-usuario-detail"),
    path("usuarios/<int:user_id>/estado/", views.usuario_estado, name="admin-usuario-estado"),
    path(
        "usuarios/<int:user_id>/reset-password/",
        views.reset_password,
        name="admin-usuario-reset-password",
    ),
    path("usuarios/<int:user_id>/2fa/", views.toggle_2fa, name="admin-usuario-2fa"),
    path("sesiones/", views.sesiones_activas, name="admin-sesiones"),
    path(
        "sesiones/<int:session_id>/cerrar/",
        views.forzar_cierre_sesion,
        name="admin-sesion-cerrar",
    ),
    path("roles-asignables/", views.roles_asignables, name="admin-roles-asignables"),
]
