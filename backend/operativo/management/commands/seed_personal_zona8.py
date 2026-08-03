"""Personal demo para el Jefe de Zona Chelo (Zona 8 - Guayaquil)."""

from __future__ import annotations

from datetime import time
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import SystemRole, UserProfile
from operativo.models import AsignacionDiaria, EvaluacionSupervisor, GestionHorario
from organizacion.models import Jurisdiction


PASSWORD = "admin123"

# Efectivos de Zona 8: jurisdicción hija (distrito) + zona textual alineada al scope.
PERSONAL = [
    # Supervisores
    {
        "username": "sup.gye.d01",
        "email": "SupervisorGyeD01@gmail.com",
        "first_name": "Rocío",
        "last_name": "Mera",
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "Distrito 1 · Guayaquil",
        "rango": "Capitán",
        "placa": "SUP-G8-01",
        "cedula": "0900100101",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "sup.gye.d03",
        "email": "SupervisorGyeD03@gmail.com",
        "first_name": "Héctor",
        "last_name": "Paredes",
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "distrito_codigo": "ZN-08-GYE-D03",
        "unidad": "Distrito 3 · Guayaquil",
        "rango": "Teniente",
        "placa": "SUP-G8-03",
        "cedula": "0900100102",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "sup.gye.d05",
        "email": "SupervisorGyeD05@gmail.com",
        "first_name": "Marlene",
        "last_name": "Cedeño",
        "role": SystemRole.SUPERVISOR_UNIDAD,
        "distrito_codigo": "ZN-08-GYE-D05",
        "unidad": "Distrito 5 · Guayaquil",
        "rango": "Capitán",
        "placa": "SUP-G8-05",
        "cedula": "0900100103",
        "estado_dia": "FRANCO",
    },
    # Detectives
    {
        "username": "det.gye.01",
        "email": "DetectiveGye01@gmail.com",
        "first_name": "Iván",
        "last_name": "Salazar",
        "role": SystemRole.DETECTIVE,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "PJ Distrito 1",
        "rango": "Detective",
        "placa": "DET-G8-01",
        "cedula": "0900100201",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "det.gye.02",
        "email": "DetectiveGye02@gmail.com",
        "first_name": "Paola",
        "last_name": "Vera",
        "role": SystemRole.DETECTIVE,
        "distrito_codigo": "ZN-08-GYE-D03",
        "unidad": "Antinarcóticos Z8",
        "rango": "Investigadora",
        "placa": "DET-G8-02",
        "cedula": "0900100202",
        "estado_dia": "VACACIONES",
    },
    # Agentes
    {
        "username": "age.gye.01",
        "email": "AgenteGye01@gmail.com",
        "first_name": "Kevin",
        "last_name": "Zambrano",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "Servicio Urbano D1",
        "rango": "Cabo",
        "placa": "P-G801",
        "cedula": "0900100301",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "age.gye.02",
        "email": "AgenteGye02@gmail.com",
        "first_name": "Diana",
        "last_name": "Ortega",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "Servicio Urbano D1",
        "rango": "Policía",
        "placa": "P-G802",
        "cedula": "0900100302",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "age.gye.03",
        "email": "AgenteGye03@gmail.com",
        "first_name": "José",
        "last_name": "Anchundia",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D03",
        "unidad": "Servicio Urbano D3",
        "rango": "Sargento",
        "placa": "P-G803",
        "cedula": "0900100303",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "age.gye.04",
        "email": "AgenteGye04@gmail.com",
        "first_name": "Carla",
        "last_name": "Mendoza",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D03",
        "unidad": "Motorizados D3",
        "rango": "Cabo",
        "placa": "P-G804",
        "cedula": "0900100304",
        "estado_dia": "CALAMIDAD",
    },
    {
        "username": "age.gye.05",
        "email": "AgenteGye05@gmail.com",
        "first_name": "Luis",
        "last_name": "Quimi",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D05",
        "unidad": "Servicio Urbano D5",
        "rango": "Policía",
        "placa": "P-G805",
        "cedula": "0900100305",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "age.gye.06",
        "email": "AgenteGye06@gmail.com",
        "first_name": "Andrea",
        "last_name": "Chávez",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D05",
        "unidad": "Servicio Urbano D5",
        "rango": "Policía",
        "placa": "P-G806",
        "cedula": "0900100306",
        "estado_dia": "ARRESTO",
    },
    {
        "username": "age.gye.07",
        "email": "AgenteGye07@gmail.com",
        "first_name": "Miguel",
        "last_name": "Baque",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "Servicio Urbano D1",
        "rango": "Cabo",
        "placa": "P-G807",
        "cedula": "0900100307",
        "estado_dia": "FRANCO",
    },
    {
        "username": "age.gye.08",
        "email": "AgenteGye08@gmail.com",
        "first_name": "Sofía",
        "last_name": "Palacios",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D03",
        "unidad": "Servicio Urbano D3",
        "rango": "Policía",
        "placa": "P-G808",
        "cedula": "0900100308",
        "estado_dia": "PERMISO",
    },
    {
        "username": "age.gye.09",
        "email": "AgenteGye09@gmail.com",
        "first_name": "Esteban",
        "last_name": "García",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D05",
        "unidad": "Motorizados D5",
        "rango": "Sargento",
        "placa": "P-G809",
        "cedula": "0900100309",
        "estado_dia": "ACTIVO",
    },
    {
        "username": "age.gye.10",
        "email": "AgenteGye10@gmail.com",
        "first_name": "Natalia",
        "last_name": "Rivas",
        "role": SystemRole.AGENTE_OPERATIVO,
        "distrito_codigo": "ZN-08-GYE-D01",
        "unidad": "Servicio Urbano D1",
        "rango": "Policía",
        "placa": "P-G810",
        "cedula": "0900100310",
        "estado_dia": "VACACIONES",
    },
]

