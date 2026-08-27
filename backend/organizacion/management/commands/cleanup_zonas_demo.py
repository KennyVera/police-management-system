"""Elimina (inactiva) zonas demo/ficticias y libera usuarios asociados.

Uso:
  python manage.py cleanup_zonas_demo
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db.models import Q

from accounts.models import SystemRole, UserProfile
from organizacion.models import Jurisdiction, JurisdictionType
from tactico.services.geo_scope import _collect_descendant_ids

# Zonas que no forman parte de las 9 oficiales (ZN-01 … ZN-09).
TARGET_CODIGOS = ("Z-628474", "ZN-NORTE", "ZN-001")
TARGET_NOMBRES = ("Zona A", "Zona Norte", "ZonaPrueba")


class Command(BaseCommand):
    help = "Inactiva Zona A / Zona Norte / ZonaPrueba y deja sus usuarios sin zona."

    def handle(self, *args, **options):
        qs = Jurisdiction.objects.filter(
            Q(codigo__in=TARGET_CODIGOS) | Q(nombre__in=TARGET_NOMBRES),
            tipo=JurisdictionType.ZONA,
        )
        if not qs.exists():
            self.stdout.write(self.style.WARNING("No se encontraron zonas demo a limpiar."))
            return

        total_liberados = 0
        for zona in qs:
            tree_ids = _collect_descendant_ids(zona)
            labels = list(
                Jurisdiction.objects.filter(id__in=tree_ids).values_list(
                    "nombre", "codigo"
                )
            )
            label_vals = {
                (n or "").strip()
                for n, c in labels
                for n in (n, c)
                if (n or "").strip()
            }
            # También textos legacy usados en perfiles demo
            label_vals.update({"Zona Norte", "Sector 12", "ZN-NORTE", "ZN-001", "Z-628474"})

            profiles = UserProfile.objects.filter(
                Q(jurisdiccion_id__in=tree_ids) | Q(zona__in=label_vals)
            ).exclude(
                role__in=[SystemRole.ADMIN_SISTEMA, SystemRole.SUPERADMIN_SAAS]
            )
            n = profiles.update(jurisdiccion=None, zona="", departamento=None)
            total_liberados += n

            # Inactivar zona + descendientes (subzonas/distritos demo)
            inactivated = Jurisdiction.objects.filter(id__in=tree_ids, activo=True).update(
                activo=False
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"«{zona.nombre}» ({zona.codigo}): "
                    f"{n} usuario(s) liberados, {inactivated} nodo(s) inactivados."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Listo. Usuarios liberados en total: {total_liberados}."
            )
        )
