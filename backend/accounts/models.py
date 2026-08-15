from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class SystemRole(models.TextChoices):
    SUPERADMIN_SAAS = "SUPERADMIN_SAAS", "SuperAdmin SaaS (Plataforma)"
    ADMIN_SISTEMA = "ADMIN_SISTEMA", "Administrador de Institución"
    VISOR_EJECUTIVO = "VISOR_EJECUTIVO", "Visor Ejecutivo (Alto Mando)"
    DIRECTOR_ZONA = "DIRECTOR_ZONA", "Director / Jefe de Zona"
    SUPERVISOR_UNIDAD = "SUPERVISOR_UNIDAD", "Supervisor de Unidad"
    DETECTIVE = "DETECTIVE", "Detective / Investigador"
    AGENTE_OPERATIVO = "AGENTE_OPERATIVO", "Agente Operativo"


# Roles que el administrador puede asignar a policías (orden de UI)
ASSIGNABLE_ROLES = (
    SystemRole.VISOR_EJECUTIVO,
    SystemRole.DIRECTOR_ZONA,
    SystemRole.SUPERVISOR_UNIDAD,
    SystemRole.DETECTIVE,
    SystemRole.AGENTE_OPERATIVO,
)


ROLE_ROUTE_MAP = {
    SystemRole.SUPERADMIN_SAAS: "superadmin",
    SystemRole.ADMIN_SISTEMA: "administrador",
    SystemRole.VISOR_EJECUTIVO: "visor_ejecutivo",
    SystemRole.DIRECTOR_ZONA: "director_zona",
    SystemRole.SUPERVISOR_UNIDAD: "supervisor_unidad",
    SystemRole.DETECTIVE: "detective",
    SystemRole.AGENTE_OPERATIVO: "agente_operativo",
}


class AccountStatus(models.TextChoices):
    ACTIVO = "ACTIVO", "Activo"
    SUSPENDIDO = "SUSPENDIDO", "Suspendido"
    BAJA = "BAJA", "Dado de baja"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, choices=SystemRole.choices)
    cedula = models.CharField(max_length=20, unique=True, null=True, blank=True)
    placa = models.CharField(max_length=40, blank=True)
    rango_policial = models.CharField(max_length=80, blank=True)
    rango_tipico = models.CharField(max_length=120, blank=True)
    unidad = models.CharField(max_length=120, blank=True)
    zona = models.CharField(max_length=120, blank=True)
    telefono = models.CharField(max_length=32, blank=True)
    avatar_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="URL/proxy de foto de perfil (MinIO).",
    )
    estado = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVO,
    )
    two_factor_enabled = models.BooleanField(default=False)
    permisos_plataforma = models.JSONField(
        default=list,
        blank=True,
        help_text="Permisos de plataforma para Admin institucional (códigos)",
    )
    departamento = models.ForeignKey(
        "organizacion.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="miembros",
    )
    jurisdiccion = models.ForeignKey(
        "organizacion.Jurisdiction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="efectivos",
    )
    # Multi-tenant: nullable solo para SuperAdmin SaaS global
    institucion = models.ForeignKey(
        "saas_core.Institucion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="usuarios",
        help_text="Institución (tenant). Obligatorio salvo SuperAdmin SaaS.",
    )

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuario"

    def __str__(self) -> str:
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def role_slug(self) -> str:
        return ROLE_ROUTE_MAP.get(self.role, "agente_operativo")

    def sync_user_active(self):
        """Nunca borramos: solo inactivamos según estado."""
        self.user.is_active = self.estado == AccountStatus.ACTIVO
        self.user.save(update_fields=["is_active"])


# Catálogo de permisos editables por SuperAdmin para Admins institucionales
PLATFORM_PERMISSION_CATALOG = [
    {"code": "gestionar_usuarios", "label": "Gestionar usuarios de la institución"},
    {"code": "gestionar_estructura", "label": "Gestionar estructura organizacional"},
    {"code": "gestionar_catalogos", "label": "Gestionar parámetros y catálogos"},
    {"code": "ver_auditoria", "label": "Ver auditoría institucional"},
    {"code": "exportar_datos", "label": "Exportar datos / reportes"},
    {"code": "gestionar_facturacion", "label": "Ver plan y facturación"},
]

DEFAULT_ADMIN_PERMISOS = [p["code"] for p in PLATFORM_PERMISSION_CATALOG]


class AccesoEvento(models.Model):
    """Bitácora de accesos y acciones de plataforma (SuperAdmin / admins)."""

    class Accion(models.TextChoices):
        LOGIN = "LOGIN", "Inicio de sesión"
        LOGOUT = "LOGOUT", "Cierre de sesión"
        EDITAR = "EDITAR", "Editar información"
        ACTIVAR = "ACTIVAR", "Activar acceso"
        DESACTIVAR = "DESACTIVAR", "Desactivar acceso"
        RESTABLECER = "RESTABLECER", "Restablecer acceso"
        REVOCAR = "REVOCAR", "Revocar acceso"
        PERMISOS = "PERMISOS", "Cambiar permisos"
        CERRAR_SESION = "CERRAR_SESION", "Cerrar sesión"

    usuario = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="eventos_acceso"
    )
    actor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acciones_acceso_realizadas",
    )
    accion = models.CharField(max_length=20, choices=Accion.choices)
    detalle = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evento de acceso"
        verbose_name_plural = "Eventos de acceso"

    def __str__(self) -> str:
        return f"{self.accion} · {self.usuario_id}"


class UserSession(models.Model):
    """Sesiones/token activos para monitoreo y cierre forzado."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sgp_sessions")
    token_key = models.CharField(max_length=64, unique=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-last_seen"]
        verbose_name = "Sesión de usuario"
        verbose_name_plural = "Sesiones de usuario"

    def __str__(self) -> str:
        return f"{self.user.username} @ {self.last_seen}"
