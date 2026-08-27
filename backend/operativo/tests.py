"""
Plan de Pruebas Automatizadas — CrimeTrack / operativo
======================================================

Escenarios cubiertos
--------------------
1. Roles y permisos: un Agente Operativo no puede consultar el dashboard
   del Visor Ejecutivo (EjecutivoOnly → 403).
2. Data scoping: el Supervisor de Zona A solo ve partes EN_REVISION
   redactados por agentes de su zona (partes_en_zona_qs).
3. Flujo operativo: Supervisor crea escuadra, asigna vehículo de flota
   y el agente redacta un parte vinculado a una alerta EN_LUGAR.

Datos de prueba: Faker (ya en requirements). Django crea una BD de test
aparte; no toca la de desarrollo.
"""

from __future__ import annotations

from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from faker import Faker
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from accounts.models import AccountStatus, SystemRole, UserProfile
from operativo.models import AlertaDespacho, Escuadra, ParteAprehension, VehiculoFlota
from organizacion.models import Jurisdiction, JurisdictionType
from roles.supervisor_unidad.scope import parte_en_zona_or_404, partes_en_zona_qs
from saas_core.models import Institucion

# Faker no incluye es_EC; es_ES cubre nombres/direcciones en español.
fake = Faker("es_ES")


def _unique_digits(n: int = 10) -> str:
    return fake.unique.numerify("#" * n)


def make_institucion() -> Institucion:
    return Institucion.objects.create(
        nombre_comercial=fake.company(),
        ruc=_unique_digits(13),
        direccion=fake.address()[:255],
    )


def make_zona(nombre: str) -> Jurisdiction:
    return Jurisdiction.objects.create(
        tipo=JurisdictionType.ZONA,
        nombre=nombre,
        codigo=f"Z-{_unique_digits(6)}",
    )


def make_user(
    *,
    role: str,
    institucion: Institucion,
    jurisdiccion: Jurisdiction | None = None,
    zona: str = "",
) -> User:
    user = User.objects.create_user(
        username=fake.unique.user_name(),
        password="TestPass123!",
        first_name=fake.first_name(),
        last_name=fake.last_name(),
        email=fake.unique.email(),
    )
    UserProfile.objects.create(
        user=user,
        role=role,
        cedula=_unique_digits(10),
        placa=fake.bothify("PN-####"),
        zona=zona or (jurisdiccion.nombre if jurisdiccion else ""),
        estado=AccountStatus.ACTIVO,
        jurisdiccion=jurisdiccion,
        institucion=institucion,
    )
    return user


def auth_client(user: User) -> APIClient:
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


def make_parte(
    *,
    agente: User,
    institucion: Institucion,
    estado: str = ParteAprehension.EstadoRevision.EN_REVISION,
    lugar: str = "",
) -> ParteAprehension:
    ahora = timezone.now()
    return ParteAprehension.objects.create(
        creado_por=agente,
        institucion=institucion,
        estado_revision=estado,
        enviado_revision_en=ahora if estado == ParteAprehension.EstadoRevision.EN_REVISION else None,
        fecha_hora=ahora,
        fecha_hecho=ahora.date(),
        hora_hecho=ahora.time().replace(microsecond=0),
        lugar=lugar or fake.street_address(),
        sector_zona=agente.profile.zona,
        titulo=fake.sentence(nb_words=4),
        descripcion=fake.paragraph(),
        relato_hechos=fake.paragraph(),
    )


class RolesPermisosTests(TestCase):
    """1. Un agente operativo no accede a vistas del Visor Ejecutivo."""

    def setUp(self):
        self.institucion = make_institucion()
        self.agente = make_user(
            role=SystemRole.AGENTE_OPERATIVO,
            institucion=self.institucion,
            zona="Zona A",
        )
        self.visor = make_user(
            role=SystemRole.VISOR_EJECUTIVO,
            institucion=self.institucion,
        )
        self.url_dashboard = reverse("visor_ejecutivo-dashboard-home")
        self.url_indicadores = reverse("visor_ejecutivo-indicadores-home")
        self.url_reportes = reverse("visor_ejecutivo-reportes_estrategicos-home")

    def test_agente_no_accede_al_dashboard_del_visor_ejecutivo(self):
        client = auth_client(self.agente)
        response = client.get(self.url_dashboard)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_agente_no_accede_a_indicadores_ni_reportes_del_visor(self):
        client = auth_client(self.agente)
        self.assertEqual(client.get(self.url_indicadores).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(client.get(self.url_reportes).status_code, status.HTTP_403_FORBIDDEN)

    def test_visor_ejecutivo_si_accede_a_su_dashboard(self):
        client = auth_client(self.visor)
        response = client.get(self.url_dashboard)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class DataScopingTests(TestCase):
    """2. El supervisor de Zona A no ve partes de agentes de Zona B."""

    def setUp(self):
        self.institucion = make_institucion()
        self.zona_a = make_zona("Zona A")
        self.zona_b = make_zona("Zona B")

        self.supervisor_a = make_user(
            role=SystemRole.SUPERVISOR_UNIDAD,
            institucion=self.institucion,
            jurisdiccion=self.zona_a,
            zona=self.zona_a.nombre,
        )
        self.agente_a = make_user(
            role=SystemRole.AGENTE_OPERATIVO,
            institucion=self.institucion,
            jurisdiccion=self.zona_a,
            zona=self.zona_a.nombre,
        )
        self.agente_b = make_user(
            role=SystemRole.AGENTE_OPERATIVO,
            institucion=self.institucion,
            jurisdiccion=self.zona_b,
            zona=self.zona_b.nombre,
        )

        self.parte_a = make_parte(
            agente=self.agente_a,
            institucion=self.institucion,
            lugar="Sector Zona A",
        )
        self.parte_b = make_parte(
            agente=self.agente_b,
            institucion=self.institucion,
            lugar="Sector Zona B",
        )
        self.url_pendientes = reverse("sup-partes-pendientes")

    def test_queryset_de_zona_solo_incluye_partes_del_agente_local(self):
        ids = set(partes_en_zona_qs(self.supervisor_a).values_list("id", flat=True))
        self.assertIn(self.parte_a.id, ids)
        self.assertNotIn(self.parte_b.id, ids)

    def test_parte_de_otra_zona_no_es_accesible_por_id(self):
        self.assertIsNotNone(parte_en_zona_or_404(self.supervisor_a, self.parte_a.id))
        self.assertIsNone(parte_en_zona_or_404(self.supervisor_a, self.parte_b.id))

    def test_api_pendientes_solo_devuelve_partes_de_zona_a(self):
        client = auth_client(self.supervisor_a)
        response = client.get(self.url_pendientes)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data["results"]}
        self.assertEqual(response.data["count"], 1)
        self.assertIn(self.parte_a.id, ids)
        self.assertNotIn(self.parte_b.id, ids)


