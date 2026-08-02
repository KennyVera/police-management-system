from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from accounts.models import SystemRole, UserProfile
from organizacion.models import Jurisdiction, JurisdictionType


def ensure_zona_norte_scope():
    """Árbol mínimo alineado con sector_zona del fact en ClickHouse (Sector 12)."""
    zona, _ = Jurisdiction.objects.get_or_create(
        codigo="ZN-NORTE",
        defaults={
            "tipo": JurisdictionType.ZONA,
            "nombre": "Zona Norte",
            "activo": True,
        },
    )
    if zona.nombre != "Zona Norte":
        zona.nombre = "Zona Norte"
        zona.tipo = JurisdictionType.ZONA
        zona.activo = True
        zona.save(update_fields=["nombre", "tipo", "activo", "actualizado_en"])

    sector, _ = Jurisdiction.objects.get_or_create(
        codigo="SEC-12",
        defaults={
            "tipo": JurisdictionType.DISTRITO,
            "nombre": "Sector 12",
            "parent": zona,
            "activo": True,
        },
    )
    changed = False
    if sector.parent_id != zona.id:
        sector.parent = zona
        changed = True
    if sector.nombre != "Sector 12":
        sector.nombre = "Sector 12"
        changed = True
    if not sector.activo:
        sector.activo = True
        changed = True
    if changed:
        sector.save()
    return zona


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
        "zona": "Zona Norte",
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
        zona_norte = ensure_zona_norte_scope()
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
                "zona": item.get("zona", ""),
            }
            if item["role"] == SystemRole.DIRECTOR_ZONA:
                defaults["jurisdiccion"] = zona_norte
            if item["role"] == SystemRole.SUPERVISOR_UNIDAD:
                defaults["jurisdiccion"] = zona_norte
                defaults["zona"] = "Zona Norte"
            if item["role"] == SystemRole.AGENTE_OPERATIVO:
                defaults["jurisdiccion"] = zona_norte
                defaults["zona"] = "Sector 12"
            if item["role"] == SystemRole.DETECTIVE:
                defaults["jurisdiccion"] = zona_norte
                defaults["zona"] = "Zona Norte"

            UserProfile.objects.update_or_create(
                user=user,
                defaults=defaults,
            )
            state = "creado" if created else "actualizado"
            self.stdout.write(self.style.SUCCESS(f"{state}: {item['email']} → {item['role']}"))
