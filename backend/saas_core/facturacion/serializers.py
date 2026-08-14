"""Serializers cortos de facturación."""

from rest_framework import serializers

from saas_core.models import EventoFinanciero, Factura, Pago


class FacturaSerializer(serializers.ModelSerializer):
    institucion_nombre = serializers.CharField(
        source="institucion.nombre_comercial", read_only=True
    )
    plan_nombre = serializers.CharField(
        source="plan.nombre", read_only=True, default=""
    )

    class Meta:
        model = Factura
        fields = (
            "id",
            "institucion",
            "institucion_nombre",
            "plan",
            "plan_nombre",
            "numero",
            "monto",
            "estado",
            "periodo_inicio",
            "periodo_fin",
            "fecha_emision",
            "fecha_vencimiento",
            "metodo_pago",
            "modalidad",
            "nota",
            "creado_en",
            "actualizado_en",
            "anulado_en",
            "anulado_motivo",
        )
        read_only_fields = ("numero", "creado_en", "actualizado_en", "anulado_en")


class PagoSerializer(serializers.ModelSerializer):
    institucion_nombre = serializers.CharField(
        source="institucion.nombre_comercial", read_only=True
    )
    factura_numero = serializers.CharField(
        source="factura.numero", read_only=True, default=""
    )

    class Meta:
        model = Pago
        fields = (
            "id",
            "institucion",
            "institucion_nombre",
            "factura",
            "factura_numero",
            "monto",
            "tipo",
            "estado",
            "metodo",
            "referencia",
            "fecha_pago",
            "nota",
            "creado_en",
        )
        read_only_fields = ("creado_en",)


class EventoFinancieroSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, default=""
    )
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default="")
    institucion_nombre = serializers.CharField(
        source="institucion.nombre_comercial", read_only=True, default=""
    )

    class Meta:
        model = EventoFinanciero
        fields = (
            "id",
            "institucion",
            "institucion_nombre",
            "actor",
            "actor_username",
            "actor_email",
            "accion",
            "entidad_tipo",
            "entidad_id",
            "detalle",
            "metadata",
            "creado_en",
        )
        read_only_fields = fields
