"""Aislamiento territorial (data scoping) del Supervisor de Unidad."""

from __future__ import annotations

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet

from accounts.models import AccountStatus, SystemRole
from operativo.models import ParteAprehension
from organizacion.models import Jurisdiction
from tactico.services.geo_scope import (
    ZoneScopeError,
    _collect_descendant_ids,
    resolve_zone_scope,
)


def supervisor_zone_scope(user) -> tuple[list[int], list[str]]:
    """Árbol de jurisdicción + etiquetas de zona del supervisor logueado."""
    try:
        scope = resolve_zone_scope(user)
    except ZoneScopeError:
        return [], []
    tree: list[int] = []
    if scope.jurisdiccion_id:
        jur = Jurisdiction.objects.filter(pk=scope.jurisdiccion_id).first()
        if jur:
            tree = _collect_descendant_ids(jur)
    return tree, list(scope.sectores)


def agentes_en_zona_qs(user) -> QuerySet[User]:
    """Agentes operativos activos de la misma zona del supervisor."""
    qs = (
        User.objects.filter(
            profile__role=SystemRole.AGENTE_OPERATIVO,
            profile__estado=AccountStatus.ACTIVO,
            is_active=True,
        )
        .select_related("profile", "profile__jurisdiccion")
        .order_by("first_name", "last_name")
    )
    tree, labels = supervisor_zone_scope(user)
    if not tree and not labels:
        return qs.none()
    if tree:
        return qs.filter(
            Q(profile__jurisdiccion_id__in=tree)
            | Q(profile__zona__in=labels)
            | Q(profile__jurisdiccion__nombre__in=labels)
        ).distinct()
    return qs.filter(
        Q(profile__zona__in=labels) | Q(profile__jurisdiccion__nombre__in=labels)
    ).distinct()


def agente_ids_en_zona(user) -> set[int]:
    return set(agentes_en_zona_qs(user).values_list("id", flat=True))


def partes_en_zona_qs(user) -> QuerySet[ParteAprehension]:
    """Partes redactados solo por agentes de la zona del supervisor."""
    ids = agente_ids_en_zona(user)
    if not ids:
        return ParteAprehension.objects.none()
    return ParteAprehension.objects.filter(creado_por_id__in=ids)


def parte_en_zona_or_404(user, pk: int) -> ParteAprehension | None:
    """Devuelve el parte si existe y pertenece a la zona; None si no."""
    return (
        partes_en_zona_qs(user)
        .select_related("tipo_delito", "creado_por", "alerta", "revisado_por")
        .prefetch_related("multimedia")
        .filter(pk=pk)
        .first()
    )


__all__ = [
    "supervisor_zone_scope",
    "agentes_en_zona_qs",
    "agente_ids_en_zona",
    "partes_en_zona_qs",
    "parte_en_zona_or_404",
]
