"""
Llena el dashboard del Supervisor (calidad hoy + actividad por escuadra).

Uso:
  python manage.py seed_supervisor_dash
  python manage.py seed_supervisor_dash --email SupervisorDominga@gmail.com
"""

from __future__ import annotations

from datetime import datetime, time
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import AccountStatus, SystemRole, UserProfile
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    Escuadra,
    ParteAprehension,
    VehiculoFlota,
)


ESCUADRAS_SPEC = [
    # nombre, n_agentes, cuadrante, lat, lng
    ("Escuadra Alfa · Norte", 4, "Distrito 4 — Zona Norte · Sector A", Decimal("-0.1650"), Decimal("-78.4700")),
    ("Escuadra Bravo · Centro", 3, "Distrito 4 — Zona Norte · Sector B", Decimal("-0.1720"), Decimal("-78.4800")),
    ("Escuadra Charlie · Sur", 3, "Distrito 2 — Zona Norte · Sector C", Decimal("-0.1850"), Decimal("-78.4900")),
    ("Escuadra Delta · Oriente", 2, "Sector 12 · Oriente", Decimal("-0.1900"), Decimal("-78.4600")),
    ("Escuadra Eco · Reserva", 2, "Distrito 4 — Zona Norte · Reserva", Decimal("-0.1780"), Decimal("-78.4550")),
]


