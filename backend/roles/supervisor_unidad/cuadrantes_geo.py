"""Cuadrantes geográficos para asignación de sectores (supervisor)."""

from __future__ import annotations

import re

from organizacion.models import Jurisdiction, JurisdictionType
from roles.supervisor_unidad.scope import supervisor_zone_scope
from tactico.services.geo_scope import _collect_descendant_ids

# Centros aproximados: zonas policiales ZN-01..09 y provincias (Ecuador).
ZONE_CODE_CENTERS: dict[str, tuple[float, float]] = {
    "ZN-01": (0.8500, -78.6500),  # Esmeraldas / norte
    "ZN-02": (-0.5000, -76.9800),  # Napo / Orellana
    "ZN-03": (-1.2500, -78.6200),  # Cotopaxi / Tungurahua / Chimborazo
    "ZN-04": (-0.9500, -80.4500),  # Manabí / Sto. Domingo
    "ZN-05": (-1.8000, -79.5500),  # Los Ríos / Santa Elena
    "ZN-06": (-2.9000, -79.0000),  # Azuay / Cañar
    "ZN-07": (-3.8500, -79.5500),  # El Oro / Loja
    "ZN-08": (-2.1700, -79.9200),  # Guayaquil
    "ZN-09": (-0.1807, -78.4678),  # Quito
}

PROVINCE_CENTERS: dict[str, tuple[float, float]] = {
    "azuay": (-2.9000, -79.0045),
    "bolivar": (-1.5900, -79.0000),
    "carchi": (0.8070, -77.7180),
    "canar": (-2.5500, -78.9400),
    "cañar": (-2.5500, -78.9400),
    "chimborazo": (-1.6700, -78.6500),
    "cotopaxi": (-0.9300, -78.6200),
    "el oro": (-3.2600, -79.9600),
    "esmeraldas": (0.9590, -79.6540),
    "galapagos": (-0.7400, -90.3100),
    "galápagos": (-0.7400, -90.3100),
    "guayas": (-2.1700, -79.9200),
    "imbabura": (0.3500, -78.1200),
    "loja": (-4.0000, -79.2000),
    "los rios": (-1.8000, -79.5300),
    "los ríos": (-1.8000, -79.5300),
    "manabi": (-0.9500, -80.7000),
    "manabí": (-0.9500, -80.7000),
    "morona santiago": (-2.3100, -78.1200),
    "napo": (-0.9900, -77.8100),
    "orellana": (-0.4600, -76.9800),
    "pastaza": (-1.4900, -78.0000),
    "pichincha": (-0.1807, -78.4678),
    "quito": (-0.1807, -78.4678),
    "santa elena": (-2.2300, -80.8600),
    "santo domingo": (-0.2500, -79.1700),
    "santo domingo de los tsachilas": (-0.2500, -79.1700),
    "sucumbios": (0.0900, -76.8800),
    "sucumbíos": (0.0900, -76.8800),
    "tungurahua": (-1.2400, -78.6200),
    "zamora chinchipe": (-4.0700, -78.9500),
    "guayaquil": (-2.1700, -79.9200),
}

# Fallback legacy labels
ZONE_CENTERS: dict[str, tuple[float, float]] = {
    "zona norte": ZONE_CODE_CENTERS["ZN-01"],
    "zona 1": ZONE_CODE_CENTERS["ZN-01"],
    "zona 2": ZONE_CODE_CENTERS["ZN-02"],
    "zona 3": ZONE_CODE_CENTERS["ZN-03"],
    "zona 4": ZONE_CODE_CENTERS["ZN-04"],
    "zona 5": ZONE_CODE_CENTERS["ZN-05"],
    "zona 6": ZONE_CODE_CENTERS["ZN-06"],
    "zona 7": ZONE_CODE_CENTERS["ZN-07"],
    "zona 8": ZONE_CODE_CENTERS["ZN-08"],
    "zona 9": ZONE_CODE_CENTERS["ZN-09"],
    "guayaquil": ZONE_CODE_CENTERS["ZN-08"],
    "quito": ZONE_CODE_CENTERS["ZN-09"],
}

STREET_HINTS = [
    "Av. 10 de Agosto",
    "Av. Amazonas",
    "Av. República",
    "Calle Colón",
    "Calle Patria",
    "Av. Shyris",
    "Av. 6 de Diciembre",
    "Calle Juan León Mera",
    "Av. Eloy Alfaro",
    "Calle Portugal",
    "Av. Naciones Unidas",
    "Calle Rumipamba",
]


def _norm(text: str) -> str:
    return (
        str(text or "")
        .strip()
        .lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )


def _zona_raiz(jur: Jurisdiction | None) -> Jurisdiction | None:
    current = jur
    seen = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        if current.tipo == JurisdictionType.ZONA:
            return current
        parent_id = current.parent_id
        if not parent_id:
            break
        current = current.parent or Jurisdiction.objects.filter(pk=parent_id).first()
    return jur


