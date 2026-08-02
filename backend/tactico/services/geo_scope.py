"""Aislamiento geográfico del Jefe de Zona frente a ClickHouse."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth.models import User
from organizacion.models import Jurisdiction


class ZoneScopeError(PermissionError):
    """El usuario no tiene jurisdicción asignada o el alcance es inválido."""


@dataclass(frozen=True)
class ZoneScope:
    """Ámbito territorial del jefe de zona para filtrar hechos en ClickHouse."""

    jurisdiccion_id: int | None
    jurisdiccion_nombre: str
    jurisdiccion_codigo: str
    # Valores de sector_zona permitidos (nombre/código del árbol jurisdiccional).
    sectores: tuple[str, ...]

    @property
    def geo_sql(self) -> str:
        """
        Fragmento SQL de aislamiento.

        El fact actual no tiene ``jurisdiccion_id``; se filtra por ``sector_zona``
        mapeado al árbol de ``organizacion.Jurisdiction`` del usuario.
        Cuando exista la columna en ETL, se podrá preferir:
        ``AND jurisdiccion_id = {jurisdiccion_id:UInt64}``.
        """
        return "AND sector_zona IN {sectores:Array(String)}"

    @property
    def geo_params(self) -> dict:
        return {"sectores": list(self.sectores)}


def _collect_descendant_ids(root: Jurisdiction) -> list[int]:
    ids = [root.id]
    frontier = [root.id]
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


def resolve_zone_scope(user: User) -> ZoneScope:
    """
    Resuelve el filtro dinámico obligatorio para el Jefe de Zona.

    Prioridad:
    1. ``user.profile.jurisdiccion`` (+ descendientes) → nombres/códigos.
    2. Fallback: ``user.profile.zona`` (texto libre del seed demo).
    """
    profile = getattr(user, "profile", None)
    if profile is None:
        raise ZoneScopeError("Usuario sin perfil; no se puede aislar la zona.")

    jur = getattr(profile, "jurisdiccion", None)
    if jur is not None:
        tree_ids = _collect_descendant_ids(jur)
        rows = Jurisdiction.objects.filter(id__in=tree_ids, activo=True).values_list(
            "nombre", "codigo"
        )
        labels: list[str] = []
        seen: set[str] = set()
        for nombre, codigo in rows:
            for raw in (nombre, codigo):
                val = (raw or "").strip()
                if val and val not in seen:
                    seen.add(val)
                    labels.append(val)
        if not labels:
            raise ZoneScopeError("La jurisdicción asignada no tiene sectores activos.")
        return ZoneScope(
            jurisdiccion_id=jur.id,
            jurisdiccion_nombre=jur.nombre,
            jurisdiccion_codigo=jur.codigo,
            sectores=tuple(labels),
        )

    zona = (getattr(profile, "zona", None) or "").strip()
    if zona:
        return ZoneScope(
            jurisdiccion_id=None,
            jurisdiccion_nombre=zona,
            jurisdiccion_codigo="",
            sectores=(zona,),
        )

    raise ZoneScopeError(
        "El Jefe de Zona no tiene jurisdicción asignada. "
        "Configure profile.jurisdiccion (o zona) antes de consultar inteligencia táctica."
    )
