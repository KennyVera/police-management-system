from rest_framework import serializers
from django.contrib.auth.models import User

from catalogos.models import TipoDelito
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    BienInvestigado,
    BitacoraInvestigacion,
    Escuadra,
    EvidenciaCaso,
    ExpedienteCaso,
    GestionHorario,
    InformeInvestigativo,
    InvolucradoExpediente,
    MultimediaEvidencia,
    MovimientoCustodia,
    Notificacion,
    NovedadIncidente,
    OrdenAdicional,
    ParteAprehension,
    SolicitudFiscal,
    VehiculoFlota,
)


class ParteAprehensionSerializer(serializers.ModelSerializer):
    tipo_delito_nombre = serializers.CharField(source="tipo_delito.nombre", read_only=True)
    estado_revision_label = serializers.CharField(
        source="get_estado_revision_display", read_only=True
    )
    prioridad_label = serializers.CharField(source="get_prioridad_display", read_only=True)
    nivel_riesgo_label = serializers.CharField(
        source="get_nivel_riesgo_display", read_only=True
    )
    fuente_reporte_label = serializers.CharField(
        source="get_fuente_reporte_display", read_only=True
    )
    agente = serializers.SerializerMethodField()
    oficial_registra = serializers.SerializerMethodField()
    revisado_por_nombre = serializers.SerializerMethodField()
    alerta_titulo = serializers.CharField(source="alerta.titulo", read_only=True, default=None)
    puede_editar = serializers.SerializerMethodField()
    puede_enviar = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    evidencias = serializers.SerializerMethodField()

    class Meta:
        model = ParteAprehension
        fields = [
            "id",
            "alerta",
            "alerta_titulo",
            "estado_revision",
            "estado_revision_label",
            "enviado_revision_en",
            "numero_caso",
            "titulo",
            "tipo_delito",
            "tipo_delito_nombre",
            "codigo_iucr",
            "clasificacion_fbi",
            "fecha_hecho",
            "hora_hecho",
            "fecha_hora",
            "prioridad",
            "prioridad_label",
            "nivel_riesgo",
            "nivel_riesgo_label",
            "lugar",
            "sector_zona",
            "descripcion",
            "relato_hechos",
            "fuente_reporte",
            "fuente_reporte_label",
            "hay_heridos",
            "hay_armas",
            "estado_inicial",
            "latitud",
            "longitud",
            "detenido_nombres",
            "detenido_apellidos",
            "detenido_cedula",
            "detenido_edad",
            "derechos_leidos",
            "observaciones",
            "motivo_rechazo",
            "rechazado_en",
            "aprobado_en",
            "bloqueado",
            "pdf_url",
            "evidencias",
            "agente",
            "oficial_registra",
            "revisado_por_nombre",
            "puede_editar",
            "puede_enviar",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "creado_en",
            "actualizado_en",
            "agente",
            "oficial_registra",
            "revisado_por_nombre",
            "tipo_delito_nombre",
            "estado_revision_label",
            "prioridad_label",
            "nivel_riesgo_label",
            "fuente_reporte_label",
            "enviado_revision_en",
            "alerta_titulo",
            "puede_editar",
            "puede_enviar",
            "codigo_iucr",
            "clasificacion_fbi",
            "estado_inicial",
            "motivo_rechazo",
            "rechazado_en",
            "aprobado_en",
            "bloqueado",
            "pdf_url",
            "evidencias",
        ]

    def get_agente(self, obj):
        u = obj.creado_por
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_oficial_registra(self, obj):
        return self.get_agente(obj)

    def get_revisado_por_nombre(self, obj):
        u = obj.revisado_por
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_evidencias(self, obj):
        try:
            qs = obj.multimedia.all()
            return MultimediaEvidenciaSerializer(qs, many=True).data
        except Exception:  # noqa: BLE001
            return []

    def get_pdf_url(self, obj):
        if not obj.pdf_object_key:
            return None
        try:
            from operativo.minio_service import get_presigned_url

            return get_presigned_url(obj.pdf_object_key, obj.pdf_bucket or None)
        except Exception:  # noqa: BLE001
            return None

    def get_puede_editar(self, obj):
        if obj.bloqueado or obj.estado_revision == ParteAprehension.EstadoRevision.APROBADO:
            return False
        return obj.estado_revision in (
            ParteAprehension.EstadoRevision.BORRADOR,
            ParteAprehension.EstadoRevision.OBSERVADO,
        )

    def get_puede_enviar(self, obj):
        if obj.bloqueado or obj.estado_revision == ParteAprehension.EstadoRevision.APROBADO:
            return False
        return obj.estado_revision in (
            ParteAprehension.EstadoRevision.BORRADOR,
            ParteAprehension.EstadoRevision.OBSERVADO,
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("descripcion") and not attrs.get("relato_hechos"):
            attrs["relato_hechos"] = attrs["descripcion"]
        if attrs.get("relato_hechos") and not attrs.get("descripcion"):
            attrs["descripcion"] = attrs["relato_hechos"]

        fecha = attrs.get("fecha_hecho") or getattr(self.instance, "fecha_hecho", None)
        hora = attrs.get("hora_hecho") or getattr(self.instance, "hora_hecho", None)
        if fecha and hora and not attrs.get("fecha_hora"):
            from datetime import datetime

            from django.utils import timezone as tz

            combined = datetime.combine(fecha, hora)
            attrs["fecha_hora"] = tz.make_aware(combined) if tz.is_naive(combined) else combined
        elif not attrs.get("fecha_hora") and not getattr(self.instance, "fecha_hora", None):
            from django.utils import timezone as tz

            attrs["fecha_hora"] = tz.now()
        return attrs


class NovedadIncidenteSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    agente = serializers.SerializerMethodField()

    class Meta:
        model = NovedadIncidente
        fields = [
            "id",
            "fecha_hora",
            "lugar",
            "tipo",
            "tipo_label",
            "descripcion",
            "hubo_detenidos",
            "observaciones",
            "agente",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en", "agente", "tipo_label"]

    def get_agente(self, obj):
        u = obj.creado_por
        return f"{u.first_name} {u.last_name}".strip() or u.username


class MultimediaEvidenciaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    agente = serializers.SerializerMethodField()

    class Meta:
        model = MultimediaEvidencia
        fields = [
            "id",
            "origen",
            "parte",
            "novedad",
            "descripcion",
            "nombre_archivo",
            "content_type",
            "tamanio_bytes",
            "bucket",
            "object_key",
            "url",
            "agente",
            "creado_en",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        try:
            from operativo.minio_service import get_presigned_url

            return get_presigned_url(obj.object_key, obj.bucket)
        except Exception:  # noqa: BLE001
            return None

    def get_agente(self, obj):
        u = obj.subido_por
        return f"{u.first_name} {u.last_name}".strip() or u.username


class TipoDelitoMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoDelito
        fields = ["id", "codigo", "nombre", "codigo_iucr", "clasificacion_fbi"]


def _user_label(user):
    if not user:
        return None
    return {
        "id": user.id,
        "nombre": f"{user.first_name} {user.last_name}".strip() or user.username,
        "email": user.email,
        "placa": getattr(getattr(user, "profile", None), "placa", "") or "",
    }


class AsignacionDiariaSerializer(serializers.ModelSerializer):
    agente_info = serializers.SerializerMethodField()
    companero_info = serializers.SerializerMethodField()
    supervisor_info = serializers.SerializerMethodField()
    zona_nombre = serializers.CharField(source="zona.nombre", read_only=True, default=None)
    zona_tipo = serializers.CharField(source="zona.get_tipo_display", read_only=True, default=None)

    class Meta:
        model = AsignacionDiaria
        fields = [
            "id",
            "fecha",
            "vehiculo_placa",
            "vehiculo_tipo",
            "cuadrante",
            "zona",
            "zona_nombre",
            "zona_tipo",
            "turno_inicio",
            "turno_fin",
            "unidad_label",
            "latitud",
            "longitud",
            "escuadra",
            "vehiculo",
            "sector_detalle",
            "poligono",
            "hora_formacion_real",
            "hora_salida_real",
            "observaciones",
            "activo",
            "agente_info",
            "companero_info",
            "supervisor_info",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = fields

    def get_agente_info(self, obj):
        return _user_label(obj.agente)

    def get_companero_info(self, obj):
        return _user_label(obj.companero)

    def get_supervisor_info(self, obj):
        return _user_label(obj.supervisor)


def _haversine_km(lat1, lon1, lat2, lon2):
    from math import asin, cos, radians, sin, sqrt

    try:
        lat1, lon1, lat2, lon2 = map(float, (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return round(2 * r * asin(sqrt(a)), 1)


class AlertaDespachoSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    prioridad_label = serializers.CharField(source="get_prioridad_display", read_only=True)
    supervisor = serializers.SerializerMethodField()
    agente_nombre = serializers.SerializerMethodField()
    distancia_km = serializers.SerializerMethodField()
    eta_minutos = serializers.SerializerMethodField()
    parte = serializers.SerializerMethodField()
    puede_abrir_parte = serializers.SerializerMethodField()
    progreso = serializers.SerializerMethodField()

    class Meta:
        model = AlertaDespacho
        fields = [
            "id",
            "titulo",
            "descripcion",
            "direccion",
            "referencia",
            "latitud",
            "longitud",
            "origen",
            "prioridad",
            "prioridad_label",
            "estado",
            "estado_label",
            "asignada_en",
            "en_camino_en",
            "llegada_en",
            "cerrada_en",
            "supervisor",
            "agente_nombre",
            "distancia_km",
            "eta_minutos",
            "parte",
            "puede_abrir_parte",
            "progreso",
            "actualizado_en",
        ]
        read_only_fields = fields

    def _agent_coords(self):
        return self.context.get("agent_lat"), self.context.get("agent_lng")

    def get_supervisor(self, obj):
        return _user_label(obj.asignada_por)

    def get_agente_nombre(self, obj):
        u = obj.agente
        if not u:
            return None
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_distancia_km(self, obj):
        alat, alng = self._agent_coords()
        if alat is None or obj.latitud is None or obj.longitud is None:
            return None
        return _haversine_km(alat, alng, obj.latitud, obj.longitud)

    def get_eta_minutos(self, obj):
        km = self.get_distancia_km(obj)
        if km is None:
            return None
        # ~28 km/h promedio urbano
        return max(3, int(round((km / 28.0) * 60)))

    def get_parte(self, obj):
        parte = obj.partes.order_by("-creado_en").first()
        if not parte:
            return None
        return {
            "id": parte.id,
            "estado_revision": parte.estado_revision,
            "estado_revision_label": parte.get_estado_revision_display(),
        }

    def get_puede_abrir_parte(self, obj):
        return obj.estado == AlertaDespacho.Estado.EN_LUGAR

    def get_progreso(self, obj):
        parte = obj.partes.order_by("-creado_en").first()
        en_camino = obj.estado in (
            AlertaDespacho.Estado.EN_CAMINO,
            AlertaDespacho.Estado.EN_LUGAR,
            AlertaDespacho.Estado.CERRADA,
        ) or bool(obj.en_camino_en)
        en_lugar = obj.estado in (
            AlertaDespacho.Estado.EN_LUGAR,
            AlertaDespacho.Estado.CERRADA,
        ) or bool(obj.llegada_en)
        tiene_parte = parte is not None
        completado = bool(
            parte
            and parte.estado_revision
            in (
                ParteAprehension.EstadoRevision.EN_REVISION,
                ParteAprehension.EstadoRevision.APROBADO,
            )
        )
        return {
            "en_camino": en_camino,
            "en_lugar": en_lugar,
            "parte": tiene_parte,
            "completado": completado,
            "paso_actual": (
                "completado"
                if completado
                else "parte"
                if tiene_parte
                else "en_lugar"
                if en_lugar
                else "en_camino"
                if en_camino
                else "asignada"
            ),
        }


class NotificacionSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    parte_numero = serializers.CharField(source="parte.numero_caso", read_only=True, default=None)

    class Meta:
        model = Notificacion
        fields = [
            "id",
            "tipo",
            "tipo_label",
            "titulo",
            "mensaje",
            "leida",
            "parte",
            "parte_numero",
            "enlace",
            "creado_en",
            "leida_en",
        ]
        read_only_fields = fields


class VehiculoFlotaSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = VehiculoFlota
        fields = ["id", "placa", "tipo", "tipo_label", "descripcion", "activo", "creado_en"]
        read_only_fields = ["id", "creado_en", "tipo_label"]


class EscuadraSerializer(serializers.ModelSerializer):
    agente_lider_info = serializers.SerializerMethodField()
    companeros_info = serializers.SerializerMethodField()
    supervisor_info = serializers.SerializerMethodField()
    vehiculo_info = serializers.SerializerMethodField()
    companeros = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(), required=False
    )

    class Meta:
        model = Escuadra
        fields = [
            "id",
            "nombre",
            "fecha",
            "supervisor",
            "supervisor_info",
            "agente_lider",
            "agente_lider_info",
            "companeros",
            "companeros_info",
            "vehiculo",
            "vehiculo_info",
            "observaciones",
            "activo",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "supervisor",
            "supervisor_info",
            "agente_lider_info",
            "companeros_info",
            "vehiculo_info",
            "creado_en",
            "actualizado_en",
        ]

    def get_agente_lider_info(self, obj):
        return _user_label(obj.agente_lider)

    def get_companeros_info(self, obj):
        return [_user_label(u) for u in obj.companeros.all()]

    def get_supervisor_info(self, obj):
        return _user_label(obj.supervisor)

    def get_vehiculo_info(self, obj):
        v = obj.vehiculo
        if not v:
            return None
        return {
            "id": v.id,
            "placa": v.placa,
            "tipo": v.tipo,
            "tipo_label": v.get_tipo_display(),
        }

    def validate(self, attrs):
        lider = attrs.get("agente_lider") or getattr(self.instance, "agente_lider", None)
        companeros = attrs.get("companeros")
        if companeros is None and self.instance is not None:
            companeros = list(self.instance.companeros.all())
        companeros = companeros or []
        if lider and any(c.pk == lider.pk for c in companeros):
            raise serializers.ValidationError(
                {"companeros": "El líder no puede estar también como compañero."}
            )
        return attrs

    def create(self, validated_data):
        companeros = validated_data.pop("companeros", [])
        obj = Escuadra.objects.create(**validated_data)
        if companeros:
            obj.companeros.set(companeros)
        return obj

    def update(self, instance, validated_data):
        companeros = validated_data.pop("companeros", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if companeros is not None:
            instance.companeros.set(companeros)
        return instance


class AsignacionDiariaWriteSerializer(serializers.ModelSerializer):
    agente_info = serializers.SerializerMethodField()
    companero_info = serializers.SerializerMethodField()
    zona_nombre = serializers.CharField(source="zona.nombre", read_only=True, default=None)
    vehiculo_placa_flota = serializers.CharField(source="vehiculo.placa", read_only=True, default=None)

    class Meta:
        model = AsignacionDiaria
        fields = [
            "id",
            "agente",
            "agente_info",
            "companero",
            "companero_info",
            "fecha",
            "escuadra",
            "vehiculo",
            "vehiculo_placa_flota",
            "vehiculo_placa",
            "vehiculo_tipo",
            "zona",
            "zona_nombre",
            "cuadrante",
            "sector_detalle",
            "poligono",
            "turno_inicio",
            "turno_fin",
            "hora_formacion_real",
            "hora_salida_real",
            "unidad_label",
            "latitud",
            "longitud",
            "observaciones",
            "activo",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "agente_info",
            "companero_info",
            "zona_nombre",
            "vehiculo_placa_flota",
            "creado_en",
        ]

    def get_agente_info(self, obj):
        return _user_label(obj.agente)

    def get_companero_info(self, obj):
        return _user_label(obj.companero)


class GestionHorarioSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    agente_info = serializers.SerializerMethodField()

    class Meta:
        model = GestionHorario
        fields = [
            "id",
            "agente",
            "agente_info",
            "supervisor",
            "fecha",
            "tipo",
            "tipo_label",
            "detalle",
            "hora_formacion",
            "hora_salida",
            "estado",
            "estado_label",
            "respuesta",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "agente_info",
            "tipo_label",
            "estado_label",
            "creado_en",
            "actualizado_en",
        ]

    def get_agente_info(self, obj):
        return _user_label(obj.agente)


class AlertaDespachoWriteSerializer(serializers.ModelSerializer):
    agente_info = serializers.SerializerMethodField()
    escuadra_info = serializers.SerializerMethodField()
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    prioridad_label = serializers.CharField(source="get_prioridad_display", read_only=True)
    distancia_km = serializers.FloatField(read_only=True, required=False)

    class Meta:
        model = AlertaDespacho
        fields = [
            "id",
            "agente",
            "agente_info",
            "escuadra",
            "escuadra_info",
            "titulo",
            "descripcion",
            "direccion",
            "referencia",
            "latitud",
            "longitud",
            "origen",
            "prioridad",
            "prioridad_label",
            "estado",
            "estado_label",
            "distancia_km",
            "asignada_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "agente_info",
            "escuadra_info",
            "prioridad_label",
            "estado_label",
            "distancia_km",
            "asignada_en",
            "actualizado_en",
        ]

    def get_agente_info(self, obj):
        return _user_label(obj.agente)

    def get_escuadra_info(self, obj):
        if not obj.escuadra_id:
            return None
        esc = obj.escuadra
        return {
            "id": esc.id,
            "nombre": esc.nombre,
            "fecha": esc.fecha.isoformat() if esc.fecha else None,
        }


class OrdenAdicionalSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    prioridad_label = serializers.CharField(source="get_prioridad_display", read_only=True)
    agente_info = serializers.SerializerMethodField()
    supervisor_info = serializers.SerializerMethodField()

    class Meta:
        model = OrdenAdicional
        fields = [
            "id",
            "agente",
            "agente_info",
            "asignada_por",
            "supervisor_info",
            "tipo",
            "tipo_label",
            "titulo",
            "detalle",
            "lugar",
            "prioridad",
            "prioridad_label",
            "estado",
            "estado_label",
            "creado_en",
            "actualizado_en",
            "completada_en",
        ]
        read_only_fields = [
            "id",
            "agente_info",
            "asignada_por",
            "supervisor_info",
            "tipo_label",
            "prioridad_label",
            "estado_label",
            "creado_en",
            "actualizado_en",
            "completada_en",
        ]

    def get_agente_info(self, obj):
        return _user_label(obj.agente)

    def get_supervisor_info(self, obj):
        return _user_label(obj.asignada_por)


class InvolucradoExpedienteSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    genero_label = serializers.CharField(source="get_genero_display", read_only=True)
    estado_civil_label = serializers.CharField(
        source="get_estado_civil_display", read_only=True
    )
    tiene_foto = serializers.SerializerMethodField()
    edad = serializers.SerializerMethodField()

    class Meta:
        model = InvolucradoExpediente
        fields = [
            "id",
            "expediente",
            "tipo",
            "tipo_label",
            "nombres",
            "apellidos",
            "cedula",
            "fecha_nacimiento",
            "edad",
            "alias",
            "genero",
            "genero_label",
            "nacionalidad",
            "telefono",
            "direccion",
            "ocupacion",
            "estado_civil",
            "estado_civil_label",
            "observaciones",
            "foto_nombre",
            "foto_content_type",
            "tiene_foto",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "tipo_label",
            "genero_label",
            "estado_civil_label",
            "edad",
            "foto_nombre",
            "foto_content_type",
            "tiene_foto",
            "creado_en",
            "actualizado_en",
        ]

    def get_tiene_foto(self, obj):
        return bool(obj.foto_object_key)

    def get_edad(self, obj):
        if not obj.fecha_nacimiento:
            return None
        from datetime import date

        today = date.today()
        born = obj.fecha_nacimiento
        return today.year - born.year - (
            (today.month, today.day) < (born.month, born.day)
        )


class MovimientoCustodiaSerializer(serializers.ModelSerializer):
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCustodia
        fields = [
            "id",
            "evidencia",
            "entregado_por",
            "recibido_por",
            "destino",
            "motivo",
            "observaciones",
            "registrado_por",
            "registrado_por_nombre",
            "fecha_hora",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]

    def get_registrado_por_nombre(self, obj):
        return _user_label(obj.registrado_por)


class EvidenciaCasoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    categoria_fisica_label = serializers.CharField(
        source="get_categoria_fisica_display", read_only=True
    )
    estado_custodia_label = serializers.CharField(
        source="get_estado_custodia_display", read_only=True
    )
    url = serializers.SerializerMethodField()
    path_uri = serializers.SerializerMethodField()
    tamanio_mb = serializers.SerializerMethodField()
    categoria_media = serializers.SerializerMethodField()
    movimientos = MovimientoCustodiaSerializer(many=True, read_only=True)
    expediente_numero = serializers.CharField(
        source="expediente.numero_expediente", read_only=True, default=""
    )

    class Meta:
        model = EvidenciaCaso
        fields = [
            "id",
            "expediente",
            "expediente_numero",
            "tipo",
            "tipo_label",
            "codigo",
            "descripcion",
            "nombre_archivo",
            "content_type",
            "tamanio_bytes",
            "tamanio_mb",
            "bucket",
            "object_key",
            "path_uri",
            "sha256",
            "estado_custodia",
            "estado_custodia_label",
            "categoria_media",
            "url",
            "categoria_fisica",
            "categoria_fisica_label",
            "numero_serie",
            "peso",
            "caracteristicas",
            "custodio_actual",
            "ubicacion_actual",
            "movimientos",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "tipo_label",
            "categoria_fisica_label",
            "estado_custodia_label",
            "codigo",
            "nombre_archivo",
            "content_type",
            "tamanio_bytes",
            "tamanio_mb",
            "bucket",
            "object_key",
            "path_uri",
            "sha256",
            "categoria_media",
            "url",
            "expediente_numero",
            "movimientos",
            "creado_en",
            "actualizado_en",
        ]

    def get_url(self, obj):
        if not obj.object_key:
            return None
        from operativo.minio_service import get_presigned_url

        return get_presigned_url(obj.object_key, obj.bucket or None)

    def get_path_uri(self, obj):
        if not obj.object_key:
            return ""
        bucket = obj.bucket or "evidencias"
        return f"s3://{bucket}/{obj.object_key}"

    def get_tamanio_mb(self, obj):
        return round((obj.tamanio_bytes or 0) / (1024 * 1024), 3)

    def get_categoria_media(self, obj):
        ct = (obj.content_type or "").lower()
        if ct.startswith("image/"):
            return "Imagen"
        if ct.startswith("audio/"):
            return "Audio"
        if ct.startswith("video/"):
            return "Video"
        if "pdf" in ct or "document" in ct or "text" in ct:
            return "Documento"
        if obj.tipo == EvidenciaCaso.Tipo.FISICA:
            return obj.get_categoria_fisica_display() or "Física"
        return "Multimedia"


class BitacoraInvestigacionSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = BitacoraInvestigacion
        fields = [
            "id",
            "expediente",
            "tipo",
            "tipo_label",
            "fecha_hora",
            "lugar",
            "relato",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "tipo_label",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]

    def get_registrado_por_nombre(self, obj):
        return _user_label(obj.registrado_por)


class BienInvestigadoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = BienInvestigado
        fields = [
            "id",
            "expediente",
            "tipo",
            "tipo_label",
            "identificador",
            "descripcion",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "tipo_label",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]

    def get_registrado_por_nombre(self, obj):
        return _user_label(obj.registrado_por)


class SolicitudFiscalSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudFiscal
        fields = [
            "id",
            "expediente",
            "tipo",
            "tipo_label",
            "numero",
            "fundamento",
            "pedimento",
            "estado",
            "estado_label",
            "creado_por",
            "creado_por_nombre",
            "enviado_en",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "tipo_label",
            "estado_label",
            "numero",
            "creado_por",
            "creado_por_nombre",
            "enviado_en",
            "creado_en",
            "actualizado_en",
        ]

    def get_creado_por_nombre(self, obj):
        return _user_label(obj.creado_por)


class InformeInvestigativoSerializer(serializers.ModelSerializer):
    elaborado_por_nombre = serializers.SerializerMethodField()
    paquete_url = serializers.SerializerMethodField()

    class Meta:
        model = InformeInvestigativo
        fields = [
            "id",
            "expediente",
            "titulo",
            "contenido",
            "conclusiones",
            "elaborado_por",
            "elaborado_por_nombre",
            "paquete_bucket",
            "paquete_object_key",
            "paquete_url",
            "creado_en",
        ]
        read_only_fields = [
            "id",
            "elaborado_por",
            "elaborado_por_nombre",
            "paquete_bucket",
            "paquete_object_key",
            "paquete_url",
            "creado_en",
        ]

    def get_elaborado_por_nombre(self, obj):
        return _user_label(obj.elaborado_por)

    def get_paquete_url(self, obj):
        if not obj.paquete_object_key:
            return None
        from operativo.minio_service import get_presigned_url

        return get_presigned_url(obj.paquete_object_key, obj.paquete_bucket or None)


class ExpedienteCasoSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    prioridad_label = serializers.CharField(source="get_prioridad_display", read_only=True)
    origen_documento_label = serializers.CharField(
        source="get_origen_documento_display", read_only=True
    )
    tipo_delito_nombre = serializers.CharField(
        source="tipo_delito.nombre", read_only=True, default=None
    )
    tipo_delito_articulo = serializers.CharField(
        source="tipo_delito.articulo_penal", read_only=True, default=""
    )
    detective_info = serializers.SerializerMethodField()
    jefe_info = serializers.SerializerMethodField()
    involucrados = InvolucradoExpedienteSerializer(many=True, read_only=True)
    victima = serializers.SerializerMethodField()
    evidencias_count = serializers.SerializerMethodField()
    bitacora_count = serializers.SerializerMethodField()
    tiene_informe = serializers.SerializerMethodField()

    class Meta:
        model = ExpedienteCaso
        fields = [
            "id",
            "numero_expediente",
            "codigo_caso",
            "titulo",
            "descripcion",
            "estado",
            "estado_label",
            "prioridad",
            "prioridad_label",
            "detective_asignado",
            "detective_info",
            "jefe_asignador",
            "jefe_info",
            "tipo_delito",
            "tipo_delito_nombre",
            "tipo_delito_articulo",
            "origen_documento",
            "origen_documento_label",
            "parte_origen",
            "documento_base",
            "unidad",
            "fecha_hechos",
            "lugar",
            "observaciones",
            "bloqueado",
            "cerrado_en",
            "involucrados",
            "victima",
            "evidencias_count",
            "bitacora_count",
            "tiene_informe",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "numero_expediente",
            "codigo_caso",
            "estado_label",
            "prioridad_label",
            "origen_documento_label",
            "detective_info",
            "jefe_info",
            "tipo_delito_nombre",
            "tipo_delito_articulo",
            "bloqueado",
            "cerrado_en",
            "involucrados",
            "victima",
            "evidencias_count",
            "bitacora_count",
            "tiene_informe",
            "creado_en",
            "actualizado_en",
        ]

    def get_detective_info(self, obj):
        return _user_label(obj.detective_asignado)

    def get_jefe_info(self, obj):
        return _user_label(obj.jefe_asignador) if obj.jefe_asignador_id else None

    def get_victima(self, obj):
        prefs = ("VICTIMA", "DENUNCIANTE", "TESTIGO", "SOSPECHOSO")
        by_tipo = {i.tipo: i for i in obj.involucrados.all()}
        inv = None
        for t in prefs:
            if t in by_tipo:
                inv = by_tipo[t]
                break
        if not inv:
            inv = next(iter(obj.involucrados.all()), None)
        if not inv:
            return None
        return {
            "nombre": f"{inv.nombres} {inv.apellidos}".strip(),
            "cedula": inv.cedula or "",
            "tipo": inv.tipo,
            "tipo_label": inv.get_tipo_display(),
        }

    def get_evidencias_count(self, obj):
        return obj.evidencias.count()

    def get_bitacora_count(self, obj):
        return obj.bitacora.count()

    def get_tiene_informe(self, obj):
        return hasattr(obj, "informe_final")

    def create(self, validated_data):
        obj = ExpedienteCaso(**validated_data)
        obj.ensure_numero()
        obj.ensure_codigo_caso()
        obj.save()
        return obj
