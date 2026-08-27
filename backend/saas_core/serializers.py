from __future__ import annotations

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from accounts.models import AccountStatus, SystemRole, UserProfile
from accounts.serializers import UserSerializer
from saas_core.models import Institucion, PlanSuscripcion, SuscripcionEvento


class PlanSuscripcionSerializer(serializers.ModelSerializer):
    """Catálogo público (landing / onboarding)."""

    class Meta:
        model = PlanSuscripcion
        fields = (
            "id",
            "codigo",
            "nombre",
            "descripcion",
            "audiencia",
            "precio_mensual",
            "precio_anual",
            "limite_usuarios",
            "almacenamiento_gb",
            "tiene_analitica_avanzada",
            "on_premise",
            "modulos",
            "caracteristicas",
            "activo",
            "orden",
        )


class PlanAdminSerializer(serializers.ModelSerializer):
    instituciones_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PlanSuscripcion
        fields = (
            "id",
            "codigo",
            "nombre",
            "descripcion",
            "audiencia",
            "precio_mensual",
            "precio_anual",
            "limite_usuarios",
            "almacenamiento_gb",
            "tiene_analitica_avanzada",
            "on_premise",
            "modulos",
            "caracteristicas",
            "activo",
            "archivado",
            "orden",
            "instituciones_count",
            "creado_en",
            "actualizado_en",
        )
        read_only_fields = ("creado_en", "actualizado_en", "instituciones_count")

    def validate_codigo(self, value):
        value = (value or "").strip().upper().replace(" ", "_")
        if not value:
            raise serializers.ValidationError("Código requerido.")
        qs = PlanSuscripcion.objects.filter(codigo__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe un plan con este código.")
        return value

    def validate_modulos(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Módulos debe ser una lista.")
        return [str(x).strip() for x in value if str(x).strip()]


class InstitucionSerializer(serializers.ModelSerializer):
    plan_nombre = serializers.SerializerMethodField()
    plan = PlanSuscripcionSerializer(source="plan_actual", read_only=True)
    admin_email = serializers.SerializerMethodField()
    usuarios_count = serializers.SerializerMethodField()

    class Meta:
        model = Institucion
        fields = (
            "id",
            "nombre_comercial",
            "ruc",
            "direccion",
            "plan_actual",
            "plan",
            "plan_nombre",
            "esta_activa",
            "estado_pago",
            "metodo_facturacion",
            "fecha_registro",
            "fecha_renovacion",
            "admin_institucional",
            "admin_email",
            "usuarios_count",
        )

    def get_plan_nombre(self, obj):
        return obj.plan_actual.nombre if obj.plan_actual_id else "Sin plan"

    def get_admin_email(self, obj):
        if obj.admin_institucional_id:
            return obj.admin_institucional.email
        return None

    def get_usuarios_count(self, obj):
        return UserProfile.objects.filter(institucion=obj).count()


class SuscripcionListSerializer(serializers.ModelSerializer):
    plan_nombre = serializers.SerializerMethodField()
    plan_codigo = serializers.SerializerMethodField()
    precio_mensual = serializers.SerializerMethodField()
    admin_email = serializers.SerializerMethodField()
    usuarios_count = serializers.IntegerField(read_only=True)
    estado_pago_label = serializers.CharField(
        source="get_estado_pago_display", read_only=True
    )

    class Meta:
        model = Institucion
        fields = (
            "id",
            "nombre_comercial",
            "ruc",
            "plan_actual",
            "plan_nombre",
            "plan_codigo",
            "precio_mensual",
            "esta_activa",
            "estado_pago",
            "estado_pago_label",
            "metodo_facturacion",
            "fecha_registro",
            "fecha_renovacion",
            "admin_email",
            "usuarios_count",
        )

    def get_plan_nombre(self, obj):
        return obj.plan_actual.nombre if obj.plan_actual_id else "Sin plan"

    def get_plan_codigo(self, obj):
        return obj.plan_actual.codigo if obj.plan_actual_id else None

    def get_precio_mensual(self, obj):
        if obj.plan_actual_id:
            return float(obj.plan_actual.precio_mensual)
        return 0

    def get_admin_email(self, obj):
        if obj.admin_institucional_id:
            return obj.admin_institucional.email
        return None


class SuscripcionEventoSerializer(serializers.ModelSerializer):
    accion_label = serializers.CharField(source="get_accion_display", read_only=True)
    plan_anterior_nombre = serializers.SerializerMethodField()
    plan_nuevo_nombre = serializers.SerializerMethodField()
    creado_por_email = serializers.SerializerMethodField()

    class Meta:
        model = SuscripcionEvento
        fields = (
            "id",
            "accion",
            "accion_label",
            "plan_anterior",
            "plan_anterior_nombre",
            "plan_nuevo",
            "plan_nuevo_nombre",
            "estado_anterior",
            "estado_nuevo",
            "nota",
            "creado_por_email",
            "creado_en",
        )

    def get_plan_anterior_nombre(self, obj):
        return obj.plan_anterior.nombre if obj.plan_anterior_id else None

    def get_plan_nuevo_nombre(self, obj):
        return obj.plan_nuevo.nombre if obj.plan_nuevo_id else None

    def get_creado_por_email(self, obj):
        return obj.creado_por.email if obj.creado_por_id else None


class OnboardingRegistroSerializer(serializers.Serializer):
    # Paso 1 — Institución
    nombre_comercial = serializers.CharField(max_length=180)
    ruc = serializers.CharField(max_length=32)
    direccion = serializers.CharField(max_length=255, required=False, allow_blank=True)
    # Paso 2 — Plan
    plan_id = serializers.IntegerField()
    metodo_facturacion = serializers.ChoiceField(
        choices=["tarjeta", "transferencia", "orden_compra"],
        default="tarjeta",
    )
    # Paso 3 — Master Admin (ADMIN_SISTEMA)
    admin_nombre = serializers.CharField(max_length=150)
    admin_apellido = serializers.CharField(max_length=150, required=False, allow_blank=True)
    admin_email = serializers.EmailField()
    admin_password = serializers.CharField(min_length=8, write_only=True)

    def validate_ruc(self, value):
        value = value.strip()
        if not value.isdigit() or len(value) != 13:
            raise serializers.ValidationError(
                "El RUC debe tener exactamente 13 dígitos numéricos."
            )
        if Institucion.objects.filter(ruc__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una institución con este RUC.")
        return value

    def validate_admin_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo.")
        return email

    def validate_plan_id(self, value):
        if not PlanSuscripcion.objects.filter(
            pk=value, activo=True, archivado=False
        ).exists():
            raise serializers.ValidationError("Plan no válido o inactivo.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from datetime import timedelta

        plan = PlanSuscripcion.objects.get(pk=validated_data["plan_id"])
        renovacion = (timezone.now() + timedelta(days=30)).date()
        inst = Institucion.objects.create(
            nombre_comercial=validated_data["nombre_comercial"].strip(),
            ruc=validated_data["ruc"].strip(),
            direccion=(validated_data.get("direccion") or "").strip(),
            plan_actual=plan,
            esta_activa=True,
            estado_pago=Institucion.EstadoPago.PRUEBA,
            metodo_facturacion=validated_data.get("metodo_facturacion") or "tarjeta",
            fecha_registro=timezone.now(),
            fecha_renovacion=renovacion,
        )

        email = validated_data["admin_email"]
        username = email.split("@")[0][:40]
        base = username
        n = 1
        while User.objects.filter(username=username).exists():
            username = f"{base}{n}"
            n += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["admin_password"],
            first_name=validated_data["admin_nombre"].strip(),
            last_name=(validated_data.get("admin_apellido") or "").strip(),
            is_staff=True,
        )
        UserProfile.objects.create(
            user=user,
            role=SystemRole.ADMIN_SISTEMA,
            rango_tipico="Ingeniería de Software / TI",
            unidad="Dirección de Sistemas",
            estado=AccountStatus.ACTIVO,
            institucion=inst,
        )
        inst.admin_institucional = user
        inst.save(update_fields=["admin_institucional"])

        SuscripcionEvento.objects.create(
            institucion=inst,
            accion=SuscripcionEvento.Accion.ASIGNAR,
            plan_nuevo=plan,
            estado_nuevo=Institucion.EstadoPago.PRUEBA,
            nota="Asignación automática en onboarding",
        )

        token, _ = Token.objects.get_or_create(user=user)
        return {
            "institucion": inst,
            "user": user,
            "token": token.key,
        }
