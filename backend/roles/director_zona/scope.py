"""Helpers de alcance territorial para APIs Postgres del Jefe de Zona."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet

from accounts.models import SystemRole
from organizacion.models import Jurisdiction
from tactico.services.geo_scope import ZoneScopeError, resolve_zone_scope


def zone_scope(user):
    return resolve_zone_scope(user)


def jurisdiction_tree_ids(user) -> list[int]:
    scope = resolve_zone_scope(user)
    if scope.jurisdiccion_id:
        ids = [scope.jurisdiccion_id]
        frontier = [scope.jurisdiccion_id]
        while frontier:
            children = list(
                Jurisdiction.objects.filter(parent_id__in=frontier, activo=True).values_list(
                    "id", flat=True
                )
            )
            if not children:
                break
            ids.extend(children)
            frontier = children
        return ids
    return []


def users_in_zone(user) -> QuerySet[User]:
    """Efectivos (perfil) cuya jurisdicción o zona textual cae en el alcance del jefe."""
    scope = resolve_zone_scope(user)
    tree = jurisdiction_tree_ids(user)
    qs = User.objects.filter(profile__isnull=False).select_related("profile", "profile__jurisdiccion")
    if tree:
        return qs.filter(
            Q(profile__jurisdiccion_id__in=tree)
            | Q(profile__zona__in=scope.sectores)
            | Q(profile__jurisdiccion__nombre__in=scope.sectores)
        ).distinct()
    return qs.filter(Q(profile__zona__in=scope.sectores)).distinct()


def supervisores_in_zone(user) -> QuerySet[User]:
    return users_in_zone(user).filter(profile__role=SystemRole.SUPERVISOR_UNIDAD)


__all__ = [
    "ZoneScopeError",
    "zone_scope",
    "jurisdiction_tree_ids",
    "users_in_zone",
    "supervisores_in_zone",
]
