from datetime import time, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import SystemRole, UserProfile
from operativo.models import AlertaDespacho, AsignacionDiaria
from organizacion.models import Jurisdiction, JurisdictionType


class Command(BaseCommand):
    help = "Crea asignación diaria y alertas demo para el agente operativo"

    def handle(self, *args, **options):
        agente = User.objects.filter(email="agente@sgp.gob").first()
        if not agente:
            self.stdout.write(self.style.WARNING("No existe agente@sgp.gob — omite seed."))
            return

        supervisor = User.objects.filter(email="supervisor@sgp.gob").first()
        companero, _ = User.objects.get_or_create(
            username="agente.companero",
            defaults={
                "email": "companero@sgp.gob",
                "first_name": "Luis",
                "last_name": "Sargento",
            },
        )
        profile, created_prof = UserProfile.objects.get_or_create(
            user=companero,
            defaults={
                "role": SystemRole.AGENTE_OPERATIVO,
                "placa": "P-8842",
                "rango_policial": "Cabo",
                "cedula": "1799988801",
                "unidad": "Servicio Urbano",
            },
        )
        if not created_prof and profile.role != SystemRole.AGENTE_OPERATIVO:
            profile.role = SystemRole.AGENTE_OPERATIVO
            profile.placa = profile.placa or "P-8842"
            profile.rango_policial = profile.rango_policial or "Cabo"
            profile.save()

        zona = (
            Jurisdiction.objects.filter(activo=True).order_by("id").first()
            or Jurisdiction.objects.create(
                tipo=JurisdictionType.CIRCUITO,
                nombre="Circuito Centro Urbano",
                codigo="CIR-DEMO-01",
            )
        )

        hoy = timezone.localdate()
        # Unidad móvil cerca de Av. 10 de Agosto / Colón (Quito)
        agent_lat = Decimal("-0.1806532")
        agent_lng = Decimal("-78.4678382")

        asig, created = AsignacionDiaria.objects.update_or_create(
            agente=agente,
            fecha=hoy,
            defaults={
                "companero": companero,
                "supervisor": supervisor,
                "vehiculo_placa": "PBA-4521",
                "vehiculo_tipo": "Patrulla Toyota Hilux",
                "zona": zona,
                "cuadrante": "Cuadrante C-12 · Av. 10 de Agosto",
                "turno_inicio": time(7, 0),
                "turno_fin": time(19, 0),
                "unidad_label": "Unidad Móvil 23",
                "latitud": agent_lat,
                "longitud": agent_lng,
                "observaciones": "Patrullaje preventivo y respuesta a despachos ECU-911.",
                "activo": True,
            },
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"{'creada' if created else 'actualizada'} asignación del {hoy} para {agente.email}"
            )
        )

        demos = [
            {
                "titulo": "Robo en proceso",
                "descripcion": "Ciudadano reporta asalto a mano armada. Sospechoso huye a pie.",
                "direccion": "Av. América y Gaspar de Villarroel",
                "referencia": "Frente a farmacia Cruz Azul",
                "prioridad": AlertaDespacho.Prioridad.ALTA,
                "estado": AlertaDespacho.Estado.ASIGNADA,
                "latitud": Decimal("-0.1762100"),
                "longitud": Decimal("-78.4849200"),
            },
            {
                "titulo": "Riña callejera",
                "descripcion": "Altercado entre dos personas. Requiere presencia policial.",
                "direccion": "Parque La Carolina, ingreso norte",
                "referencia": "Cancha de vóley",
                "prioridad": AlertaDespacho.Prioridad.MEDIA,
                "estado": AlertaDespacho.Estado.ASIGNADA,
                "latitud": Decimal("-0.1864500"),
                "longitud": Decimal("-78.4842100"),
            },
            {
                "titulo": "Auxilio médico",
                "descripcion": "Persona inconsciente en la vía. Coordinar con ambulancia.",
                "direccion": "Av. 6 de Diciembre y Colón",
                "referencia": "Esquina noreste",
                "prioridad": AlertaDespacho.Prioridad.BAJA,
                "estado": AlertaDespacho.Estado.EN_CAMINO,
                "latitud": Decimal("-0.1789000"),
                "longitud": Decimal("-78.4791000"),
            },
        ]

        activos = AlertaDespacho.objects.filter(
            agente=agente,
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ],
        )

        if not activos.exists():
            now = timezone.now()
            for i, item in enumerate(demos):
                AlertaDespacho.objects.create(
                    agente=agente,
                    asignada_por=supervisor,
                    origen="ECU-911",
                    en_camino_en=(
                        now - timedelta(minutes=2)
                        if item["estado"] == AlertaDespacho.Estado.EN_CAMINO
                        else None
                    ),
                    **item,
                )
            self.stdout.write(self.style.SUCCESS(f"Creadas {len(demos)} alertas demo."))
        else:
            # Actualiza coordenadas en alertas existentes sin lat/lng
            for alerta, demo in zip(activos.order_by("id")[:3], demos):
                if alerta.latitud is None or alerta.longitud is None:
                    alerta.latitud = demo["latitud"]
                    alerta.longitud = demo["longitud"]
                    alerta.direccion = demo["direccion"]
                    alerta.save(update_fields=["latitud", "longitud", "direccion", "actualizado_en"])
            self.stdout.write(f"Ya hay {activos.count()} alertas activas; coords sincronizadas.")
