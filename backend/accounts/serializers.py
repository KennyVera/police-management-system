from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from accounts.models import (
    ASSIGNABLE_ROLES,
    AccountStatus,
    SystemRole,
    UserProfile,
    UserSession,
)
from organizacion.models import Department, Jurisdiction, JurisdictionType


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role")
    role_label = serializers.CharField(source="profile.get_role_display")
    role_slug = serializers.CharField(source="profile.role_slug")
    rango_tipico = serializers.CharField(source="profile.rango_tipico")
    unidad = serializers.CharField(source="profile.unidad")
    zona = serializers.CharField(source="profile.zona")
    telefono = serializers.CharField(source="profile.telefono", allow_blank=True)
    avatar_url = serializers.CharField(source="profile.avatar_url", allow_blank=True)
    cedula = serializers.CharField(source="profile.cedula", allow_null=True)
    placa = serializers.CharField(source="profile.placa")
    rango_policial = serializers.CharField(source="profile.rango_policial")
    estado = serializers.CharField(source="profile.estado")
    two_factor_enabled = serializers.BooleanField(source="profile.two_factor_enabled")
    institucion_id = serializers.IntegerField(
        source="profile.institucion_id", allow_null=True, read_only=True
    )
    institucion_nombre = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_label",
            "role_slug",
            "rango_tipico",
            "unidad",
            "zona",
            "telefono",
            "avatar_url",
            "cedula",
            "placa",
            "rango_policial",
            "estado",
            "two_factor_enabled",
            "is_active",
            "institucion_id",
            "institucion_nombre",
        )

    def get_institucion_nombre(self, obj):
        inst = getattr(obj.profile, "institucion", None)
        return inst.nombre_comercial if inst else None


class MeUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False)
    telefono = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_email(self, value):
        user = self.context["request"].user
        if (
            User.objects.filter(email__iexact=value)
            .exclude(pk=user.pk)
            .exists()
        ):
            raise serializers.ValidationError("Ya existe otro usuario con este correo.")
        return value.lower()

    def update(self, instance, validated_data):
        for field in ("first_name", "last_name", "email"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        if "telefono" in validated_data:
            instance.profile.telefono = validated_data["telefono"]
            instance.profile.save(update_fields=["telefono"])
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]
        try:
            user = User.objects.select_related("profile", "profile__institucion").get(
                email__iexact=email
            )
        except User.DoesNotExist as exc:
            raise serializers.ValidationError("Credenciales inválidas.") from exc

        if not user.check_password(password):
            raise serializers.ValidationError("Credenciales inválidas.")
        if not user.is_active:
            raise serializers.ValidationError("Cuenta desactivada.")
        if not hasattr(user, "profile"):
            raise serializers.ValidationError("Usuario sin perfil/rol asignado.")
        if user.profile.estado != AccountStatus.ACTIVO:
            raise serializers.ValidationError(
                f"Cuenta {user.profile.get_estado_display().lower()}."
            )
        inst = getattr(user.profile, "institucion", None)
        if inst and (not inst.esta_activa or inst.estado_pago == "SUSPENDIDO"):
            raise serializers.ValidationError(
                "La institución está suspendida o inactiva. Contacte a soporte CrimeTrack."
            )

        attrs["user"] = user
        return attrs


class PoliceUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role")
    role_label = serializers.CharField(source="profile.get_role_display", read_only=True)
    cedula = serializers.CharField(source="profile.cedula", allow_null=True, required=False)
    placa = serializers.CharField(source="profile.placa", required=False, allow_blank=True)
    rango_policial = serializers.CharField(
        source="profile.rango_policial", required=False, allow_blank=True
    )
    estado = serializers.CharField(source="profile.estado", required=False)
    two_factor_enabled = serializers.BooleanField(
        source="profile.two_factor_enabled", required=False
    )
    departamento_id = serializers.IntegerField(
        source="profile.departamento_id", allow_null=True, required=False
    )
    jurisdiccion_id = serializers.IntegerField(
        source="profile.jurisdiccion_id", allow_null=True, required=False
    )
    departamento_nombre = serializers.SerializerMethodField()
    jurisdiccion_nombre = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "role",
            "role_label",
            "cedula",
            "placa",
            "rango_policial",
            "estado",
            "two_factor_enabled",
            "departamento_id",
            "jurisdiccion_id",
            "departamento_nombre",
            "jurisdiccion_nombre",
        )

    def get_departamento_nombre(self, obj):
        dep = getattr(obj.profile, "departamento", None)
        return dep.nombre if dep else None

    def get_jurisdiccion_nombre(self, obj):
        jur = getattr(obj.profile, "jurisdiccion", None)
        return jur.nombre if jur else None


class PoliceUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    cedula = serializers.CharField(max_length=20)
    placa = serializers.CharField(max_length=40, required=False, allow_blank=True)
    rango_policial = serializers.CharField(max_length=80, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[(r, r) for r in ASSIGNABLE_ROLES])
    password = serializers.CharField(min_length=8, write_only=True)
    departamento_id = serializers.IntegerField(required=False, allow_null=True)
    jurisdiccion_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo.")
        return value.lower()

    def validate_cedula(self, value):
        if UserProfile.objects.filter(cedula=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con esta cédula.")
        return value

    def validate_role(self, value):
        if value not in ASSIGNABLE_ROLES and value != SystemRole.ADMIN_SISTEMA:
            if value not in dict(SystemRole.choices):
                raise serializers.ValidationError("Rol no válido.")
        if value not in ASSIGNABLE_ROLES:
            raise serializers.ValidationError(
                "Solo se pueden asignar roles operativos/policiales."
            )
        return value

    def create(self, validated_data):
        username = validated_data["cedula"]
        user = User.objects.create_user(
            username=username,
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
        )
        profile = UserProfile.objects.create(
            user=user,
            role=validated_data["role"],
            cedula=validated_data["cedula"],
            placa=validated_data.get("placa", ""),
            rango_policial=validated_data.get("rango_policial", ""),
            rango_tipico=validated_data.get("rango_policial", ""),
            estado=AccountStatus.ACTIVO,
            departamento_id=validated_data.get("departamento_id"),
            jurisdiccion_id=validated_data.get("jurisdiccion_id"),
            institucion=self.context.get("institucion"),
        )
        profile.sync_user_active()
        return user


class PoliceUserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    placa = serializers.CharField(max_length=40, required=False, allow_blank=True)
    rango_policial = serializers.CharField(max_length=80, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[(r, r) for r in ASSIGNABLE_ROLES], required=False
    )
    estado = serializers.ChoiceField(choices=AccountStatus.choices, required=False)
    two_factor_enabled = serializers.BooleanField(required=False)
    departamento_id = serializers.IntegerField(required=False, allow_null=True)
    jurisdiccion_id = serializers.IntegerField(required=False, allow_null=True)

    def update(self, instance, validated_data):
        for field in ("first_name", "last_name", "email"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()

        profile = instance.profile
        for field in ("placa", "rango_policial", "role", "estado", "two_factor_enabled"):
            if field in validated_data:
                setattr(profile, field, validated_data[field])
        if "rango_policial" in validated_data:
            profile.rango_tipico = validated_data["rango_policial"]
        if "departamento_id" in validated_data:
            profile.departamento_id = validated_data["departamento_id"]
        if "jurisdiccion_id" in validated_data:
            profile.jurisdiccion_id = validated_data["jurisdiccion_id"]
        profile.save()
        if "estado" in validated_data:
            profile.sync_user_active()
        return instance


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8)


class SessionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = (
            "id",
            "user",
            "user_email",
            "user_name",
            "ip_address",
            "user_agent",
            "created_at",
            "last_seen",
            "is_active",
        )

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username


class JurisdictionSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    parent_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Jurisdiction
        fields = (
            "id",
            "tipo",
            "tipo_label",
            "nombre",
            "codigo",
            "parent",
            "parent_nombre",
            "activo",
            "creado_en",
            "actualizado_en",
        )

    def get_parent_nombre(self, obj):
        return obj.parent.nombre if obj.parent_id else None


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = (
            "id",
            "nombre",
            "codigo",
            "descripcion",
            "activo",
            "creado_en",
            "actualizado_en",
        )


class PlazaAssignSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    jurisdiccion_id = serializers.IntegerField(allow_null=True, required=False)
    # Compat: se ignora; la asignación territorial ya no usa departamento
    departamento_id = serializers.IntegerField(allow_null=True, required=False)

    def validate_user_id(self, value):
        if not User.objects.filter(pk=value, profile__isnull=False).exists():
            raise serializers.ValidationError("Usuario no encontrado.")
        return value
