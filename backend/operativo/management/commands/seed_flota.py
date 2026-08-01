from django.core.management.base import BaseCommand

from operativo.models import VehiculoFlota


class Command(BaseCommand):
    help = "Siembra vehículos de flota demo"

    def handle(self, *args, **options):
        demos = [
            ("PBA-4521", VehiculoFlota.TipoVehiculo.CAMIONETA, "Toyota Hilux"),
            ("PBA-7788", VehiculoFlota.TipoVehiculo.CAMIONETA, "Chevrolet D-Max"),
            ("MTO-102", VehiculoFlota.TipoVehiculo.MOTO, "Yamaha XTZ"),
            ("MTO-215", VehiculoFlota.TipoVehiculo.MOTO, "Suzuki DR"),
            ("SED-110", VehiculoFlota.TipoVehiculo.AUTOMOVIL, "Patrullero sedán"),
            ("BLD-01", VehiculoFlota.TipoVehiculo.BLINDADO, "Unidad táctica"),
        ]
        for placa, tipo, desc in demos:
            VehiculoFlota.objects.get_or_create(
                placa=placa,
                defaults={"tipo": tipo, "descripcion": desc, "activo": True},
            )
        self.stdout.write(self.style.SUCCESS("Vehículos de flota listos."))
