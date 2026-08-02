"""
Siembra operativa realista para dashboards + ETL → ClickHouse.

Uso:
  python manage.py seed_db
  python manage.py seed_db --partes 200 --seed 42
  python manage.py seed_db --skip-parquet
"""

from __future__ import annotations

import random
import re
import unicodedata
from datetime import timedelta
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import AccountStatus, SystemRole, UserProfile
from catalogos.models import TipoDelito
from operativo.minio_service import upload_evidencia
from operativo.models import MultimediaEvidencia, ParteAprehension
from operativo.parquet_service import build_parquet_bytes
from organizacion.models import Jurisdiction, JurisdictionType
from django.conf import settings

try:
    from faker import Faker
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "Falta la librería 'Faker'. Instálala en el contenedor/backend "
        "(pip install Faker) y vuelve a ejecutar seed_db."
    ) from exc


ROLE_SPECS = [
    {
        "role": SystemRole.AGENTE_OPERATIVO,
        "prefix": "Agente",
        "rango": "Sargento / Cabo",
        "unidad": "Servicio Urbano",
        "count": 3,
    },
    {
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "prefix": "Supervisor",
        "rango": "Capitán / Teniente",
        "unidad": "Unidad Operativa",
        "count": 3,
    },
    {
        "role": SystemRole.DETECTIVE,
        "prefix": "Detective",
        "rango": "Policía Judicial",
        "unidad": "Investigaciones",
        "count": 3,
    },
    {
        "role": SystemRole.DIRECTOR_ZONA,
        "prefix": "JefeZona",
        "rango": "Coronel / Mayor",
        "unidad": "Jefatura de Zona",
        "count": 3,
    },
    {
        "role": SystemRole.VISOR_EJECUTIVO,
        "prefix": "VisorEjecutivo",
        "rango": "Alto Mando",
        "unidad": "Comandancia General",
        "count": 3,
    },
]

# Coordenadas base (Ecuador) + jitter por distrito
GEO_BASE = {
    "Z8": {"lat": -2.1700, "lon": -79.9220, "ciudad": "Guayaquil"},
    "Z9": {"lat": -0.1807, "lon": -78.4678, "ciudad": "Quito"},
}

# Orden importa: reglas más específicas primero
EVIDENCE_RULES = [
    (
        "ACCIDENTE",
        (
            "choque",
            "colision",
            "accidente",
            "vehiculo_accidentado",
            "vidrios_calzada",
        ),
    ),
    (
        "NARCO",
        (
            "drogas",
            "incautacion",
            "balanza",
            "dinero_incautado",
            "jeringas",
        ),
    ),
    (
        "ROBO",
        (
            "arresto",
            "detenido_esposado",
            "operativo_residencial",
            "huella_calzado",
        ),
    ),
    (
        "HOMICIDIO",
        (
            "cuerpo",
            "cuchillo",
            "sangre",
            "casquillo",
            "bala",
            "revolver",
        ),
    ),
    (
        "INVESTIGACION",
        (
            "huellas",
            "dactilares",
            "tablero",
            "laboratorio",
            "microscopio",
            "carpeta",
            "maletin",
            "documentacion",
            "peritos",
            "simulacro",
        ),
    ),
]

