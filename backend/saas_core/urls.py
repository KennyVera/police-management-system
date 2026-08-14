from django.urls import include, path

from . import views
from . import views_usuarios as vu
from .configuracion.views import public_branding as pb
from .configuracion.views import uploads as branding_uploads

urlpatterns = [
    path("planes/", views.list_planes, name="saas-planes"),
    path("registrar/", views.registrar_institucion, name="saas-registrar"),
    path("estadisticas/", views.estadisticas_saas, name="saas-estadisticas"),
    path("tenants/<int:pk>/", views.tenant_detalle, name="saas-tenant-detalle"),
    path("public/branding/", pb.public_branding, name="saas-public-branding"),
    path(
        "branding/<path:object_key>",
        branding_uploads.branding_proxy,
        name="saas-branding",
    ),
    path("admin/planes/", views.admin_planes, name="saas-admin-planes"),
    path("admin/planes/<int:pk>/", views.admin_plan_detalle, name="saas-admin-plan-detalle"),
    path(
        "admin/planes/<int:pk>/duplicar/",
        views.admin_plan_duplicar,
        name="saas-admin-plan-duplicar",
    ),
    path(
        "admin/planes/<int:pk>/activar/",
        views.admin_plan_toggle_activo,
        name="saas-admin-plan-activar",
    ),
    path(
        "admin/planes/<int:pk>/archivar/",
        views.admin_plan_archivar,
        name="saas-admin-plan-archivar",
    ),
    path(
        "admin/planes/<int:pk>/instituciones/",
        views.admin_plan_instituciones,
        name="saas-admin-plan-instituciones",
    ),
    path(
        "admin/suscripciones/",
        views.admin_suscripciones,
        name="saas-admin-suscripciones",
    ),
    path(
        "admin/suscripciones/asignar/",
        views.admin_suscripcion_asignar,
        name="saas-admin-suscripcion-asignar",
    ),
    path(
        "admin/suscripciones/cambiar/",
        views.admin_suscripcion_cambiar,
        name="saas-admin-suscripcion-cambiar",
    ),
    path(
        "admin/suscripciones/renovar/",
        views.admin_suscripcion_renovar,
        name="saas-admin-suscripcion-renovar",
    ),
    path(
        "admin/suscripciones/suspender/",
        views.admin_suscripcion_suspender,
        name="saas-admin-suscripcion-suspender",
    ),
    path(
        "admin/suscripciones/cancelar/",
        views.admin_suscripcion_cancelar,
        name="saas-admin-suscripcion-cancelar",
    ),
    path(
        "admin/suscripciones/<int:institucion_id>/historial/",
        views.admin_suscripcion_historial,
        name="saas-admin-suscripcion-historial",
    ),
    path("admin/admins/", vu.admin_institucionales_list, name="saas-admin-admins"),
    path(
        "admin/admins/<int:user_id>/",
        vu.admin_institucional_detalle,
        name="saas-admin-admin-detalle",
    ),
    path(
        "admin/admins/<int:user_id>/estado/",
        vu.admin_institucional_estado,
        name="saas-admin-admin-estado",
    ),
    path(
        "admin/admins/<int:user_id>/restablecer/",
        vu.admin_institucional_restablecer,
        name="saas-admin-admin-restablecer",
    ),
    path(
        "admin/admins/<int:user_id>/revocar/",
        vu.admin_institucional_revocar,
        name="saas-admin-admin-revocar",
    ),
    path(
        "admin/admins/<int:user_id>/permisos/",
        vu.admin_institucional_permisos,
        name="saas-admin-admin-permisos",
    ),
    path(
        "admin/admins/<int:user_id>/actividad/",
        vu.admin_institucional_actividad,
        name="saas-admin-admin-actividad",
    ),
    path("admin/acceso/sesiones/", vu.acceso_sesiones, name="saas-admin-acceso-sesiones"),
    path(
        "admin/acceso/sesiones/<int:session_id>/cerrar/",
        vu.acceso_cerrar_sesion,
        name="saas-admin-acceso-cerrar-sesion",
    ),
    path(
        "admin/acceso/sesiones/cerrar-usuario/",
        vu.acceso_cerrar_sesiones_usuario,
        name="saas-admin-acceso-cerrar-usuario",
    ),
    path(
        "admin/acceso/historial/",
        vu.acceso_historial,
        name="saas-admin-acceso-historial",
    ),
    path("admin/facturacion/", include("saas_core.facturacion.urls")),
    path("admin/configuracion/", include("saas_core.configuracion.urls")),
]
