from rest_framework.permissions import BasePermission

from accounts.models import SystemRole


class HasSystemRole(BasePermission):
    """Permite acceso solo si el perfil del usuario coincide con allowed_roles."""

    allowed_roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        profile = getattr(user, "profile", None)
        if profile is None:
            return False
        allowed = getattr(view, "allowed_roles", self.allowed_roles)
        return profile.role in allowed


def role_permission(*roles: str):
    class _RolePermission(HasSystemRole):
        allowed_roles = roles

    return _RolePermission


AdminOnly = role_permission(SystemRole.ADMIN_SISTEMA)
EjecutivoOnly = role_permission(SystemRole.VISOR_EJECUTIVO)
DirectorOnly = role_permission(SystemRole.DIRECTOR_ZONA)
SupervisorOnly = role_permission(SystemRole.SUPERVISOR_UNIDAD)
DetectiveOnly = role_permission(SystemRole.DETECTIVE)
AgenteOnly = role_permission(SystemRole.AGENTE_OPERATIVO)


class EsJefeDeZona(DirectorOnly):
    """Alias de dominio: Jefe de Zona (Inteligencia Táctica)."""

    message = "Solo el Jefe de Zona puede acceder a este recurso."