CATEGORY_META = {
    "ACCIDENTE": {
        "delito_codigos": ["ACCIDENTE_TRANSITO"],
        "delito_fallback_nombre": "Accidente de tránsito",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.ALTA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.SI,
        "hay_armas": ParteAprehension.SiNo.NO,
        "titulo": "Accidente de tránsito — {sector}",
        "desc": (
            "Colisión vehicular reportada en {lugar}. Se documenta la escena con "
            "evidencia fotográfica ({archivo}). Heridos: sí. Unidades de tránsito "
            "y auxilio presentes. Sector: {sector}."
        ),
        "con_detenido": False,
    },
    "HOMICIDIO": {
        "delito_codigos": ["HOMICIDIO"],
        "delito_fallback_nombre": "Homicidio",
        "prioridad": [ParteAprehension.Prioridad.ALTA, ParteAprehension.Prioridad.CRITICA],
        "riesgo": [ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.SI,
        "hay_armas": ParteAprehension.SiNo.SI,
        "titulo": "Homicidio / lesiones graves — {sector}",
        "desc": (
            "Levantamiento de indicios en escena con hallazgos compatibles con "
            "homicidio o agresión con arma ({archivo}). Preservación de cadena de "
            "custodia iniciada. Lugar: {lugar}. Sector: {sector}."
        ),
        "con_detenido": True,
    },
    "NARCO": {
        "delito_codigos": ["TRAFICO_DROGAS", "CRIMEN_ORGANIZADO", "EXTORSION"],
        "delito_fallback_nombre": "Tráfico de drogas",
        "prioridad": [ParteAprehension.Prioridad.ALTA, ParteAprehension.Prioridad.CRITICA],
        "riesgo": [ParteAprehension.NivelRiesgo.ALTO, ParteAprehension.NivelRiesgo.MEDIO],
        "hay_heridos": ParteAprehension.SiNo.NO,
        "hay_armas": ParteAprehension.SiNo.SI,
        "titulo": "Incautación / crimen organizado — {sector}",
        "desc": (
            "Operativo con incautación de sustancia/elementos vinculados a "
            "narcotráfico o crimen organizado. Evidencia: {archivo}. "
            "Sitio: {lugar}. Sector: {sector}."
        ),
        "con_detenido": True,
    },
    "ROBO": {
        "delito_codigos": ["ROBO", "HURTO", "EXTORSION"],
        "delito_fallback_nombre": "Robo",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.ALTA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.DESCONOCIDO,
        "hay_armas": ParteAprehension.SiNo.DESCONOCIDO,
        "titulo": "Robo / flagrancia — {sector}",
        "desc": (
            "Intervención por robo o flagrancia. Se registra evidencia fotográfica "
            "({archivo}) y datos del procedimiento. Lugar: {lugar}. Sector: {sector}."
        ),
        "con_detenido": True,
    },
    "INVESTIGACION": {
        "delito_codigos": ["EXTORSION_DIGITAL", "EXTORSION", "ROBO", "HURTO"],
        "delito_fallback_nombre": "Extorsión digital",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.BAJA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.BAJO],
        "hay_heridos": ParteAprehension.SiNo.NO,
        "hay_armas": ParteAprehension.SiNo.NO,
        "titulo": "Diligencia investigativa — {sector}",
        "desc": (
            "Parte de apoyo a investigación: análisis forense / documentación de "
            "indicios ({archivo}). Lugar de diligencia: {lugar}. Sector: {sector}."
        ),
        "con_detenido": False,
    },
}


