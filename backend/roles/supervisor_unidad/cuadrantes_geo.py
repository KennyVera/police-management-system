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

    return {
        "zona": labels[0] if labels else "Zona operativa",
        "centro": {"lat": lat0, "lng": lng0},
        "zoom": 14,
        "cuadrantes": features,
    }
