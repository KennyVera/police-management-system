"""Seed planes SaaS, InstitucionPrueba, SuperAdmin y backfill de datos."""

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import AccountStatus, SystemRole, UserProfile
from operativo.models import ExpedienteCaso, ParteAprehension
from saas_core.models import Institucion, PlanSuscripcion


PLANS = [
    {
        "codigo": "BASICO",
        "nombre": "Plan Básico",
        "audiencia": "Metropolitana / Municipal",
        "descripcion": "Operación urbana: partes, despacho y usuarios esenciales.",
        "precio_mensual": Decimal("89.00"),
        "precio_anual": Decimal("890.00"),
        "limite_usuarios": 50,
        "almacenamiento_gb": 100,
        "tiene_analitica_avanzada": False,
        "on_premise": False,
        "modulos": ["operativo", "despacho"],
        "caracteristicas": "Partes de aprehensión\nDespacho básico\nHasta 50 usuarios",
        "orden": 1,
    },
    {
        "codigo": "CORPORATIVO",
        "nombre": "Plan Corporativo",
        "audiencia": "Seguridad Privada",
        "descripcion": "Multi-unidad, MinIO ampliado y analítica táctica ClickHouse.",
        "precio_mensual": Decimal("249.00"),
        "precio_anual": Decimal("2490.00"),
        "limite_usuarios": 200,
        "almacenamiento_gb": 500,
        "tiene_analitica_avanzada": True,
        "on_premise": False,
        "modulos": ["operativo", "despacho", "tactico", "reportes"],
        "caracteristicas": "Multi-unidad\nAnalítica ClickHouse\nMinIO 500 GB\nHasta 200 usuarios",
        "orden": 2,
    },
    {
        "codigo": "GUBERNAMENTAL",
        "nombre": "Plan Gubernamental",
        "audiencia": "Enterprise / On-Premise",
        "descripcion": "Despliegue institucional, SSO, cuotas ilimitadas y soporte dedicado.",
        "precio_mensual": Decimal("799.00"),
        "precio_anual": Decimal("7990.00"),
        "limite_usuarios": 5000,
        "almacenamiento_gb": 5000,
        "tiene_analitica_avanzada": True,
        "on_premise": True,
        "modulos": ["operativo", "despacho", "tactico", "reportes", "estrategico", "sso"],
        "caracteristicas": "On-premise\nSSO institucional\nSoporte dedicado\nCuotas ampliadas",
        "orden": 3,
    },
]


class Command(BaseCommand):
    help = "Crea planes SaaS, InstitucionPrueba, SuperAdmin y asigna datos existentes"

    def handle(self, *args, **options):
        with transaction.atomic():
            plans = {}
            for item in PLANS:
                plan, _ = PlanSuscripcion.objects.update_or_create(
                    codigo=item["codigo"],
                    defaults={
                        **{k: v for k, v in item.items() if k != "codigo"},
                        "activo": True,
                        "archivado": False,
                    },
                )
                plans[item["codigo"]] = plan
                self.stdout.write(f"Plan: {plan.nombre}")

            plan_gov = plans["GUBERNAMENTAL"]
            institucion, created = Institucion.objects.update_or_create(
                ruc="9999999999001",
                defaults={
                    "nombre_comercial": "InstitucionPrueba",
                    "direccion": "Demo · Circuito Centro Urbano",
                    "plan_actual": plan_gov,
                    "esta_activa": True,
                    "estado_pago": Institucion.EstadoPago.ACTIVO,
                    "metodo_facturacion": "orden_compra",
                    "fecha_registro": timezone.now(),
                    "fecha_renovacion": (timezone.now() + timedelta(days=365)).date(),
                },
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"{'Creada' if created else 'Actualizada'} {institucion.nombre_comercial}"
                )
            )

            # SuperAdmin SaaS (sin institución)
            sa_email = "SuperAdminSaaS@gmail.com"
            sa_user, sa_created = User.objects.get_or_create(
                username="superadmin.saas",
                defaults={
                    "email": sa_email,
                    "first_name": "Nova",
                    "last_name": "Platform",
                    "is_staff": True,
                    "is_superuser": True,
                },
            )
            sa_user.email = sa_email
            sa_user.set_password("admin123")
            sa_user.is_staff = True
            sa_user.is_superuser = True
            sa_user.save()
            profile, _ = UserProfile.objects.get_or_create(
                user=sa_user,
                defaults={"role": SystemRole.SUPERADMIN_SAAS},
            )
            profile.role = SystemRole.SUPERADMIN_SAAS
            profile.estado = AccountStatus.ACTIVO
            profile.institucion = None
            profile.unidad = "CrimeTrack Platform"
            profile.rango_tipico = "SaaS Owner"
            profile.save()
            profile.sync_user_active()
            self.stdout.write(
                self.style.SUCCESS(
                    f"SuperAdmin: {sa_email} / admin123 ({'nuevo' if sa_created else 'ok'})"
                )
            )

            # Admin institucional de prueba (si existe admin@sgp.gob)
            admin = User.objects.filter(email__iexact="admin@sgp.gob").first()
            if admin and hasattr(admin, "profile"):
                institucion.admin_institucional = admin
                institucion.save(update_fields=["admin_institucional"])

            # Backfill usuarios (todos excepto SuperAdmin SaaS)
            n_users = (
                UserProfile.objects.exclude(role=SystemRole.SUPERADMIN_SAAS)
                .filter(institucion__isnull=True)
                .update(institucion=institucion)
            )
            # Asegurar que los que ya tenían otra null también
            UserProfile.objects.exclude(role=SystemRole.SUPERADMIN_SAAS).exclude(
                institucion=institucion
            ).update(institucion=institucion)

            n_partes = ParteAprehension.objects.filter(institucion__isnull=True).update(
                institucion=institucion
            )
            n_exp = ExpedienteCaso.objects.filter(institucion__isnull=True).update(
                institucion=institucion
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Backfill → perfiles:{n_users}+ · partes:{n_partes} · expedientes:{n_exp}"
                )
            )
            self.stdout.write(
                f"Usuarios en {institucion.nombre_comercial}: "
                f"{UserProfile.objects.filter(institucion=institucion).count()}"
            )