def _slug_ascii(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _normalize_name(filename: str) -> str:
    stem = Path(filename).stem.lower()
    stem = _slug_ascii(stem)
    return re.sub(r"[^a-z0-9_]+", "_", stem)


def categorize_evidence(filename: str) -> str:
    name = _normalize_name(filename)
    for category, keywords in EVIDENCE_RULES:
        for kw in keywords:
            if kw in name:
                return category
    return "INVESTIGACION"


def resolve_evidencias_dir(explicit: str | None = None) -> Path:
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.extend(
        [
            Path("/demo_data/EvidenciasCriminalistas"),
            Path(__file__).resolve().parents[4] / "demo_data" / "EvidenciasCriminalistas",
            Path("/app/../demo_data/EvidenciasCriminalistas").resolve(),
        ]
    )
    for path in candidates:
        try:
            if path.is_dir() and any(path.glob("*.jpg")):
                return path
        except OSError:
            continue
    raise CommandError(
        "No se encontró EvidenciasCriminalistas/. "
        "Monte ./demo_data en el contenedor o pase --evidencias-dir."
    )


def jitter_coords(base_lat: float, base_lon: float, rng: random.Random) -> tuple[float, float]:
    return (
        round(base_lat + rng.uniform(-0.035, 0.035), 7),
        round(base_lon + rng.uniform(-0.035, 0.035), 7),
    )


class Command(BaseCommand):
    help = (
        "Puebla PostgreSQL con usuarios, jurisdicciones, ~200 partes y evidencias "
        "coherentes (MinIO) para alimentar dashboards y el ETL a ClickHouse."
    )

    def add_arguments(self, parser):
        parser.add_argument("--partes", type=int, default=200, help="Cantidad de partes a crear")
        parser.add_argument("--seed", type=int, default=42, help="Semilla reproducible")
        parser.add_argument(
            "--evidencias-dir",
            type=str,
            default="",
            help="Ruta a la carpeta EvidenciasCriminalistas",
        )
        parser.add_argument(
            "--skip-parquet",
            action="store_true",
            help="No subir parquet de partes aprobados al data lake",
        )
        parser.add_argument(
            "--skip-upload",
            action="store_true",
            help="No subir JPG a MinIO (solo metadatos locales ficticios)",
        )
        parser.add_argument(
            "--users-per-role",
            type=int,
            default=3,
            help="Usuarios mínimos por rol",
        )

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        fake = Faker("es_ES")
        Faker.seed(options["seed"])

        evid_dir = resolve_evidencias_dir(options["evidencias_dir"] or None)
        images = sorted(evid_dir.glob("*.jpg"))
        if not images:
            raise CommandError(f"No hay JPG en {evid_dir}")

        self.stdout.write(self.style.NOTICE(f"Evidencias: {evid_dir} ({len(images)} JPG)"))

        self._ensure_delitos()
        zonas, distritos = self._ensure_jurisdictions()
        users_by_role = self._ensure_users(
            fake, rng, zonas, distritos, options["users_per_role"]
        )

        agentes = users_by_role[SystemRole.AGENTE_OPERATIVO]
        supervisores = users_by_role[SystemRole.SUPERVISOR_UNIDAD]
        if not agentes:
            raise CommandError("No hay agentes operativos para crear partes.")

        n_partes = max(1, int(options["partes"]))
        created = self._seed_partes(
            fake=fake,
            rng=rng,
            images=images,
            agentes=agentes,
            supervisores=supervisores,
            distritos=distritos,
            n_partes=n_partes,
            skip_parquet=options["skip_parquet"],
            skip_upload=options["skip_upload"],
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_db OK · usuarios por rol listos · jurisdicciones={len(distritos)} "
                f"distritos · partes_creados={created}/{n_partes}"
            )
        )
        self.stdout.write(
            "Credenciales seed: email {Rol}{Nombre}@gmail.com · password admin123"
        )

    def _ensure_delitos(self):
        defaults = [
            ("ROBO", "Robo", "120", "Robo / Property crime"),
            ("HURTO", "Hurto", "0820", "Larceny / Property crime"),
            ("EXTORSION", "Extorsión", "1210", "Robbery / Extortion"),
            ("EXTORSION_DIGITAL", "Extorsión digital", "1211", "Cybercrime / Extortion"),
            ("HOMICIDIO", "Homicidio", "0110", "Homicide"),
            ("ACCIDENTE_TRANSITO", "Accidente de tránsito", "3700", "Traffic accident"),
            ("TRAFICO_DROGAS", "Tráfico de drogas", "1811", "Narcotics"),
            ("CRIMEN_ORGANIZADO", "Crimen organizado", "1812", "Organized crime"),
        ]
        for codigo, nombre, iucr, fbi in defaults:
            TipoDelito.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "nombre": nombre,
                    "codigo_iucr": iucr,
                    "clasificacion_fbi": fbi,
                    "activo": True,
                },
            )

    def _ensure_jurisdictions(self):
        """Reutiliza zonas/distritos existentes; completa mínimo 2 zonas × 3 distritos."""
        zonas = list(
            Jurisdiction.objects.filter(tipo=JurisdictionType.ZONA, activo=True).order_by("id")
        )
        if len(zonas) < 2:
            specs = [
                ("ZN-08-GYE", "Zona 8 - Guayaquil", "Z8"),
                ("ZN-09-DMQ", "Zona 9 - DMQ", "Z9"),
            ]
            for codigo, nombre, _tag in specs:
                zona, _ = Jurisdiction.objects.get_or_create(
                    codigo=codigo,
                    defaults={
                        "tipo": JurisdictionType.ZONA,
                        "nombre": nombre,
                        "activo": True,
                    },
                )
                if zona not in zonas:
                    zonas.append(zona)
            zonas = list(
                Jurisdiction.objects.filter(tipo=JurisdictionType.ZONA, activo=True).order_by("id")
            )[:2]

        distritos = []
        for idx, zona in enumerate(zonas[:2]):
            tag = "Z8" if idx == 0 else "Z9"
            hijos = list(
                Jurisdiction.objects.filter(
                    parent=zona,
                    tipo=JurisdictionType.DISTRITO,
                    activo=True,
                ).order_by("id")
            )
            needed = max(0, 3 - len(hijos))
            for i in range(needed):
                n = len(hijos) + i + 1
                d, _ = Jurisdiction.objects.get_or_create(
                    codigo=f"{zona.codigo}-D{n:02d}",
                    defaults={
                        "tipo": JurisdictionType.DISTRITO,
                        "nombre": f"Distrito {n} — {zona.nombre}",
                        "parent": zona,
                        "activo": True,
                    },
                )
                hijos.append(d)
            for d in hijos[:3]:
                distritos.append({"jur": d, "zona": zona, "tag": tag})

        # Mantener Sector 12 legacy si existe (ClickHouse demo previo)
        sec12 = Jurisdiction.objects.filter(nombre__iexact="Sector 12").first()
        if sec12 and all(x["jur"].id != sec12.id for x in distritos):
            parent = sec12.parent or zonas[0]
            tag = "Z9" if "quito" in (parent.nombre or "").lower() or "dmq" in (parent.nombre or "").lower() else "Z8"
            if "norte" in (parent.nombre or "").lower():
                tag = "Z9"
            distritos.append({"jur": sec12, "zona": parent, "tag": tag})

        self.stdout.write(
            self.style.SUCCESS(
                f"Jurisdicciones: {len(zonas)} zonas · {len(distritos)} distritos disponibles"
            )
        )
        return zonas[:2], distritos

    def _unique_first_name(self, fake: Faker, used: set[str]) -> str:
        for _ in range(80):
            name = _slug_ascii(fake.first_name()).replace(" ", "")
            name = re.sub(r"[^A-Za-z]", "", name)
            if len(name) < 3:
                continue
            name = name[:12].capitalize()
            if name.lower() not in used:
                used.add(name.lower())
                return name
        # fallback
        token = f"User{len(used)+1}"
        used.add(token.lower())
        return token

    def _ensure_users(self, fake, rng, zonas, distritos, users_per_role: int):
        used_names: set[str] = set()
        by_role: dict[str, list[User]] = {spec["role"]: [] for spec in ROLE_SPECS}

        for spec in ROLE_SPECS:
            role = spec["role"]
            prefix = spec["prefix"]
            existing = list(
                User.objects.filter(profile__role=role, email__iendswith="@gmail.com")
                .select_related("profile")
                .order_by("id")
            )
            # también contar seed previos por patrón de email
            for u in existing:
                by_role[role].append(u)
                m = re.match(rf"^{re.escape(prefix)}([A-Za-z]+)@", u.email or "", re.I)
                if m:
                    used_names.add(m.group(1).lower())

            need = max(0, users_per_role - len(by_role[role]))
            for _ in range(need):
                first = self._unique_first_name(fake, used_names)
                last = _slug_ascii(fake.last_name()).replace(" ", "")[:14]
                email = f"{prefix}{first}@gmail.com"
                username = email.lower()
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": first,
                        "last_name": last or "Demo",
                        "is_staff": False,
                        "is_active": True,
                    },
                )
                user.email = email
                user.first_name = first
                user.last_name = last or "Demo"
                user.set_password("admin123")
                user.is_active = True
                user.save()

                # Asignación geográfica lógica
                if role == SystemRole.DIRECTOR_ZONA:
                    zona = zonas[len(by_role[role]) % len(zonas)] if zonas else None
                    jur = zona
                    zona_txt = zona.nombre if zona else ""
                elif role == SystemRole.VISOR_EJECUTIVO:
                    jur = None
                    zona_txt = "Nacional"
                else:
                    dinfo = distritos[len(by_role[role]) % len(distritos)] if distritos else None
                    jur = dinfo["jur"] if dinfo else (zonas[0] if zonas else None)
                    zona_txt = dinfo["jur"].nombre if dinfo else ""

                cedula = f"09{rng.randint(10000000, 99999999)}"
                while UserProfile.objects.filter(cedula=cedula).exclude(user=user).exists():
                    cedula = f"09{rng.randint(10000000, 99999999)}"

                UserProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "role": role,
                        "rango_tipico": spec["rango"],
                        "rango_policial": spec["rango"],
                        "unidad": spec["unidad"],
                        "zona": zona_txt,
                        "jurisdiccion": jur,
                        "estado": AccountStatus.ACTIVO,
                        "cedula": cedula,
                        "placa": f"P-{rng.randint(1000, 9999)}",
                        "telefono": f"09{rng.randint(10000000, 99999999)}",
                    },
                )
                by_role[role].append(user)
                state = "creado" if created else "actualizado"
                self.stdout.write(f"  {state}: {email} → {role}")

        return by_role

    def _pick_estado(self, rng: random.Random) -> str:
        roll = rng.random()
        if roll < 0.80:
            return ParteAprehension.EstadoRevision.APROBADO
        if roll < 0.95:
            return ParteAprehension.EstadoRevision.EN_REVISION  # PENDIENTE
        return ParteAprehension.EstadoRevision.OBSERVADO  # DEVUELTO

    def _resolve_delito(self, category: str, rng: random.Random) -> TipoDelito:
        meta = CATEGORY_META[category]
        choices = []
        for codigo in meta["delito_codigos"]:
            obj = TipoDelito.objects.filter(codigo=codigo, activo=True).first()
            if obj:
                choices.append(obj)
        if choices:
            return rng.choice(choices)
        obj, _ = TipoDelito.objects.get_or_create(
            codigo=f"AUTO_{category}",
            defaults={
                "nombre": meta["delito_fallback_nombre"],
                "activo": True,
            },
        )
        return obj

    def _seed_partes(
        self,
        *,
        fake,
        rng,
        images,
        agentes,
        supervisores,
        distritos,
        n_partes,
        skip_parquet,
        skip_upload,
    ) -> int:
        now = timezone.now()
        created = 0
        parquet_ok = 0
        upload_ok = 0

        # Distribución de categorías según imágenes disponibles
        categorized = [(img, categorize_evidence(img.name)) for img in images]
        by_cat: dict[str, list[Path]] = {}
        for img, cat in categorized:
            by_cat.setdefault(cat, []).append(img)

        self.stdout.write("Mapa evidencia → categoría:")
        for cat, files in sorted(by_cat.items()):
            self.stdout.write(f"  {cat}: {len(files)} archivos")

        # Cache de bytes + un solo upload MinIO por imagen única
        image_cache: dict[str, bytes] = {}
        uploaded_meta: dict[str, dict] = {}
        for img in images:
            image_cache[img.name] = img.read_bytes()
            if skip_upload:
                uploaded_meta[img.name] = {
                    "bucket": "evidencias",
                    "object_key": f"seed/library/{img.name}",
                    "nombre_archivo": img.name,
                    "content_type": "image/jpeg",
                    "tamanio_bytes": len(image_cache[img.name]),
                }
            else:
                try:
                    uploaded_meta[img.name] = upload_evidencia(
                        file_bytes=image_cache[img.name],
                        filename=img.name,
                        content_type="image/jpeg",
                        folder="seed/library",
                    )
                    upload_ok += 1
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(
                        self.style.WARNING(f"MinIO library upload falló ({img.name}): {exc}")
                    )
                    uploaded_meta[img.name] = {
                        "bucket": "evidencias",
                        "object_key": f"seed-offline/library/{img.name}",
                        "nombre_archivo": img.name,
                        "content_type": "image/jpeg",
                        "tamanio_bytes": len(image_cache[img.name]),
                    }

        # Liberar RAM de imágenes (ya están en MinIO / metadatos)
        image_cache.clear()

        approved_ids: list[int] = []

        for i in range(n_partes):
            # Round-robin + random para cubrir todas las categorías
            if i < len(categorized):
                img, category = categorized[i % len(categorized)]
            else:
                category = rng.choice(list(by_cat.keys()))
                img = rng.choice(by_cat[category])

            meta = CATEGORY_META[category]
            agente = rng.choice(agentes)
            supervisor = rng.choice(supervisores) if supervisores else None
            dinfo = rng.choice(distritos) if distritos else None
            sector = dinfo["jur"].nombre if dinfo else "Sector demo"
            tag = dinfo["tag"] if dinfo else "Z9"
            geo = GEO_BASE.get(tag, GEO_BASE["Z9"])
            lat, lon = jitter_coords(geo["lat"], geo["lon"], rng)

            days_ago = rng.randint(0, 59)
            minutes = rng.randint(0, 24 * 60 - 1)
            fecha_hora = now - timedelta(days=days_ago, minutes=minutes)
            if timezone.is_naive(fecha_hora):
                fecha_hora = timezone.make_aware(fecha_hora)

            estado = self._pick_estado(rng)
            delito = self._resolve_delito(category, rng)
            lugar = f"{fake.street_address()}, {geo['ciudad']}"
            titulo = meta["titulo"].format(sector=sector)
            descripcion = meta["desc"].format(
                lugar=lugar, archivo=img.name, sector=sector
            )

            detenido_nombres = ""
            detenido_apellidos = ""
            detenido_cedula = ""
            detenido_edad = None
            derechos = False
            if meta["con_detenido"] and rng.random() < 0.7:
                detenido_nombres = fake.first_name()
                detenido_apellidos = fake.last_name()
                detenido_cedula = f"17{rng.randint(10000000, 99999999)}"
                detenido_edad = rng.randint(18, 55)
                derechos = True

            year = fecha_hora.year
            seq = i + 1
            numero = f"SEED-{year}-{seq:04d}"
            while ParteAprehension.objects.filter(numero_caso=numero).exists():
                seq += 1000
                numero = f"SEED-{year}-{seq:04d}"

            with transaction.atomic():
                parte = ParteAprehension(
                    creado_por=agente,
                    estado_revision=estado,
                    numero_caso=numero,
                    titulo=titulo,
                    tipo_delito=delito,
                    fecha_hora=fecha_hora,
                    fecha_hecho=timezone.localtime(fecha_hora).date(),
                    hora_hecho=timezone.localtime(fecha_hora).time().replace(microsecond=0),
                    prioridad=rng.choice(meta["prioridad"]),
                    nivel_riesgo=rng.choice(meta["riesgo"]),
                    lugar=lugar,
                    sector_zona=sector,
                    descripcion=descripcion,
                    relato_hechos=descripcion,
                    fuente_reporte=rng.choice(
                        [
                            ParteAprehension.FuenteReporte.PATRULLAJE,
                            ParteAprehension.FuenteReporte.LLAMADA_911,
                            ParteAprehension.FuenteReporte.DENUNCIA_PRESENCIAL,
                        ]
                    ),
                    hay_heridos=meta["hay_heridos"],
                    hay_armas=meta["hay_armas"],
                    latitud=lat,
                    longitud=lon,
                    detenido_nombres=detenido_nombres,
                    detenido_apellidos=detenido_apellidos,
                    detenido_cedula=detenido_cedula,
                    detenido_edad=detenido_edad,
                    derechos_leidos=derechos,
                    bloqueado=estado == ParteAprehension.EstadoRevision.APROBADO,
                )
                if estado == ParteAprehension.EstadoRevision.APROBADO:
                    parte.aprobado_en = fecha_hora + timedelta(hours=rng.randint(1, 18))
                    parte.revisado_por = supervisor
                    parte.enviado_revision_en = fecha_hora + timedelta(hours=1)
                elif estado == ParteAprehension.EstadoRevision.EN_REVISION:
                    parte.enviado_revision_en = fecha_hora + timedelta(hours=1)
                elif estado == ParteAprehension.EstadoRevision.OBSERVADO:
                    parte.enviado_revision_en = fecha_hora + timedelta(hours=1)
                    parte.rechazado_en = fecha_hora + timedelta(hours=rng.randint(2, 12))
                    parte.revisado_por = supervisor
                    parte.motivo_rechazo = (
                        "Observado en control de calidad: completar indicios / "
                        "corregir inconsistencias del relato."
                    )

                parte.save()
                ParteAprehension.objects.filter(pk=parte.pk).update(
                    creado_en=fecha_hora,
                    actualizado_en=fecha_hora + timedelta(hours=2),
                )

                meta_up = dict(uploaded_meta[img.name])
                # Misma evidencia física reutilizada; object_key de la librería seed
                MultimediaEvidencia.objects.create(
                    subido_por=agente,
                    origen=MultimediaEvidencia.Origen.PARTE,
                    parte=parte,
                    descripcion=f"Evidencia coherente [{category}] · {img.name}",
                    nombre_archivo=meta_up["nombre_archivo"],
                    content_type=meta_up["content_type"],
                    tamanio_bytes=meta_up["tamanio_bytes"],
                    bucket=meta_up["bucket"],
                    object_key=meta_up["object_key"],
                )

            if estado == ParteAprehension.EstadoRevision.APROBADO:
                approved_ids.append(parte.id)

            created += 1
            if created % 25 == 0:
                self.stdout.write(f"  … {created}/{n_partes} partes")

        # Parquet ETL en lote (más liviano que 1 pandas por parte)
        if not skip_parquet and approved_ids:
            parquet_ok = self._upload_parquet_batch(approved_ids)

        self.stdout.write(
            self.style.SUCCESS(
                f"Partes: {created} · uploads MinIO: {upload_ok} · parquet ETL: {parquet_ok}"
            )
        )
        return created

    def _upload_parquet_batch(self, parte_ids: list[int]) -> int:
        """Sube parquet individual por parte aprobado, sin reabrir DataFrames enormes."""
        ok = 0
        qs = (
            ParteAprehension.objects.filter(id__in=parte_ids)
            .select_related("tipo_delito", "creado_por")
            .iterator(chunk_size=50)
        )
        for parte in qs:
            try:
                payload = build_parquet_bytes(parte)
                filename = f"{parte.numero_caso or f'parte-{parte.id}'}.parquet"
                upload_evidencia(
                    file_bytes=payload,
                    filename=filename,
                    content_type="application/vnd.apache.parquet",
                    folder="partes",
                    bucket=settings.MINIO_BUCKET_OPERATIVO,
                )
                ok += 1
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(
                    self.style.WARNING(f"Parquet falló {parte.numero_caso}: {exc}")
                )
        return ok