class FlujoOperativoTests(TestCase):
    """3. Escuadra → vehículo operativo → redacción de parte policial."""

    def setUp(self):
        self.institucion = make_institucion()
        self.zona = make_zona("Zona A")
        self.supervisor = make_user(
            role=SystemRole.SUPERVISOR_UNIDAD,
            institucion=self.institucion,
            jurisdiccion=self.zona,
            zona=self.zona.nombre,
        )
        self.agente = make_user(
            role=SystemRole.AGENTE_OPERATIVO,
            institucion=self.institucion,
            jurisdiccion=self.zona,
            zona=self.zona.nombre,
        )
        self.sup_client = auth_client(self.supervisor)
        self.agente_client = auth_client(self.agente)

    def test_crear_escuadra_asignar_vehiculo_y_redactar_parte(self):
        hoy = date.today()

        veh_resp = self.sup_client.post(
            reverse("sup-vehiculos"),
            {
                "placa": fake.unique.bothify("PBA-####").upper(),
                "tipo": VehiculoFlota.TipoVehiculo.AUTOMOVIL,
                "descripcion": "Unidad de patrullaje de prueba",
                "activo": True,
            },
            format="json",
        )
        self.assertEqual(veh_resp.status_code, status.HTTP_201_CREATED)
        vehiculo_id = veh_resp.data["id"]

        esc_resp = self.sup_client.post(
            reverse("sup-escuadras"),
            {
                "nombre": f"Escuadra {fake.word().title()}",
                "fecha": hoy.isoformat(),
                "agente_lider": self.agente.id,
                "observaciones": "Turno de prueba QA",
            },
            format="json",
        )
        self.assertEqual(esc_resp.status_code, status.HTTP_201_CREATED)
        escuadra_id = esc_resp.data["id"]
        self.assertEqual(esc_resp.data["agente_lider"], self.agente.id)

        asig_resp = self.sup_client.post(
            reverse("sup-escuadra-asignar-vehiculo", kwargs={"pk": escuadra_id}),
            {"vehiculo": vehiculo_id, "cuadrante": "Cuadrante QA-1"},
            format="json",
        )
        self.assertEqual(asig_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(asig_resp.data["vehiculo"], vehiculo_id)
        escuadra = Escuadra.objects.get(pk=escuadra_id)
        self.assertEqual(escuadra.vehiculo_id, vehiculo_id)

        alerta = AlertaDespacho.objects.create(
            agente=self.agente,
            escuadra=escuadra,
            asignada_por=self.supervisor,
            titulo="Auxilio de prueba QA",
            descripcion=fake.sentence(),
            direccion=fake.street_address(),
            estado=AlertaDespacho.Estado.EN_LUGAR,
            llegada_en=timezone.now(),
        )

        parte_resp = self.agente_client.post(
            reverse("agente-partes"),
            {
                "alerta": alerta.id,
                "lugar": alerta.direccion,
                "titulo": "Parte policial de prueba",
                "fecha_hecho": hoy.isoformat(),
                "hora_hecho": time(10, 30).isoformat(),
                "descripcion": fake.paragraph(),
                "detenido_nombres": fake.first_name(),
                "detenido_apellidos": fake.last_name(),
                "detenido_cedula": _unique_digits(10),
            },
            format="json",
        )
        self.assertEqual(parte_resp.status_code, status.HTTP_201_CREATED)
        parte = ParteAprehension.objects.get(pk=parte_resp.data["id"])
        self.assertEqual(parte.creado_por_id, self.agente.id)
        self.assertEqual(parte.alerta_id, alerta.id)
        self.assertEqual(parte.estado_revision, ParteAprehension.EstadoRevision.BORRADOR)
        self.assertTrue(parte.lugar)
