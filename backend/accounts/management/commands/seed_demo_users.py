from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from accounts.models import SystemRole, UserProfile
from organizacion.models import Jurisdiction, JurisdictionType


def resolve_demo_zona():
    """
    Usa una zona oficial (ZN-09 Quito) si existe.
    No crea zonas ficticias: Ecuador solo tiene ZN-01 … ZN-09.
    """
    zona = (
        Jurisdiction.objects.filter(
            tipo=JurisdictionType.ZONA,
            codigo="ZN-09",
            activo=True,
        ).first()
        or Jurisdiction.objects.filter(
            tipo=JurisdictionType.ZONA,
            codigo__in=[f"ZN-{i:02d}" for i in range(1, 10)],
            activo=True,
        )
        .order_by("codigo")
        .first()
    )
    return zona


# Compat: imports antiguos / scripts que aún llamen ensure_zona_norte_scope
def ensure_zona_norte_scope():
    return resolve_demo_zona()


DEMO_USERS = [
    {
        "username": "admin.ti",
        "email": "admin@sgp.gob",
        "password": "Admin123!",
        "first_name": "Ana",
        "last_name": "Técnica",
        "role": SystemRole.ADMIN_SISTEMA,
        "rango_tipico": "Ingeniería de Software / TI",
        "unidad": "Dirección de Sistemas",
    },
    {
        "username": "alto.mando",
        "email": "ejecutivo@sgp.gob",
        "password": "Ejecutivo123!",
        "first_name": "Carlos",
        "last_name": "General",
        "role": SystemRole.VISOR_EJECUTIVO,
        "rango_tipico": "Comandante General / Generales",
        "unidad": "Alto Mando",
    },
    {
        "username": "jefe.zona",
        "email": "director@sgp.gob",
        "password": "Director123!",
        "first_name": "María",
        "last_name": "Coronel",
        "role": SystemRole.DIRECTOR_ZONA,
        "rango_tipico": "Coroneles / Mayores",
        "unidad": "Jefatura de Zona",
    },
    {
        "username": "sup.unidad",
        "email": "supervisor@sgp.gob",
        "password": "Supervisor123!",
        "first_name": "Luis",
        "last_name": "Capitán",
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "rango_tipico": "Capitanes / Tenientes",
        "unidad": "Unidad 12",
    },
    {
        "username": "det.judicial",
        "email": "detective@sgp.gob",
        "password": "Detective123!",
        "first_name": "Elena",
        "last_name": "Investigadora",
        "role": SystemRole.DETECTIVE,
        "rango_tipico": "Policía Judicial / Antinarcóticos",
        "unidad": "Investigaciones",
    },
    {
        "username": "fiscal.turno",
        "email": "fiscal@sgp.gob",
        "password": "Fiscal123!",
        "first_name": "Andrea",
        "last_name": "Fiscal",
        "role": SystemRole.FISCAL,
        "rango_tipico": "Fiscal de Turno / Ministerio Público",
        "unidad": "Fiscalía de Turno",
    },
    {
        "username": "agente.urbano",
        "email": "agente@sgp.gob",
        "password": "Agente123!",
        "first_name": "Pedro",
        "last_name": "Cabo",
        "role": SystemRole.AGENTE_OPERATIVO,
        "rango_tipico": "Sargentos / Cabos / Policías",
        "unidad": "Servicio Urbano",
    },
]


class Command(BaseCommand):
    help = "Crea usuarios demo (uno por rol de acceso)"

    def handle(self, *args, **options):
        zona = resolve_demo_zona()
        if zona:
            self.stdout.write(
                f"Zona demo oficial: {zona.codigo} — {zona.nombre}"
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "No hay zonas oficiales activas; usuarios operativos quedan sin zona."
                )
            )

        for item in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=item["username"],
                defaults={
                    "email": item["email"],
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "is_staff": item["role"] == SystemRole.ADMIN_SISTEMA,
                },
            )
            user.email = item["email"]
            user.first_name = item["first_name"]
            user.last_name = item["last_name"]
            user.set_password(item["password"])
            user.save()

            defaults = {
                "role": item["role"],
                "rango_tipico": item.get("rango_tipico", ""),
                "unidad": item.get("unidad", ""),
                "zona": "",
                "jurisdiccion": None,
            }
            # Roles territoriales: asignar a zona oficial si existe
            if zona and item["role"] in {
                SystemRole.DIRECTOR_ZONA,
                SystemRole.SUPERVISOR_UNIDAD,
                SystemRole.AGENTE_OPERATIVO,
                SystemRole.DETECTIVE,
                SystemRole.FISCAL,
            }:
                defaults["jurisdiccion"] = zona
                defaults["zona"] = zona.nombre

            UserProfile.objects.update_or_create(
                user=user,
                defaults=defaults,
            )
            state = "creado" if created else "actualizado"
            self.stdout.write(
                self.style.SUCCESS(f"{state}: {item['email']} → {item['role']}")
            )