class Command(BaseCommand):
    help = "Puebla escuadras, asignaciones y partes de HOY para el dashboard del supervisor"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default="SupervisorDominga@gmail.com",
            help="Email del supervisor dueño de las escuadras",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"]
        supervisor = User.objects.filter(email__iexact=email).select_related("profile").first()
        if not supervisor:
            raise CommandError(f"No existe el supervisor {email}")

        hoy = timezone.localdate()
        ahora = timezone.localtime()
        self.stdout.write(f"Supervisor: {email} · fecha={hoy}")

        agentes = self._ensure_agentes(supervisor, need=14)
        vehiculos = list(VehiculoFlota.objects.filter(activo=True).order_by("id"))
        if not vehiculos:
            raise CommandError("No hay vehículos de flota. Ejecuta seed_flota primero.")

        # —— Escuadras + asignaciones de hoy ——
        cursor = 0
        created_esc = 0
        created_asig = 0
        for idx, (nombre, n_ag, cuadrante, lat, lng) in enumerate(ESCUADRAS_SPEC):
            slice_ag = agentes[cursor : cursor + n_ag]
            cursor += n_ag
            if not slice_ag:
                break
            lider = slice_ag[0]
            veh = vehiculos[idx % len(vehiculos)]
            esc, was_created = Escuadra.objects.update_or_create(
                nombre=nombre,
                fecha=hoy,
                supervisor=supervisor,
                defaults={
                    "agente_lider": lider,
                    "vehiculo": veh,
                    "observaciones": f"Patrullaje preventivo · {cuadrante}",
                    "activo": True,
                },
            )
            if was_created:
                created_esc += 1
            esc.companeros.set(slice_ag[1:])

            for j, agente in enumerate(slice_ag):
                companero = None
                if len(slice_ag) > 1:
                    companero = slice_ag[(j + 1) % len(slice_ag)]
                    if companero.id == agente.id:
                        companero = None
                _, created = AsignacionDiaria.objects.update_or_create(
                    agente=agente,
                    fecha=hoy,
                    defaults={
                        "companero": companero,
                        "supervisor": supervisor,
                        "escuadra": esc,
                        "vehiculo": veh,
                        "vehiculo_placa": veh.placa,
                        "vehiculo_tipo": veh.get_tipo_display(),
                        "cuadrante": cuadrante,
                        "sector_detalle": f"Ruta {j + 1} · {nombre}",
                        "turno_inicio": time(7, 0),
                        "turno_fin": time(19, 0),
                        "hora_formacion_real": time(6, 45),
                        "hora_salida_real": time(7, 10),
                        "unidad_label": f"Unidad {nombre.split()[1]}-{j + 1}",
                        "latitud": lat + Decimal(str(j * 0.001)),
                        "longitud": lng - Decimal(str(j * 0.001)),
                        "observaciones": "Turno diurno · respuesta ECU-911",
                        "activo": True,
                    },
                )
                if created:
                    created_asig += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Escuadras hoy: {Escuadra.objects.filter(fecha=hoy, activo=True).count()} "
                f"(nuevas {created_esc}) · asignaciones {AsignacionDiaria.objects.filter(fecha=hoy, activo=True).count()}"
            )
        )

        # —— Partes de HOY para el donut de calidad ——
        # Redistribuye ~18 partes SEED hacia hoy con mezcla 60/25/15
        seed_qs = list(
            ParteAprehension.objects.filter(numero_caso__startswith="SEED-")
            .order_by("-id")[:18]
        )
        if len(seed_qs) < 10:
            seed_qs = list(ParteAprehension.objects.order_by("-id")[:18])

        n = len(seed_qs)
        n_apro = max(1, round(n * 0.60))
        n_pend = max(1, round(n * 0.25))
        # resto OBSERVADO

        for i, parte in enumerate(seed_qs):
            stamp = timezone.make_aware(
                datetime.combine(hoy, time(7 + (i % 10), 5 + (i * 3) % 50))
            )
            if i < n_apro:
                estado = ParteAprehension.EstadoRevision.APROBADO
                motivo = ""
            elif i < n_apro + n_pend:
                estado = ParteAprehension.EstadoRevision.EN_REVISION
                motivo = ""
            else:
                estado = ParteAprehension.EstadoRevision.OBSERVADO
                motivo = "Observado en control de calidad: completar indicios / corregir inconsistencias del relato."

            ParteAprehension.objects.filter(pk=parte.pk).update(
                estado_revision=estado,
                motivo_rechazo=motivo,
                creado_en=stamp,
                actualizado_en=ahora,
                enviado_revision_en=stamp if estado != ParteAprehension.EstadoRevision.BORRADOR else None,
                aprobado_en=stamp if estado == ParteAprehension.EstadoRevision.APROBADO else None,
                revisado_por=supervisor if estado != ParteAprehension.EstadoRevision.EN_REVISION else None,
            )

        # —— Alertas críticas activas (KPI) ——
        agente0 = agentes[0]
        for i, titulo in enumerate(
            [
                "Robo a mano armada · reporte ECU-911",
                "Riña con arma blanca · prioridad alta",
                "Allanamiento en progreso · Sector Norte",
            ]
        ):
            AlertaDespacho.objects.get_or_create(
                titulo=titulo,
                agente=agente0,
                defaults={
                    "asignada_por": supervisor,
                    "descripcion": "Alerta demo para dashboard del supervisor.",
                    "direccion": f"Av. Principal N{i + 1} · Distrito 4",
                    "prioridad": AlertaDespacho.Prioridad.ALTA,
                    "estado": AlertaDespacho.Estado.ASIGNADA,
                    "latitud": Decimal("-0.1700"),
                    "longitud": Decimal("-78.4750"),
                },
            )

        # Resumen
        inicio = timezone.make_aware(datetime.combine(hoy, time.min))
        partes_hoy = ParteAprehension.objects.filter(creado_en__gte=inicio)
        self.stdout.write(
            self.style.SUCCESS(
                "Partes hoy → "
                f"APROBADO={partes_hoy.filter(estado_revision='APROBADO').count()} "
                f"EN_REVISION={partes_hoy.filter(estado_revision='EN_REVISION').count()} "
                f"OBSERVADO={partes_hoy.filter(estado_revision='OBSERVADO').count()}"
            )
        )
        self.stdout.write(self.style.SUCCESS("seed_supervisor_dash OK — recarga el dashboard de Dominga"))

    def _ensure_agentes(self, supervisor: User, need: int) -> list[User]:
        """Reutiliza agentes existentes y completa con usuarios demo del supervisor."""
        existing = list(
            User.objects.filter(profile__role=SystemRole.AGENTE_OPERATIVO, is_active=True)
            .select_related("profile")
            .order_by("id")
        )
        names = [
            "Carlos",
            "Ana",
            "Luis",
            "Maria",
            "Jorge",
            "Patricia",
            "Andres",
            "Sofia",
            "Diego",
            "Elena",
            "Miguel",
            "Rosa",
            "Pablo",
            "Lucia",
        ]
        juris = getattr(getattr(supervisor, "profile", None), "jurisdiccion", None)
        zona_txt = juris.nombre if juris else (getattr(supervisor.profile, "zona", "") or "")

        out = list(existing)
        i = 0
        while len(out) < need and i < len(names):
            first = names[i]
            i += 1
            email = f"AgenteDash{first}@gmail.com"
            user, created = User.objects.get_or_create(
                username=email.lower(),
                defaults={
                    "email": email,
                    "first_name": first,
                    "last_name": "Operativo",
                    "is_active": True,
                },
            )
            if created or not user.has_usable_password():
                user.set_password("admin123")
                user.email = email
                user.first_name = first
                user.last_name = "Operativo"
                user.is_active = True
                user.save()
            cedula = f"09{10000000 + user.id}"
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "role": SystemRole.AGENTE_OPERATIVO,
                    "rango_tipico": "Cabo",
                    "rango_policial": "Cabo",
                    "unidad": "Servicio Urbano",
                    "zona": zona_txt,
                    "jurisdiccion": juris,
                    "estado": AccountStatus.ACTIVO,
                    "cedula": cedula,
                    "placa": f"P-{2000 + user.id}",
                    "telefono": f"09{80000000 + user.id}",
                },
            )
            if all(u.id != user.id for u in out):
                out.append(user)
                if created:
                    self.stdout.write(f"  agente: {email}")
        return out[:need]
