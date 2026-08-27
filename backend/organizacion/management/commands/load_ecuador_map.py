"""Carga el mapa territorial de Ecuador: Zona → Subzona (provincia) → Distrito (cantón).

Uso:
  python manage.py load_ecuador_map
  python manage.py load_ecuador_map --geojson /ruta/provincias_ecuador.geojson
"""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from organizacion.models import Jurisdiction, JurisdictionType

DATA_JSON = (
    Path(__file__).resolve().parents[2] / "data" / "provincias.json"
)


def _slug(nombre: str) -> str:
    table = str.maketrans("ÁÉÍÓÚÜÑáéíóúüñ", "AEIOUUNAEIOUUN")
    raw = (nombre or "").translate(table).upper()
    out = []
    for ch in raw:
        if ch.isalnum():
            out.append(ch)
        elif ch in " -_/":
            out.append("-")
    s = "".join(out).strip("-")
    while "--" in s:
        s = s.replace("--", "-")
    return s[:18]


class Command(BaseCommand):
    help = "Puebla ZONA / SUBZONA / DISTRITO desde provincias.json (geografía maestra)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            default=str(DATA_JSON),
            help="Ruta a provincias.json",
        )
        parser.add_argument(
            "--geojson",
            default="",
            help="Opcional: provincias_ecuador.geojson para cruzar códigos DPA.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="No escribe en la base.",
        )

    def handle(self, *args, **options):
        json_path = Path(options["json"])
        if not json_path.is_file():
            raise CommandError(f"No se encontró {json_path}")

        payload = json.loads(json_path.read_text(encoding="utf-8"))
        zonas = payload.get("zonas") or []
        provincias = payload.get("provincias") or []
        if not zonas or not provincias:
            raise CommandError("provincias.json debe incluir 'zonas' y 'provincias'.")

        geo_names = self._geojson_names(options.get("geojson") or "")

        created = updated = 0
        if options["dry_run"]:
            n_cant = sum(len(p.get("cantones") or []) for p in provincias)
            self.stdout.write(
                f"Dry-run: {len(zonas)} zonas, {len(provincias)} subzonas, {n_cant} distritos."
            )
            return

        with transaction.atomic():
            zona_by_code: dict[str, Jurisdiction] = {}
            for z in zonas:
                obj, was_new = self._upsert(
                    codigo=z["codigo"][:40],
                    tipo=JurisdictionType.ZONA,
                    nombre=z["nombre"][:160],
                    parent=None,
                )
                created += int(was_new)
                updated += int(not was_new)
                zona_by_code[z["codigo"]] = obj

            for prov in provincias:
                zona = zona_by_code.get(prov["zona"])
                if zona is None:
                    raise CommandError(
                        f"Provincia {prov.get('nombre')} apunta a zona inexistente {prov.get('zona')}"
                    )
                dpa = str(prov.get("dpa") or "").zfill(2)
                nombre = prov["nombre"]
                if geo_names.get(dpa):
                    nombre = geo_names[dpa].title() if geo_names[dpa].isupper() else geo_names[dpa]
                    if nombre.upper() == geo_names[dpa]:
                        nombre = geo_names[dpa].title()
                codigo_sz = f"SZ-{dpa}"[:40]
                subzona, was_new = self._upsert(
                    codigo=codigo_sz,
                    tipo=JurisdictionType.SUBZONA,
                    nombre=nombre[:160],
                    parent=zona,
                )
                created += int(was_new)
                updated += int(not was_new)

                for cant in prov.get("cantones") or []:
                    cdpa = str(cant.get("dpa") or "")
                    cnombre = cant.get("nombre") or ""
                    codigo_dt = f"DT-{cdpa or _slug(cnombre)}"[:40]
                    _, was_new = self._upsert(
                        codigo=codigo_dt,
                        tipo=JurisdictionType.DISTRITO,
                        nombre=cnombre[:160],
                        parent=subzona,
                    )
                    created += int(was_new)
                    updated += int(not was_new)

        self.stdout.write(
            self.style.SUCCESS(
                f"Mapa Ecuador cargado. Creados={created} actualizados={updated}."
            )
        )

    def _upsert(self, *, codigo: str, tipo: str, nombre: str, parent):
        obj = Jurisdiction.objects.filter(codigo=codigo).first()
        if obj is None:
            obj = Jurisdiction.objects.create(
                codigo=codigo,
                tipo=tipo,
                nombre=nombre,
                parent=parent,
                activo=True,
            )
            return obj, True
        fields = []
        if obj.tipo != tipo:
            obj.tipo = tipo
            fields.append("tipo")
        if obj.nombre != nombre:
            obj.nombre = nombre
            fields.append("nombre")
        if obj.parent_id != (parent.id if parent else None):
            obj.parent = parent
            fields.append("parent")
        if not obj.activo:
            obj.activo = True
            fields.append("activo")
        if fields:
            obj.save(update_fields=fields + ["actualizado_en"])
        return obj, False

    def _geojson_names(self, path_str: str) -> dict[str, str]:
        candidates = []
        if path_str:
            candidates.append(Path(path_str))
        base = Path(settings.BASE_DIR)
        candidates.extend(
            [
                base.parent / "frontend" / "public" / "geo" / "provincias_ecuador.geojson",
                base / ".." / "frontend" / "public" / "geo" / "provincias_ecuador.geojson",
            ]
        )
        for path in candidates:
            path = path.resolve()
            if not path.is_file():
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            names = {}
            for feat in data.get("features") or []:
                props = feat.get("properties") or {}
                dpa = str(props.get("dpa_provin") or "").zfill(2)
                nom = props.get("dpa_despro") or props.get("nombre") or ""
                if dpa and nom and dpa != "90":
                    names[dpa] = nom
            self.stdout.write(f"GeoJSON cruzado: {path.name} ({len(names)} provincias).")
            return names
        return {}