# Coords aproximadas Guayaquil por distrito
COORDS = {
    "ZN-08-GYE-D01": (Decimal("-2.1709980"), Decimal("-79.9223590")),
    "ZN-08-GYE-D03": (Decimal("-2.1892000"), Decimal("-79.8894000")),
    "ZN-08-GYE-D05": (Decimal("-2.1405000"), Decimal("-79.9078000")),
}


class Command(BaseCommand):
    help = "Siembra personal operativo en Zona 8 (Chelo Flor) con estados del día"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-gestiones",
            action="store_true",
            help="Borra gestiones de horario del día de estos agentes antes de recrearlas",
        )

    def handle(self, *args, **options):
        hoy = timezone.localdate()
        distritos = {
            j.codigo: j
            for j in Jurisdiction.objects.filter(
                codigo__in=["ZN-08-GYE-D01", "ZN-08-GYE-D03", "ZN-08-GYE-D05"]
            )
        }
        if len(distritos) < 3:
            self.stdout.write(
                self.style.ERROR(
                    "Faltan distritos ZN-08-GYE-D0x. Ejecute seed_db / seed jurisdicciones."
                )
            )
            return

        jefe = (
            User.objects.filter(email__iexact="JefeZonaChelo@gmail.com").first()
            or User.objects.filter(profile__role=SystemRole.DIRECTOR_ZONA)
            .filter(profile__zona__icontains="Zona 8")
            .first()
        )
        users_by_email = {}
        created_n = 0

        for item in PERSONAL:
            dist = distritos[item["distrito_codigo"]]
            user, created = User.objects.get_or_create(
                username=item["username"],
                defaults={
                    "email": item["email"],
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                },
            )
            user.email = item["email"]
            user.first_name = item["first_name"]
            user.last_name = item["last_name"]
            user.set_password(PASSWORD)
            user.save()
            if created:
                created_n += 1

            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    "role": item["role"],
                    "cedula": item["cedula"],
                },
            )
            profile.role = item["role"]
            profile.cedula = item["cedula"]
            profile.placa = item["placa"]
            profile.rango_policial = item["rango"]
            profile.unidad = item["unidad"]
            profile.zona = dist.nombre
            profile.jurisdiccion = dist
            profile.save()
            users_by_email[item["email"]] = (user, item)

        self.stdout.write(
            self.style.SUCCESS(
                f"Usuarios Zona 8: {len(PERSONAL)} ({created_n} nuevos). Pass: {PASSWORD}"
            )
        )

        if options["reset_gestiones"]:
            ids = [u.id for u, _ in users_by_email.values()]
            GestionHorario.objects.filter(fecha=hoy, agente_id__in=ids).delete()

        # Supervisor de referencia para gestiones / asignaciones
        sup_ref = users_by_email["SupervisorGyeD01@gmail.com"][0]

        for email, (user, item) in users_by_email.items():
            estado = item["estado_dia"]
            dist = distritos[item["distrito_codigo"]]
            lat, lng = COORDS[item["distrito_codigo"]]

            # Limpiar gestiones del día para este agente (idempotente)
            GestionHorario.objects.filter(fecha=hoy, agente=user).delete()
            AsignacionDiaria.objects.filter(fecha=hoy, agente=user).delete()

            if estado == "ACTIVO":
                AsignacionDiaria.objects.create(
                    agente=user,
                    fecha=hoy,
                    supervisor=sup_ref if user.id != sup_ref.id else jefe,
                    vehiculo_placa=f"GYE-{item['placa'][-3:]}",
                    vehiculo_tipo="Patrulla",
                    zona=dist,
                    cuadrante=f"{dist.nombre} · Sector A",
                    sector_detalle=f"Ruta preventiva {item['unidad']}",
                    turno_inicio=time(7, 0),
                    turno_fin=time(19, 0),
                    unidad_label=f"Unidad {item['placa']}",
                    latitud=lat,
                    longitud=lng,
                    activo=True,
                    observaciones="Turno operativo Zona 8",
                )
            elif estado == "FRANCO":
                GestionHorario.objects.create(
                    agente=user,
                    supervisor=sup_ref,
                    fecha=hoy,
                    tipo=GestionHorario.Tipo.AUSENCIA,
                    detalle="Franco programado",
                    estado=GestionHorario.Estado.APROBADO,
                )
            elif estado == "VACACIONES":
                GestionHorario.objects.create(
                    agente=user,
                    supervisor=sup_ref,
                    fecha=hoy,
                    tipo=GestionHorario.Tipo.OTRO,
                    detalle="Vacaciones anuales autorizadas",
                    estado=GestionHorario.Estado.APROBADO,
                )
            elif estado == "CALAMIDAD":
                GestionHorario.objects.create(
                    agente=user,
                    supervisor=sup_ref,
                    fecha=hoy,
                    tipo=GestionHorario.Tipo.PERMISO_MEDICO,
                    detalle="Calamidad doméstica — permiso aprobado",
                    estado=GestionHorario.Estado.APROBADO,
                )
            elif estado == "ARRESTO":
                GestionHorario.objects.create(
                    agente=user,
                    supervisor=sup_ref,
                    fecha=hoy,
                    tipo=GestionHorario.Tipo.OTRO,
                    detalle="Arresto disciplinario (sanción administrativa)",
                    estado=GestionHorario.Estado.APROBADO,
                )
            elif estado == "PERMISO":
                GestionHorario.objects.create(
                    agente=user,
                    supervisor=sup_ref,
                    fecha=hoy,
                    tipo=GestionHorario.Tipo.OTRO,
                    detalle="Permiso personal de medio día",
                    estado=GestionHorario.Estado.APROBADO,
                )

        # Evaluaciones demo del jefe sobre supervisores (si no existen)
        if jefe:
            for email in (
                "SupervisorGyeD01@gmail.com",
                "SupervisorGyeD03@gmail.com",
                "SupervisorGyeD05@gmail.com",
            ):
                sup = users_by_email[email][0]
                if not EvaluacionSupervisor.objects.filter(
                    evaluador=jefe, supervisor=sup
                ).exists():
                    EvaluacionSupervisor.objects.create(
                        evaluador=jefe,
                        supervisor=sup,
                        calificacion=4 if "D05" not in email else 3,
                        anotacion="Desempeño operativo acorde a la zona. Seguimiento de respuesta ECU-911.",
                        periodo=hoy.strftime("%Y-%m"),
                    )

        from roles.director_zona.scope import users_in_zone
        from accounts.models import SystemRole as SR

        if jefe:
            n = (
                users_in_zone(jefe)
                .filter(
                    profile__role__in=[
                        SR.SUPERVISOR_UNIDAD,
                        SR.AGENTE_OPERATIVO,
                        SR.DETECTIVE,
                    ]
                )
                .count()
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Personal visible para {jefe.email}: {n} efectivos ({hoy})"
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING("No se encontró JefeZonaChelo — seed de usuarios OK igual.")
            )
