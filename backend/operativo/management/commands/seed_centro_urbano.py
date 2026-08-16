"""
Siembra operativa láser: Circuito Centro Urbano.

Uso:
  python manage.py seed_centro_urbano
  python manage.py seed_centro_urbano --partes 200 --seed 42
  python manage.py seed_centro_urbano --skip-parquet
  python manage.py seed_centro_urbano --force   # elimina partes CCU-* previos y regenera
"""

from __future__ import annotations

import random
import re
import unicodedata
from datetime import timedelta
from pathlib import Path

from django.conf import settings
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

try:
    from faker import Faker
except ImportError as exc:  # pragma: no cover
    raise CommandError(
        "Falta la librería 'Faker'. Instálala (pip install Faker) y reintenta."
    ) from exc


PASSWORD = "admin123"
JUR_NOMBRE = "Circuito Centro Urbano"
JUR_CODIGO = "CIR-CENTRO-URBANO"
NUMERO_PREFIX = "CCU"

# Quito · Circuito Centro (jitter en partes)
GEO_LAT = -0.1807
GEO_LON = -78.4678
CIUDAD = "Quito"

# Subsectores bajo el circuito (para ranking / tipología en el dashboard)
CHILD_DISTRICTS = [
    ("CIR-CU-HIST", "Distrito Centro Histórico"),
    ("CIR-CU-MARI", "Distrito La Mariscal"),
    ("CIR-CU-ITCHA", "Distrito Itchimbía"),
    ("CIR-CU-GCAL", "Distrito González Suárez"),
]

TEAM_SPECS = [
    {
        "role": SystemRole.DIRECTOR_ZONA,
        "email_role": "JefeZona",
        "count": 1,
        "rango": "Coronel",
        "unidad": "Jefatura Circuito Centro Urbano",
    },
    {
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "email_role": "Supervisor",
        "count": 2,
        "rango": "Capitán",
        "unidad": "Supervisión Urbana Centro",
    },
    {
        "role": SystemRole.DETECTIVE,
        "email_role": "Detective",
        "count": 3,
        "rango": "Detective",
        "unidad": "PJ Circuito Centro",
    },
    {
        "role": SystemRole.AGENTE_OPERATIVO,
        "email_role": "Agente",
        "count": 10,
        "rango": "Cabo",
        "unidad": "Servicio Urbano Centro",
    },
]