def _center_from_text(text: str) -> tuple[float, float] | None:
    key = _norm(text)
    if not key:
        return None
    m = re.search(r"zn[\s\-]?0?(\d)", key)
    if m:
        code = f"ZN-0{m.group(1)}"
        if code in ZONE_CODE_CENTERS:
            return ZONE_CODE_CENTERS[code]
    for code, coords in ZONE_CODE_CENTERS.items():
        if _norm(code) in key or key in _norm(code):
            return coords
    for known, coords in PROVINCE_CENTERS.items():
        if _norm(known) in key or key in _norm(known):
            return coords
    for known, coords in ZONE_CENTERS.items():
        if known in key or key in known:
            return coords
    return None


def _center_for_supervisor(user) -> tuple[float, float, str]:
    """Centro (lat,lng) + etiqueta de zona del supervisor."""
    profile = getattr(user, "profile", None)
    jur = getattr(profile, "jurisdiccion", None) if profile else None
    if jur is not None:
        raiz = _zona_raiz(jur)
        # 1) Código de zona
        for candidate in (jur, raiz):
            if candidate and candidate.codigo:
                hit = _center_from_text(candidate.codigo)
                if hit:
                    return (*hit, (raiz or jur).nombre)
        # 2) Nombre jurisdicción / zona / provincias del árbol
        labels = [(raiz or jur).nombre, jur.nombre]
        if raiz:
            tree = _collect_descendant_ids(raiz)
            labels.extend(
                Jurisdiction.objects.filter(id__in=tree).values_list("nombre", flat=True)
            )
        for lab in labels:
            hit = _center_from_text(lab)
            if hit:
                return (*hit, (raiz or jur).nombre)

    _tree, labels = supervisor_zone_scope(user)
    for lab in labels:
        hit = _center_from_text(lab)
        if hit:
            return (*hit, labels[0] if labels else "Zona operativa")

    return (*ZONE_CODE_CENTERS["ZN-09"], labels[0] if labels else "Zona operativa")


def _point_in_ring(lat: float, lng: float, ring: list[list[float]]) -> bool:
    """Ray casting: ring en GeoJSON [lng, lat]."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersect = (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (
            (yj - yi) or 1e-12
        ) + xi
        if intersect:
            inside = not inside
        j = i
    return inside


def build_cuadrantes_for_supervisor(user, cols: int = 3, rows: int = 3) -> dict:
    """
    Genera una grilla de polígonos (GeoJSON) centrada en la zona del supervisor.
    Cada celda es un 'cuadrante' seleccionable en el mapa.
    """
    lat0, lng0, zona_label = _center_for_supervisor(user)
    # ~800–900 m por celda
    d_lat = 0.0075
    d_lng = 0.0085
    origin_lat = lat0 - (rows * d_lat) / 2
    origin_lng = lng0 - (cols * d_lng) / 2

    features = []
    n = 0
    for r in range(rows):
        for c in range(cols):
            n += 1
            south = origin_lat + r * d_lat
            north = south + d_lat
            west = origin_lng + c * d_lng
            east = west + d_lng
            ring = [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
            code = f"C-{n:02d}"
            nombre = f"Cuadrante {code}"
            hint_a = STREET_HINTS[(n - 1) % len(STREET_HINTS)]
            hint_b = STREET_HINTS[n % len(STREET_HINTS)]
            detalle = f"{hint_a} entre {hint_b.split()[-1]} y zona operativa {code}"
            center_lat = (south + north) / 2
            center_lng = (west + east) / 2
            features.append(
                {
                    "id": code,
                    "nombre": nombre,
                    "detalle_ruta": detalle,
                    "centro": {"lat": round(center_lat, 6), "lng": round(center_lng, 6)},
                    "poligono": {
                        "type": "Polygon",
                        "coordinates": [ring],
                    },
                }
            )

    south_all = origin_lat
    north_all = origin_lat + rows * d_lat
    west_all = origin_lng
    east_all = origin_lng + cols * d_lng

    return {
        "zona": zona_label or "Zona operativa",
        "centro": {"lat": lat0, "lng": lng0},
        "zoom": 14,
        "cuadrantes": features,
        "bounds": {
            "south": round(south_all, 6),
            "north": round(north_all, 6),
            "west": round(west_all, 6),
            "east": round(east_all, 6),
        },
    }


def point_in_supervisor_zone(user, lat: float, lng: float) -> bool:
    """True si las coordenadas caen dentro de algún cuadrante de la zona del supervisor."""
    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return False
    data = build_cuadrantes_for_supervisor(user)
    for cuad in data.get("cuadrantes") or []:
        ring = (cuad.get("poligono") or {}).get("coordinates", [[]])[0]
        if ring and _point_in_ring(lat_f, lng_f, ring):
            return True
    return False
