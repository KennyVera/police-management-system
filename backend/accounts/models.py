from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class SystemRole(models.TextChoices):
    ADMIN_SISTEMA = "ADMIN_SISTEMA", "Administrador de Institución"
    VISOR_EJECUTIVO = "VISOR_EJECUTIVO", "Visor Ejecutivo (Alto Mando)"
    DIRECTOR_ZONA = "DIRECTOR_ZONA", "Director / Jefe de Zona"
    SUPERVISOR_UNIDAD = "SUPERVISOR_UNIDAD", "Supervisor de Unidad"
    DETECTIVE = "DETECTIVE", "Detective / Investigador"
    AGENTE_OPERATIVO = "AGENTE_OPERATIVO", "Agente Operativo"


# Roles que el administrador puede asignar a policías
ASSIGNABLE_ROLES = {
    SystemRole.VISOR_EJECUTIVO,
    SystemRole.SUPERVISOR_UNIDAD,
    SystemRole.DETECTIVE,
    SystemRole.AGENTE_OPERATIVO,
}


ROLE_ROUTE_MAP = {
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
    estado = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVO,
    )
    two_factor_enabled = models.BooleanField(default=False)
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
