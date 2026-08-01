from rest_framework import serializers

from catalogos.models import CatalogoItem, CatalogoOperativoTipo, TipoDelito, VariableGlobal


class TipoDelitoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoDelito
        fields = (
            "id",
            "codigo",
            "nombre",
            "descripcion",
            "articulo_penal",
            "codigo_iucr",
            "clasificacion_fbi",
            "activo",
            "creado_en",
            "actualizado_en",
        )


class CatalogoItemSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = CatalogoItem
        fields = (
            "id",
            "tipo",
            "tipo_label",
            "codigo",
            "nombre",
            "descripcion",
            "activo",
            "creado_en",
            "actualizado_en",
        )


class VariableGlobalSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariableGlobal
        fields = (
            "id",
            "clave",
            "nombre",
            "valor",
            "unidad",
            "descripcion",
            "actualizado_en",
        )
        read_only_fields = ("clave", "nombre", "unidad", "descripcion")


class VariableGlobalAdminSerializer(serializers.ModelSerializer):
    """Permite editar valor; el resto se mantiene informativo."""

    class Meta:
        model = VariableGlobal
        fields = (
            "id",
            "clave",
            "nombre",
            "valor",
            "unidad",
            "descripcion",
            "actualizado_en",
        )
        read_only_fields = ("clave",)