# Orden importa: reglas más específicas primero
EVIDENCE_RULES = [
    (
        "ACCIDENTE",
        ("choque", "colision", "accidente", "vehiculo_accidentado", "vidrios_calzada"),
    ),
    (
        "NARCO",
        ("drogas", "incautacion", "balanza", "dinero_incautado", "jeringas"),
    ),
    (
        "ROBO",
        ("arresto", "detenido_esposado", "esposado", "operativo", "huella_calzado"),
    ),
    (
        "HOMICIDIO",
        ("cuerpo", "cuchillo", "sangre", "casquillo", "bala", "revolver"),
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
        "delito_fallback_nombre": "Accidente de Tránsito",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.ALTA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.SI,
        "hay_armas": ParteAprehension.SiNo.NO,
        "titulo": "Accidente de tránsito — {sector}",
        "desc": (
            "Colisión vehicular en {lugar} ({sector}). Evidencia fotográfica: {archivo}. "
            "Unidades de tránsito y auxilio en el lugar."
        ),
        "con_detenido": False,
    },
    "HOMICIDIO": {
        "delito_codigos": ["HOMICIDIO", "ASESINATO"],
        "delito_fallback_nombre": "Homicidio",
        "prioridad": [ParteAprehension.Prioridad.ALTA, ParteAprehension.Prioridad.CRITICA],
        "riesgo": [ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.SI,
        "hay_armas": ParteAprehension.SiNo.SI,
        "titulo": "Homicidio / asesinato — {sector}",
        "desc": (
            "Escena con indicios de homicidio/asesinato en {lugar} ({sector}). "
            "Cadena de custodia iniciada. Evidencia: {archivo}."
        ),
        "con_detenido": True,
    },
    "NARCO": {
        "delito_codigos": ["TRAFICO_DROGAS", "CRIMEN_ORGANIZADO"],
        "delito_fallback_nombre": "Narcotráfico",
        "prioridad": [ParteAprehension.Prioridad.ALTA, ParteAprehension.Prioridad.CRITICA],
        "riesgo": [ParteAprehension.NivelRiesgo.ALTO, ParteAprehension.NivelRiesgo.MEDIO],
        "hay_heridos": ParteAprehension.SiNo.NO,
        "hay_armas": ParteAprehension.SiNo.SI,
        "titulo": "Narcotráfico / incautación — {sector}",
        "desc": (
            "Operativo antinarcóticos en {lugar} ({sector}). Incautación documentada "
            "({archivo})."
        ),
        "con_detenido": True,
    },
    "ROBO": {
        "delito_codigos": ["ROBO", "EXTORSION", "HURTO"],
        "delito_fallback_nombre": "Robo",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.ALTA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.ALTO],
        "hay_heridos": ParteAprehension.SiNo.DESCONOCIDO,
        "hay_armas": ParteAprehension.SiNo.DESCONOCIDO,
        "titulo": "Robo / extorsión — {sector}",
        "desc": (
            "Flagrancia por robo/extorsión en {lugar} ({sector}). "
            "Registro fotográfico: {archivo}."
        ),
        "con_detenido": True,
    },
    "INVESTIGACION": {
        "delito_codigos": ["EXTORSION", "ROBO", "HURTO"],
        "delito_fallback_nombre": "Robo",
        "prioridad": [ParteAprehension.Prioridad.MEDIA, ParteAprehension.Prioridad.BAJA],
        "riesgo": [ParteAprehension.NivelRiesgo.MEDIO, ParteAprehension.NivelRiesgo.BAJO],
        "hay_heridos": ParteAprehension.SiNo.NO,
        "hay_armas": ParteAprehension.SiNo.NO,
        "titulo": "Diligencia investigativa — {sector}",
        "desc": (
            "Apoyo investigativo en {lugar} ({sector}). Documentación forense: {archivo}."
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
            Path(settings.BASE_DIR).resolve().parent / "demo_data" / "EvidenciasCriminalistas",
        ]
    )
    for path in candidates:
        try:
            if path.is_dir() and any(path.glob("*.jpg")):
                return path
        except OSError:
            continue
    raise CommandError(
        "No se encontró EvidenciasCriminalistas/ con JPG. "
        "Monte ./demo_data o use --evidencias-dir."
    )


def jitter_coords(rng: random.Random) -> tuple[float, float]:
    return (
        round(GEO_LAT + rng.uniform(-0.018, 0.018), 7),
        round(GEO_LON + rng.uniform(-0.018, 0.018), 7),
    )


class Command(BaseCommand):
    help = (
        "Puebla PostgreSQL con personal y 200 partes SOLO en "
        f"'{JUR_NOMBRE}', con evidencias coherentes (MinIO) y parquet ETL."
    )

    def add_arguments(self, parser):
        parser.add_argument("--partes", type=int, default=200, help="Cantidad de partes")
        parser.add_argument("--seed", type=int, default=42, help="Semilla reproducible")
        parser.add_argument(
            "--evidencias-dir",
            type=str,
            default="",
            help="Ruta a EvidenciasCriminalistas",
        )
        parser.add_argument(
            "--skip-parquet",
            action="store_true",
            help="No subir parquet de partes APROBADO al data lake",
        )
        parser.add_argument(
            "--skip-upload",
            action="store_true",
            help="No subir JPG a MinIO (metadatos offline)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help=f"Elimina partes con número {NUMERO_PREFIX}-* antes de regenerar",
        )

    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        fake = Faker("es_ES")
        Faker.seed(options["seed"])
        n_partes = max(1, int(options["partes"]))

        evid_dir = resolve_evidencias_dir(options["evidencias_dir"] or None)
        images = sorted(evid_dir.glob("*.jpg"))
        if not images:
            raise CommandError(f"No hay JPG en {evid_dir}")

        self.stdout.write(self.style.NOTICE(f"Evidencias: {evid_dir} ({len(images)} JPG)"))

        with transaction.atomic():
            circuito, children = self._ensure_jurisdiction()
            self._ensure_delitos()
            team = self._ensure_team(fake, rng, circuito)

            if options["force"]:
                deleted, _ = ParteAprehension.objects.filter(
                    numero_caso__startswith=f"{NUMERO_PREFIX}-"
                ).delete()
                self.stdout.write(
                    self.style.WARNING(f"Force: eliminados {deleted} registros CCU previos")
                )

            agentes = team[SystemRole.AGENTE_OPERATIVO]
            supervisores = team[SystemRole.SUPERVISOR_UNIDAD]
            if len(agentes) < 10:
                raise CommandError("Se esperaban al menos 10 agentes urbanos.")

            created, approved_ids, upload_ok, counts = self._seed_partes(
                fake=fake,
                rng=rng,
                images=images,
                agentes=agentes,
                supervisores=supervisores,
                circuito=circuito,
                children=children,
                n_partes=n_partes,
                skip_upload=options["skip_upload"],
            )

        parquet_ok = 0
        if not options["skip_parquet"] and approved_ids:
            parquet_ok = self._upload_parquet_batch(approved_ids)

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"OK · {created} partes insertados en «{JUR_NOMBRE}» "
                f"(APROBADO={counts['APROBADO']}, "
                f"PENDIENTE/EN_REVISION={counts['EN_REVISION']}, "
                f"DEVUELTO/OBSERVADO={counts['OBSERVADO']})"
            )
        )
        self.stdout.write(
            f"MinIO evidencias únicas: {upload_ok} · parquet ETL: {parquet_ok}/{len(approved_ids)}"
        )
        self.stdout.write("Credenciales Circuito Centro Urbano (password: admin123):")
        for role, users in team.items():
            for u in users:
                self.stdout.write(f"  · {u.email}  [{role}]")

    def _ensure_jurisdiction(self) -> tuple[Jurisdiction, list[Jurisdiction]]:
        circuito = Jurisdiction.objects.filter(nombre=JUR_NOMBRE).first()
        if circuito is None:
            circuito = Jurisdiction.objects.filter(codigo=JUR_CODIGO).first()
        if circuito is None:
            circuito = Jurisdiction.objects.create(
                codigo=JUR_CODIGO,
                tipo=JurisdictionType.CIRCUITO,
                nombre=JUR_NOMBRE,
                activo=True,
            )
            self.stdout.write(f"  creada jurisdicción «{JUR_NOMBRE}»")
        else:
            changed_fields = []
            if circuito.nombre != JUR_NOMBRE:
                circuito.nombre = JUR_NOMBRE
                changed_fields.append("nombre")
            if circuito.tipo != JurisdictionType.CIRCUITO:
                circuito.tipo = JurisdictionType.CIRCUITO
                changed_fields.append("tipo")
            if not circuito.activo:
                circuito.activo = True
                changed_fields.append("activo")
            if circuito.codigo != JUR_CODIGO:
                conflict = (
                    Jurisdiction.objects.filter(codigo=JUR_CODIGO)
                    .exclude(pk=circuito.pk)
                    .exists()
                )
                if not conflict:
                    circuito.codigo = JUR_CODIGO
                    changed_fields.append("codigo")
            if changed_fields:
                changed_fields.append("actualizado_en")
                circuito.save(update_fields=changed_fields)
            self.stdout.write(f"  reutilizada jurisdicción «{JUR_NOMBRE}» (id={circuito.id})")

        children: list[Jurisdiction] = []
        for codigo, nombre in CHILD_DISTRICTS:
            child, _ = Jurisdiction.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "tipo": JurisdictionType.DISTRITO,
                    "nombre": nombre,
                    "parent": circuito,
                    "activo": True,
                },
            )
            changed = False
            if child.parent_id != circuito.id:
                child.parent = circuito
                changed = True
            if child.nombre != nombre:
                child.nombre = nombre
                changed = True
            if not child.activo:
                child.activo = True
                changed = True
            if changed:
                child.save()
            children.append(child)

        self.stdout.write(
            self.style.SUCCESS(
                f"Jurisdicción lista: {circuito.nombre} (id={circuito.id}) · "
                f"{len(children)} distritos hijos"
            )
        )
        return circuito, children

    def _ensure_delitos(self):
        defaults = [
            ("ROBO", "Robo", "120", "Robo / Property crime"),
            ("HURTO", "Hurto", "0820", "Larceny / Property crime"),
            ("EXTORSION", "Extorsión", "1210", "Robbery / Extortion"),
            ("HOMICIDIO", "Homicidio", "0110", "Homicide"),
            ("ASESINATO", "Asesinato", "0110", "Murder"),
            ("ACCIDENTE_TRANSITO", "Accidente de Tránsito", "3700", "Traffic accident"),
            ("TRAFICO_DROGAS", "Narcotráfico", "1811", "Narcotics"),
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

    def _ensure_team(
        self, fake: Faker, rng: random.Random, circuito: Jurisdiction
    ) -> dict[str, list[User]]:
        team: dict[str, list[User]] = {spec["role"]: [] for spec in TEAM_SPECS}

        for spec in TEAM_SPECS:
            role = spec["role"]
            email_role = spec["email_role"]
            for n in range(1, spec["count"] + 1):
                email = f"{email_role}Urbano{n}@gmail.com"
                username = email.lower()
                first = fake.first_name()
                last = fake.last_name()
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": email,
                        "first_name": first,
                        "last_name": last,
                        "is_active": True,
                        "is_staff": False,
                    },
                )
                user.email = email
                if created or not user.first_name:
                    user.first_name = first
                    user.last_name = last
                user.set_password(PASSWORD)
                user.is_active = True
                user.save()

                cedula = f"17{rng.randint(10000000, 99999999)}"
                while UserProfile.objects.filter(cedula=cedula).exclude(user=user).exists():
                    cedula = f"17{rng.randint(10000000, 99999999)}"

                UserProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        "role": role,
                        "rango_tipico": spec["rango"],
                        "rango_policial": spec["rango"],
                        "unidad": spec["unidad"],
                        "zona": JUR_NOMBRE,
                        "jurisdiccion": circuito,
                        "estado": AccountStatus.ACTIVO,
                        "cedula": cedula,
                        "placa": f"CU-{rng.randint(1000, 9999)}",
                        "telefono": f"09{rng.randint(10000000, 99999999)}",
                    },
                )
                team[role].append(user)
                state = "creado" if created else "actualizado"
                self.stdout.write(f"  {state}: {email} → {role}")

        return team

    def _pick_estado(self, rng: random.Random) -> str:
        """80% APROBADO · 15% PENDIENTE (EN_REVISION) · 5% DEVUELTO (OBSERVADO)."""
        roll = rng.random()
        if roll < 0.80:
            return ParteAprehension.EstadoRevision.APROBADO
        if roll < 0.95:
            return ParteAprehension.EstadoRevision.EN_REVISION
        return ParteAprehension.EstadoRevision.OBSERVADO

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
            defaults={"nombre": meta["delito_fallback_nombre"], "activo": True},
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
        circuito,
        children,
        n_partes,
        skip_upload,
    ) -> tuple[int, list[int], int, dict[str, int]]:
        now = timezone.now()
        created = 0
        upload_ok = 0
        approved_ids: list[int] = []
        counts = {"APROBADO": 0, "EN_REVISION": 0, "OBSERVADO": 0}

        sectors = [c.nombre for c in children] or [circuito.nombre]
        # Asegura que el nombre exacto del circuito también aparezca en algunos partes
        sectors.append(circuito.nombre)

        categorized = [(img, categorize_evidence(img.name)) for img in images]
        by_cat: dict[str, list[Path]] = {}
        for img, cat in categorized:
            by_cat.setdefault(cat, []).append(img)

        self.stdout.write("Mapa evidencia → categoría:")
        for cat, files in sorted(by_cat.items()):
            self.stdout.write(f"  {cat}: {len(files)} archivos")

        uploaded_meta: dict[str, dict] = {}
        for img in images:
            raw = img.read_bytes()
            if skip_upload:
                uploaded_meta[img.name] = {
                    "bucket": getattr(settings, "MINIO_BUCKET_EVIDENCIAS", "evidencias"),
                    "object_key": f"seed/centro-urbano/library/{img.name}",
                    "nombre_archivo": img.name,
                    "content_type": "image/jpeg",
                    "tamanio_bytes": len(raw),
                }
            else:
                try:
                    uploaded_meta[img.name] = upload_evidencia(
                        file_bytes=raw,
                        filename=img.name,
                        content_type="image/jpeg",
                        folder="seed/centro-urbano/library",
                    )
                    upload_ok += 1
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(
                        self.style.WARNING(f"MinIO falló ({img.name}): {exc}")
                    )
                    uploaded_meta[img.name] = {
                        "bucket": "evidencias",
                        "object_key": f"seed-offline/centro-urbano/{img.name}",
                        "nombre_archivo": img.name,
                        "content_type": "image/jpeg",
                        "tamanio_bytes": len(raw),
                    }

        for i in range(n_partes):
            if i < len(categorized):
                img, category = categorized[i % len(categorized)]
            else:
                category = rng.choice(list(by_cat.keys()))
                img = rng.choice(by_cat[category])

            meta = CATEGORY_META[category]
            agente = rng.choice(agentes)
            supervisor = rng.choice(supervisores) if supervisores else None
            sector = rng.choice(sectors)
            lat, lon = jitter_coords(rng)

            days_ago = rng.randint(0, 59)
            minutes = rng.randint(0, 24 * 60 - 1)
            fecha_hora = now - timedelta(days=days_ago, minutes=minutes)
            if timezone.is_naive(fecha_hora):
                fecha_hora = timezone.make_aware(fecha_hora)

            estado = self._pick_estado(rng)
            delito = self._resolve_delito(category, rng)
            lugar = f"{fake.street_address()}, {CIUDAD}"
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
            numero = f"{NUMERO_PREFIX}-{year}-{seq:04d}"
            while ParteAprehension.objects.filter(numero_caso=numero).exists():
                seq += 1000
                numero = f"{NUMERO_PREFIX}-{year}-{seq:04d}"

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
            else:
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

            meta_up = uploaded_meta[img.name]
            MultimediaEvidencia.objects.create(
                subido_por=agente,
                origen=MultimediaEvidencia.Origen.PARTE,
                parte=parte,
                descripcion=f"Evidencia [{category}] · {img.name} · {JUR_NOMBRE}",
                nombre_archivo=meta_up["nombre_archivo"],
                content_type=meta_up["content_type"],
                tamanio_bytes=meta_up["tamanio_bytes"],
                bucket=meta_up["bucket"],
                object_key=meta_up["object_key"],
            )

            counts[estado] = counts.get(estado, 0) + 1
            if estado == ParteAprehension.EstadoRevision.APROBADO:
                approved_ids.append(parte.id)

            created += 1
            if created % 25 == 0:
                self.stdout.write(f"  … {created}/{n_partes} partes en {JUR_NOMBRE}")

        return created, approved_ids, upload_ok, counts

    def _upload_parquet_batch(self, parte_ids: list[int]) -> int:
        ok = 0
        bucket = getattr(settings, "MINIO_BUCKET_OPERATIVO", None)
        qs = (
            ParteAprehension.objects.filter(id__in=parte_ids)
            .select_related("tipo_delito", "creado_por")
            .iterator(chunk_size=50)
        )
        for parte in qs:
            try:
                payload = build_parquet_bytes(parte)
                filename = f"{parte.numero_caso or f'parte-{parte.id}'}.parquet"
                kwargs = {
                    "file_bytes": payload,
                    "filename": filename,
                    "content_type": "application/vnd.apache.parquet",
                    "folder": "partes",
                }
                if bucket:
                    kwargs["bucket"] = bucket
                upload_evidencia(**kwargs)
                ok += 1
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(
                    self.style.WARNING(f"Parquet falló {parte.numero_caso}: {exc}")
                )
        return ok
