from rest_framework.permissions import BasePermission


class IsSuperAdminGlobal(BasePermission):
    """Dueño del SaaS (superusuario Django o rol SUPERADMIN_SAAS)."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        if not profile:
            return False
        return profile.role == "SUPERADMIN_SAAS"
