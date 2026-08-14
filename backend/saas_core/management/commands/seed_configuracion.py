"""Seed configuración global singleton."""

from django.core.management.base import BaseCommand

from saas_core.models import ConfiguracionPlataforma


class Command(BaseCommand):
    help = "Crea/actualiza la fila singleton de Configuración global"

    def handle(self, *args, **options):
        cfg = ConfiguracionPlataforma.get_solo()
        if not cfg.correo_remitente:
            cfg.correo_remitente = "crimetracksoporte@gmail.com"
            cfg.save(update_fields=["correo_remitente"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Config OK · {cfg.nombre_sistema} · remitente {cfg.correo_remitente}"
            )
        )
