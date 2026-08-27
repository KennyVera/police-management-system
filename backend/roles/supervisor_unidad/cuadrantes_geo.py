"""Cuadrantes geográficos para asignación de sectores (supervisor)."""

from __future__ import annotations

from roles.supervisor_unidad.scope import supervisor_zone_scope

# Centros aproximados por nombre de zona / ciudad (Ecuador).
ZONE_CENTERS: dict[str, tuple[float, float]] = {
    "zona norte": (-0.1450, -78.4800),
    "zn-norte": (-0.1450, -78.4800),
    "quito": (-0.1807, -78.4678),
    "zona 8": (-2.1700, -79.9200),
    "guayaquil": (-2.1700, -79.9200),
    "zona sur": (-0.2650, -78.5250),
    "circuito centro urbano": (-0.1807, -78.4678),
    "sector 12": (-0.1550, -78.4750),
}

# Calles / referencias demo para reverse-label (sin depender de Nominatim en cada tile).
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


def _center_for_labels(labels: list[str]) -> tuple[float, float]:
    for lab in labels:
        key = (lab or "").strip().lower()
        if key in ZONE_CENTERS:
            return ZONE_CENTERS[key]
        for known, coords in ZONE_CENTERS.items():
            if known in key or key in known:
                return coords
    return ZONE_CENTERS["quito"]


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
    _tree, labels = supervisor_zone_scope(user)
    lat0, lng0 = _center_for_labels(labels)
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
            # GeoJSON: [lng, lat]
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
        "zona": labels[0] if labels else "Zona operativa",
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
