from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class ParteAprehension(models.Model):
    class EstadoRevision(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        EN_REVISION = "EN_REVISION", "Pendiente de revisión"
        OBSERVADO = "OBSERVADO", "Rechazado"
        APROBADO = "APROBADO", "Aprobado"

    class Prioridad(models.TextChoices):
        BAJA = "BAJA", "Baja"
        MEDIA = "MEDIA", "Media"
        ALTA = "ALTA", "Alta"
        CRITICA = "CRITICA", "Crítica"

    class NivelRiesgo(models.TextChoices):
        BAJO = "BAJO", "Bajo"
        MEDIO = "MEDIO", "Medio"
        ALTO = "ALTO", "Alto"

    class FuenteReporte(models.TextChoices):
        LLAMADA_911 = "LLAMADA_911", "Llamada 911"
        DENUNCIA_PRESENCIAL = "DENUNCIA_PRESENCIAL", "Denuncia presencial"
        PATRULLAJE = "PATRULLAJE", "Patrullaje"
        SUPERVISOR = "SUPERVISOR", "Asignación de supervisor"
        OTRO = "OTRO", "Otro"

    class SiNo(models.TextChoices):
        SI = "SI", "Sí"
        NO = "NO", "No"
        DESCONOCIDO = "DESCONOCIDO", "Desconocido"

    creado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="partes_aprehension"
    )
    institucion = models.ForeignKey(
        "saas_core.Institucion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="partes",
        help_text="Aislamiento multi-tenant: hereda la institución del creador.",
    )
    alerta = models.ForeignKey(
        "AlertaDespacho",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="partes",
    )
    estado_revision = models.CharField(
        max_length=20,
        choices=EstadoRevision.choices,
        default=EstadoRevision.BORRADOR,
    )
    enviado_revision_en = models.DateTimeField(null=True, blank=True)

    # Identificación del caso
    numero_caso = models.CharField(max_length=40, unique=True, null=True, blank=True)
    titulo = models.CharField(max_length=200, blank=True)
    tipo_delito = models.ForeignKey(
        "catalogos.TipoDelito",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="partes",
    )
    codigo_iucr = models.CharField(max_length=20, blank=True)
    clasificacion_fbi = models.CharField(max_length=120, blank=True)

    fecha_hecho = models.DateField(null=True, blank=True)
    hora_hecho = models.TimeField(null=True, blank=True)
    # Compatibilidad con listados anteriores
    fecha_hora = models.DateTimeField()

    prioridad = models.CharField(
        max_length=20, choices=Prioridad.choices, default=Prioridad.MEDIA
    )
    nivel_riesgo = models.CharField(
        max_length=20, choices=NivelRiesgo.choices, default=NivelRiesgo.MEDIO
    )
    lugar = models.CharField(max_length=255)
    sector_zona = models.CharField(max_length=160, blank=True)
    descripcion = models.TextField(blank=True)
    # Alias histórico
    relato_hechos = models.TextField(blank=True)

    fuente_reporte = models.CharField(
        max_length=40,
        choices=FuenteReporte.choices,
        default=FuenteReporte.LLAMADA_911,
    )
    hay_heridos = models.CharField(
        max_length=20, choices=SiNo.choices, default=SiNo.DESCONOCIDO
    )
    hay_armas = models.CharField(
        max_length=20, choices=SiNo.choices, default=SiNo.DESCONOCIDO
    )
    estado_inicial = models.CharField(max_length=40, default="Clasificado")

    latitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)

    # Datos del detenido (opcionales; flagrancia)
    detenido_nombres = models.CharField(max_length=150, blank=True)
    detenido_apellidos = models.CharField(max_length=150, blank=True)
    detenido_cedula = models.CharField(max_length=20, blank=True)
    detenido_edad = models.PositiveSmallIntegerField(null=True, blank=True)
    derechos_leidos = models.BooleanField(default=False)
    observaciones = models.TextField(blank=True)

    # Revisión del supervisor
    motivo_rechazo = models.TextField(blank=True)
    rechazado_en = models.DateTimeField(null=True, blank=True)
    aprobado_en = models.DateTimeField(null=True, blank=True)
    revisado_por = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="partes_revisados",
    )
    bloqueado = models.BooleanField(default=False)
    pdf_bucket = models.CharField(max_length=120, blank=True)
    pdf_object_key = models.CharField(max_length=512, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name = "Parte de aprehensión"
        verbose_name_plural = "Partes de aprehensión"

    def __str__(self) -> str:
        return self.numero_caso or f"Parte {self.id}"

    def aplicar_catalogo_delito(self):
        if self.tipo_delito_id:
            self.codigo_iucr = self.tipo_delito.codigo_iucr or ""
            self.clasificacion_fbi = self.tipo_delito.clasificacion_fbi or ""

    def ensure_numero_caso(self):
        if self.numero_caso:
            return
        year = timezone.localdate().year
        prefix = f"HX-{year}-"
        last = (
            ParteAprehension.objects.filter(numero_caso__startswith=prefix)
            .order_by("-numero_caso")
            .values_list("numero_caso", flat=True)
            .first()
        )
        seq = 1
        if last:
            try:
                seq = int(str(last).split("-")[-1]) + 1
            except ValueError:
                seq = ParteAprehension.objects.count() + 1
        candidate = f"{prefix}{seq:04d}"
        while ParteAprehension.objects.filter(numero_caso=candidate).exists():
            seq += 1
            candidate = f"{prefix}{seq:04d}"
        self.numero_caso = candidate

    def save(self, *args, **kwargs):
        from datetime import datetime

        if self.fecha_hecho and self.hora_hecho:
            combined = datetime.combine(self.fecha_hecho, self.hora_hecho)
            self.fecha_hora = (
                timezone.make_aware(combined)
                if timezone.is_naive(combined)
                else combined
            )
        elif self.fecha_hora and (not self.fecha_hecho or not self.hora_hecho):
            local = timezone.localtime(self.fecha_hora)
            self.fecha_hecho = self.fecha_hecho or local.date()
            self.hora_hecho = self.hora_hecho or local.time().replace(microsecond=0)

        if self.descripcion and not self.relato_hechos:
            self.relato_hechos = self.descripcion
        elif self.relato_hechos and not self.descripcion:
            self.descripcion = self.relato_hechos

        self.aplicar_catalogo_delito()
        if not self.numero_caso:
            self.numero_caso = None
            self.ensure_numero_caso()
        if not self.institucion_id and self.creado_por_id:
            profile = getattr(self.creado_por, "profile", None)
            if profile and profile.institucion_id:
                self.institucion_id = profile.institucion_id
        super().save(*args, **kwargs)


class NovedadIncidente(models.Model):
    class TipoNovedad(models.TextChoices):
        CHOQUE_LEVE = "CHOQUE_LEVE", "Choque leve"
        RINA = "RINA", "Riña callejera"
        AUXILIO_MEDICO = "AUXILIO_MEDICO", "Auxilio médico"
        OTRO = "OTRO", "Otro incidente"

    creado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="novedades"
    )
    fecha_hora = models.DateTimeField()
    lugar = models.CharField(max_length=255)
    tipo = models.CharField(max_length=40, choices=TipoNovedad.choices)
    descripcion = models.TextField()
    hubo_detenidos = models.BooleanField(default=False)
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name = "Novedad / incidente"
        verbose_name_plural = "Novedades e incidentes"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} @ {self.lugar}"


class MultimediaEvidencia(models.Model):
    class Origen(models.TextChoices):
        PARTE = "PARTE", "Parte de aprehensión"
        NOVEDAD = "NOVEDAD", "Novedad / incidente"
        RAPIDA = "RAPIDA", "Captura rápida en calle"

    subido_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="evidencias_multimedia"
    )
    origen = models.CharField(max_length=20, choices=Origen.choices, default=Origen.RAPIDA)
    parte = models.ForeignKey(
        ParteAprehension,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="multimedia",
    )
    novedad = models.ForeignKey(
        NovedadIncidente,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="multimedia",
    )
    descripcion = models.CharField(max_length=255, blank=True)
    nombre_archivo = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    tamanio_bytes = models.PositiveIntegerField(default=0)
    bucket = models.CharField(max_length=120, default="")
    object_key = models.CharField(max_length=512)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evidencia multimedia"
        verbose_name_plural = "Evidencias multimedia"

    def __str__(self) -> str:
        return self.nombre_archivo


class AsignacionDiaria(models.Model):
    """Turno del día: compañero, vehículo y cuadrante de patrullaje."""

    agente = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="asignaciones_diarias"
    )
    companero = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asignaciones_como_companero",
    )
    supervisor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asignaciones_supervisadas",
    )
    fecha = models.DateField()
    escuadra = models.ForeignKey(
        "Escuadra",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asignaciones",
    )
    vehiculo = models.ForeignKey(
        "VehiculoFlota",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asignaciones",
    )
    vehiculo_placa = models.CharField(max_length=20)
    vehiculo_tipo = models.CharField(max_length=60, default="Patrulla")
    zona = models.ForeignKey(
        "organizacion.Jurisdiction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asignaciones_patrulla",
    )
    cuadrante = models.CharField(max_length=120)
    sector_detalle = models.CharField(max_length=255, blank=True)
    poligono = models.JSONField(
        null=True,
        blank=True,
        help_text="GeoJSON Polygon del área de patrullaje (coordenadas [lng, lat]).",
    )
    turno_inicio = models.TimeField()
    turno_fin = models.TimeField()
    hora_formacion_real = models.TimeField(null=True, blank=True)
    hora_salida_real = models.TimeField(null=True, blank=True)
    # Posición operativa de la unidad (mapa)
    unidad_label = models.CharField(max_length=80, default="Unidad móvil")
    latitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    observaciones = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "-creado_en"]
        verbose_name = "Asignación diaria"
        verbose_name_plural = "Asignaciones diarias"
        constraints = [
            models.UniqueConstraint(
                fields=["agente", "fecha"],
                condition=models.Q(activo=True),
                name="uniq_asignacion_activa_agente_fecha",
            )
        ]

    def __str__(self) -> str:
        return f"{self.agente} — {self.fecha} ({self.cuadrante})"


class AlertaDespacho(models.Model):
    """Alerta tipo ECU-911 / Uber asignada por el supervisor."""

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente de asignación"
        ASIGNADA = "ASIGNADA", "Asignada"
        EN_CAMINO = "EN_CAMINO", "En camino"
        EN_LUGAR = "EN_LUGAR", "En el lugar"
        CERRADA = "CERRADA", "Cerrada"
        CANCELADA = "CANCELADA", "Cancelada"

    class Prioridad(models.TextChoices):
        ALTA = "ALTA", "Alta"
        MEDIA = "MEDIA", "Media"
        BAJA = "BAJA", "Baja"

    agente = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="alertas_despacho",
    )
    escuadra = models.ForeignKey(
        "Escuadra",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="alertas_despacho",
        help_text="Escuadra asignada al auxilio (todos los integrantes reciben la alerta).",
    )
    asignada_por = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="alertas_asignadas",
    )
    titulo = models.CharField(max_length=180)
    descripcion = models.TextField(blank=True)
    direccion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=255, blank=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitud = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    origen = models.CharField(max_length=40, default="ECU-911")
    prioridad = models.CharField(
        max_length=10, choices=Prioridad.choices, default=Prioridad.ALTA
    )
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )
    asignada_en = models.DateTimeField(auto_now_add=True)
    en_camino_en = models.DateTimeField(null=True, blank=True)
    llegada_en = models.DateTimeField(null=True, blank=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-asignada_en"]
        verbose_name = "Alerta de despacho"
        verbose_name_plural = "Alertas de despacho"

    def __str__(self) -> str:
        destino = self.agente or "sin asignar"
        return f"{self.titulo} → {destino}"


class OrdenAdicional(models.Model):
    """Tareas operativas extras (custodia, traslados, etc.)."""

    class Tipo(models.TextChoices):
        CUSTODIA = "CUSTODIA", "Custodia de detenido"
        TRASLADO_EVIDENCIA = "TRASLADO_EVIDENCIA", "Traslado de evidencias"
        APOYO = "APOYO", "Apoyo operativo"
        OTRO = "OTRO", "Otro"

    class Estado(models.TextChoices):
        ASIGNADA = "ASIGNADA", "Asignada"
        EN_CURSO = "EN_CURSO", "En curso"
        COMPLETADA = "COMPLETADA", "Completada"
        CANCELADA = "CANCELADA", "Cancelada"

    class Prioridad(models.TextChoices):
        ALTA = "ALTA", "Alta"
        MEDIA = "MEDIA", "Media"
        BAJA = "BAJA", "Baja"

    agente = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="ordenes_adicionales"
    )
    asignada_por = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ordenes_asignadas",
    )
    tipo = models.CharField(max_length=30, choices=Tipo.choices, default=Tipo.OTRO)
    titulo = models.CharField(max_length=180)
    detalle = models.TextField()
    lugar = models.CharField(max_length=255, blank=True)
    prioridad = models.CharField(
        max_length=10, choices=Prioridad.choices, default=Prioridad.MEDIA
    )
    estado = models.CharField(
        max_length=20, choices=Estado.choices, default=Estado.ASIGNADA
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    completada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Orden adicional"
        verbose_name_plural = "Órdenes adicionales"

    def __str__(self) -> str:
        return f"{self.titulo} → {self.agente}"


class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        PARTE_RECHAZADO = "PARTE_RECHAZADO", "Parte rechazado"
        PARTE_APROBADO = "PARTE_APROBADO", "Parte aprobado"
        EXPEDIENTE_ASIGNADO = "EXPEDIENTE_ASIGNADO", "Expediente asignado"
        DISPOSICION_ZONA = "DISPOSICION_ZONA", "Disposición de zona"
        ALERTA = "ALERTA", "Alerta"
        SISTEMA = "SISTEMA", "Sistema"

    destinatario = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notificaciones"
    )
    tipo = models.CharField(max_length=40, choices=Tipo.choices, default=Tipo.SISTEMA)
    titulo = models.CharField(max_length=180)
    mensaje = models.TextField()
    leida = models.BooleanField(default=False)
    parte = models.ForeignKey(
        ParteAprehension,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notificaciones",
    )
    enlace = models.CharField(max_length=255, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    leida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Notificación"
        verbose_name_plural = "Notificaciones"

    def __str__(self) -> str:
        return f"{self.titulo} → {self.destinatario}"


class VehiculoFlota(models.Model):
    class TipoVehiculo(models.TextChoices):
        AUTOMOVIL = "AUTOMOVIL", "Automóvil"
        CAMIONETA = "CAMIONETA", "Camioneta"
        MOTO = "MOTO", "Motocicleta"
        BLINDADO = "BLINDADO", "Blindado"
        FURGON = "FURGON", "Furgón"
        HELICOPTERO = "HELICOPTERO", "Helicóptero"
        # legado (datos antiguos)
        PATRULLA = "PATRULLA", "Patrullero"
        OTRO = "OTRO", "Otro"

    placa = models.CharField(max_length=20, unique=True)
    tipo = models.CharField(
        max_length=20, choices=TipoVehiculo.choices, default=TipoVehiculo.AUTOMOVIL
    )
    descripcion = models.CharField(max_length=160, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["placa"]
        verbose_name = "Vehículo de flota"
        verbose_name_plural = "Vehículos de flota"

    def __str__(self) -> str:
        return f"{self.placa} ({self.get_tipo_display()})"


class Escuadra(models.Model):
    """Grupo de trabajo diario (quién patrulla con quién)."""

    nombre = models.CharField(max_length=120)
    fecha = models.DateField()
    supervisor = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="escuadras_creadas"
    )
    agente_lider = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="escuadras_como_lider"
    )
    companeros = models.ManyToManyField(
        User,
        blank=True,
        related_name="escuadras_como_companero",
    )
    vehiculo = models.ForeignKey(
        "VehiculoFlota",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="escuadras",
    )
    observaciones = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "nombre"]
        verbose_name = "Escuadra"
        verbose_name_plural = "Escuadras"

    def __str__(self) -> str:
        return f"{self.nombre} ({self.fecha})"


class GestionHorario(models.Model):
    """Cambios de turno, formación/salida y permisos/ausencias."""

    class Tipo(models.TextChoices):
        CAMBIO_TURNO = "CAMBIO_TURNO", "Cambio de turno"
        FORMACION = "FORMACION", "Formación / salida"
        PERMISO_MEDICO = "PERMISO_MEDICO", "Permiso médico"
        AUSENCIA = "AUSENCIA", "Ausencia corta"
        OTRO = "OTRO", "Otro"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADO = "APROBADO", "Aprobado"
        RECHAZADO = "RECHAZADO", "Rechazado"

    agente = models.ForeignKey(User, on_delete=models.PROTECT, related_name="gestiones_horario")
    supervisor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="gestiones_horario_revisadas",
    )
    fecha = models.DateField()
    tipo = models.CharField(max_length=30, choices=Tipo.choices)
    detalle = models.TextField()
    hora_formacion = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    respuesta = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "-creado_en"]
        verbose_name = "Gestión de horario"
        verbose_name_plural = "Gestiones de horario"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} — {self.agente} ({self.fecha})"


class ExpedienteCaso(models.Model):
    """Carpeta digital de investigación asignada a un detective."""

    class Estado(models.TextChoices):
        INDAGACION_PREVIA = "INDAGACION_PREVIA", "En Indagación Previa"
        INSTRUCCION_FISCAL = "INSTRUCCION_FISCAL", "En Instrucción Fiscal"
        CERRADO = "CERRADO", "Cerrado / Enviado a Fiscalía"
        SUSPENDIDO = "SUSPENDIDO", "Suspendido"

    class Prioridad(models.TextChoices):
        BAJA = "BAJA", "Baja"
        MEDIA = "MEDIA", "Media"
        ALTA = "ALTA", "Alta"
        CRITICA = "CRITICA", "Crítica"

    class OrigenDocumento(models.TextChoices):
        PARTE_APREHENSION = "PARTE_APREHENSION", "Parte de aprehensión"
        DENUNCIA_CIUDADANA = "DENUNCIA_CIUDADANA", "Denuncia ciudadana (Fiscalía)"
        OTRO = "OTRO", "Otro"

    numero_expediente = models.CharField(max_length=40, unique=True, null=True, blank=True)
    codigo_caso = models.CharField(
        max_length=40,
        blank=True,
        help_text="Código de caso remitido por Fiscalía (ej. CAS-2026-0001).",
    )
    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)
    estado = models.CharField(
        max_length=30, choices=Estado.choices, default=Estado.INDAGACION_PREVIA
    )
    prioridad = models.CharField(
        max_length=20, choices=Prioridad.choices, default=Prioridad.MEDIA
    )
    detective_asignado = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="expedientes_asignados"
    )
    institucion = models.ForeignKey(
        "saas_core.Institucion",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="expedientes",
        help_text="Aislamiento multi-tenant: hereda del detective / creador.",
    )
    jefe_asignador = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="expedientes_asignados_por",
    )
    tipo_delito = models.ForeignKey(
        "catalogos.TipoDelito",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="expedientes",
    )
    origen_documento = models.CharField(
        max_length=30,
        choices=OrigenDocumento.choices,
        default=OrigenDocumento.DENUNCIA_CIUDADANA,
    )
    parte_origen = models.ForeignKey(
        "ParteAprehension",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="expedientes",
    )
    documento_base = models.TextField(
        blank=True,
        help_text="Texto del parte aprobado o denuncia ciudadana que abre el caso.",
    )
    unidad = models.CharField(
        max_length=120,
        blank=True,
        default="Policía Judicial",
        help_text="Unidad / dependencia que remite o investiga el caso.",
    )
    fecha_hechos = models.DateField(null=True, blank=True)
    lugar = models.CharField(max_length=255, blank=True)
    observaciones = models.TextField(blank=True)
    bloqueado = models.BooleanField(default=False)
    cerrado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-actualizado_en"]
        verbose_name = "Expediente / caso"
        verbose_name_plural = "Expedientes / casos"

    def __str__(self) -> str:
        return self.numero_expediente or f"Expediente {self.id}"

    def ensure_numero(self):
        if self.numero_expediente:
            return
        year = timezone.localdate().year
        seq = ExpedienteCaso.objects.filter(
            numero_expediente__startswith=f"EXP-{year}-"
        ).count() + 1
        self.numero_expediente = f"EXP-{year}-{seq:04d}"

    def ensure_codigo_caso(self):
        if self.codigo_caso:
            return
        year = timezone.localdate().year
        seq = ExpedienteCaso.objects.filter(
            codigo_caso__startswith=f"CAS-{year}-"
        ).count() + 1
        self.codigo_caso = f"CAS-{year}-{seq:04d}"

    def save(self, *args, **kwargs):
        if not self.institucion_id:
            owner = None
            if self.detective_asignado_id:
                owner = self.detective_asignado
            elif self.jefe_asignador_id:
                owner = self.jefe_asignador
            profile = getattr(owner, "profile", None) if owner else None
            if profile and profile.institucion_id:
                self.institucion_id = profile.institucion_id
            elif self.parte_origen_id and self.parte_origen.institucion_id:
                self.institucion_id = self.parte_origen.institucion_id
        if not self.numero_expediente:
            self.ensure_numero()
        if not self.codigo_caso:
            self.ensure_codigo_caso()
        super().save(*args, **kwargs)

class InvolucradoExpediente(models.Model):
    class Tipo(models.TextChoices):
        SOSPECHOSO = "SOSPECHOSO", "Sospechoso"
        VICTIMA = "VICTIMA", "Víctima"
        DENUNCIANTE = "DENUNCIANTE", "Denunciante"
        TESTIGO = "TESTIGO", "Testigo"

    class Genero(models.TextChoices):
        NO_ESPECIFICADO = "NO_ESPECIFICADO", "No especificado"
        MASCULINO = "MASCULINO", "Masculino"
        FEMENINO = "FEMENINO", "Femenino"
        OTRO = "OTRO", "Otro"

    class EstadoCivil(models.TextChoices):
        NO_REGISTRADO = "NO_REGISTRADO", "No registrado"
        SOLTERO = "SOLTERO", "Soltero/a"
        CASADO = "CASADO", "Casado/a"
        DIVORCIADO = "DIVORCIADO", "Divorciado/a"
        VIUDO = "VIUDO", "Viudo/a"
        UNION = "UNION", "Unión de hecho"

    expediente = models.ForeignKey(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="involucrados"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    nombres = models.CharField(max_length=150)
    apellidos = models.CharField(max_length=150, blank=True)
    cedula = models.CharField(max_length=20, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    alias = models.CharField(max_length=120, blank=True)
    genero = models.CharField(
        max_length=20, choices=Genero.choices, default=Genero.NO_ESPECIFICADO
    )
    nacionalidad = models.CharField(max_length=80, blank=True)
    telefono = models.CharField(max_length=40, blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    ocupacion = models.CharField(max_length=120, blank=True)
    estado_civil = models.CharField(
        max_length=20, choices=EstadoCivil.choices, default=EstadoCivil.NO_REGISTRADO
    )
    observaciones = models.TextField(blank=True)
    # Foto de perfil (MinIO)
    foto_nombre = models.CharField(max_length=255, blank=True)
    foto_content_type = models.CharField(max_length=120, blank=True)
    foto_bucket = models.CharField(max_length=120, blank=True)
    foto_object_key = models.CharField(max_length=512, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tipo", "apellidos", "nombres"]
        verbose_name = "Involucrado de expediente"
        verbose_name_plural = "Involucrados de expediente"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()}: {self.nombres} {self.apellidos}".strip()


class EvidenciaCaso(models.Model):
    class Tipo(models.TextChoices):
        DIGITAL = "DIGITAL", "Evidencia digital"
        FISICA = "FISICA", "Evidencia física"

    class CategoriaFisica(models.TextChoices):
        ARMA = "ARMA", "Arma"
        DROGA = "DROGA", "Droga"
        VEHICULO = "VEHICULO", "Vehículo"
        CELULAR = "CELULAR", "Celular"
        DOCUMENTO = "DOCUMENTO", "Documento"
        OTRO = "OTRO", "Otro"

    class EstadoCustodia(models.TextChoices):
        EN_CUSTODIA = "EN_CUSTODIA", "En custodia"
        LABORATORIO = "LABORATORIO", "En laboratorio"
        FISCALIA = "FISCALIA", "Remitida a Fiscalía"
        ARCHIVO = "ARCHIVO", "Archivada"
        BAJA = "BAJA", "Dada de baja"

    expediente = models.ForeignKey(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="evidencias"
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    codigo = models.CharField(max_length=40, blank=True)
    descripcion = models.TextField()
    # Digital (MinIO)
    nombre_archivo = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=120, blank=True)
    tamanio_bytes = models.PositiveIntegerField(default=0)
    bucket = models.CharField(max_length=120, blank=True)
    object_key = models.CharField(max_length=512, blank=True)
    sha256 = models.CharField(max_length=64, blank=True)
    estado_custodia = models.CharField(
        max_length=20,
        choices=EstadoCustodia.choices,
        default=EstadoCustodia.EN_CUSTODIA,
    )
    # Física
    categoria_fisica = models.CharField(
        max_length=20, choices=CategoriaFisica.choices, blank=True
    )
    numero_serie = models.CharField(max_length=120, blank=True)
    peso = models.CharField(max_length=60, blank=True)
    caracteristicas = models.TextField(blank=True)
    custodio_actual = models.CharField(max_length=200, blank=True)
    ubicacion_actual = models.CharField(max_length=200, blank=True)
    registrado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="evidencias_registradas"
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evidencia de caso"
        verbose_name_plural = "Evidencias de caso"

    def __str__(self) -> str:
        return self.codigo or f"Evidencia {self.id}"

    def ensure_codigo(self):
        if self.codigo:
            return
        pref = "DIG" if self.tipo == self.Tipo.DIGITAL else "FIS"
        self.codigo = f"{pref}-{self.expediente_id or 0}-{timezone.now().strftime('%y%m%d%H%M%S')}"


class MovimientoCustodia(models.Model):
    evidencia = models.ForeignKey(
        EvidenciaCaso, on_delete=models.CASCADE, related_name="movimientos"
    )
    entregado_por = models.CharField(max_length=200)
    recibido_por = models.CharField(max_length=200)
    destino = models.CharField(max_length=200)
    motivo = models.CharField(max_length=255)
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="movimientos_custodia"
    )
    fecha_hora = models.DateTimeField(default=timezone.now)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_hora", "-id"]
        verbose_name = "Movimiento de custodia"
        verbose_name_plural = "Movimientos de custodia"

    def __str__(self) -> str:
        return f"{self.evidencia_id} → {self.destino} ({self.fecha_hora})"


class BitacoraInvestigacion(models.Model):
    """Acciones diarias del detective sobre un expediente."""

    class TipoAccion(models.TextChoices):
        VIGILANCIA = "VIGILANCIA", "Vigilancia"
        ENTREVISTA = "ENTREVISTA", "Entrevista a testigo"
        DILIGENCIA = "DILIGENCIA", "Diligencia de campo"
        ANALISIS = "ANALISIS", "Análisis documental"
        OTRO = "OTRO", "Otro"

    expediente = models.ForeignKey(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="bitacora"
    )
    tipo = models.CharField(max_length=20, choices=TipoAccion.choices, default=TipoAccion.DILIGENCIA)
    fecha_hora = models.DateTimeField(default=timezone.now)
    lugar = models.CharField(max_length=255, blank=True)
    relato = models.TextField()
    registrado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="bitacoras_investigacion"
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_hora", "-id"]
        verbose_name = "Entrada de bitácora"
        verbose_name_plural = "Bitácora de investigación"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} · {self.expediente_id}"


class BienInvestigado(models.Model):
    """Vehículos o inmuebles vinculados a la investigación."""

    class TipoBien(models.TextChoices):
        VEHICULO = "VEHICULO", "Vehículo"
        INMUEBLE = "INMUEBLE", "Inmueble"
        OTRO = "OTRO", "Otro"

    expediente = models.ForeignKey(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="bienes"
    )
    tipo = models.CharField(max_length=20, choices=TipoBien.choices)
    identificador = models.CharField(
        max_length=120, help_text="Placa, matrícula, dirección catastral, etc."
    )
    descripcion = models.TextField(blank=True)
    registrado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="bienes_investigados"
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Bien investigado"
        verbose_name_plural = "Bienes investigados"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()}: {self.identificador}"


class SolicitudFiscal(models.Model):
    """Solicitudes estandarizadas a juez/fiscal."""

    class TipoSolicitud(models.TextChoices):
        ALLANAMIENTO = "ALLANAMIENTO", "Orden de allanamiento"
        INTERCEPTACION = "INTERCEPTACION", "Interceptación de llamadas"
        SIGILO_BANCARIO = "SIGILO_BANCARIO", "Levantamiento de sigilo bancario"
        OTRO = "OTRO", "Otra solicitud"

    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        ENVIADA = "ENVIADA", "Enviada a Fiscalía"
        RESPONDIDA = "RESPONDIDA", "Respondida"

    expediente = models.ForeignKey(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="solicitudes_fiscal"
    )
    tipo = models.CharField(max_length=30, choices=TipoSolicitud.choices)
    numero = models.CharField(max_length=40, blank=True)
    fundamento = models.TextField()
    pedimento = models.TextField(
        help_text="Texto formal de lo que se solicita al juez/fiscal."
    )
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.BORRADOR)
    creado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="solicitudes_fiscal"
    )
    enviado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Solicitud a Fiscalía"
        verbose_name_plural = "Solicitudes a Fiscalía"

    def __str__(self) -> str:
        return self.numero or f"Solicitud {self.id}"

    def ensure_numero(self):
        if self.numero:
            return
        self.numero = f"SF-{timezone.now().strftime('%Y%m%d')}-{self.expediente_id or 0}-{self.id or 0}"


class InformeInvestigativo(models.Model):
    """Informe final que cierra el expediente y se envía a Fiscalía."""

    expediente = models.OneToOneField(
        ExpedienteCaso, on_delete=models.CASCADE, related_name="informe_final"
    )
    titulo = models.CharField(max_length=200, default="Informe Investigativo Final")
    contenido = models.TextField()
    conclusiones = models.TextField(blank=True)
    elaborado_por = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="informes_investigativos"
    )
    paquete_bucket = models.CharField(max_length=120, blank=True)
    paquete_object_key = models.CharField(max_length=512, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Informe investigativo"
        verbose_name_plural = "Informes investigativos"

    def __str__(self) -> str:
        return f"Informe {self.expediente_id}"


class EvaluacionSupervisor(models.Model):
    """Calificación / anotación del Jefe de Zona sobre un Supervisor de Unidad."""

    evaluador = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="evaluaciones_emitidas"
    )
    supervisor = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="evaluaciones_recibidas"
    )
    calificacion = models.PositiveSmallIntegerField(
        help_text="Escala 1–5",
    )
    anotacion = models.TextField(blank=True)
    periodo = models.CharField(
        max_length=40,
        blank=True,
        help_text="Etiqueta de periodo, ej. 2026-08 o Trimestre 3.",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Evaluación de supervisor"
        verbose_name_plural = "Evaluaciones de supervisores"

    def __str__(self) -> str:
        return f"{self.supervisor_id} → {self.calificacion}/5"


class DisposicionZona(models.Model):
    """Memorando / instrucción obligatoria del Jefe de Zona hacia su personal."""

    class Tipo(models.TextChoices):
        MEMORANDO = "MEMORANDO", "Memorando"
        INSTRUCCION = "INSTRUCCION", "Instrucción operativa"
        DISPOSICION = "DISPOSICION", "Disposición directa"
        COMUNICADO = "COMUNICADO", "Comunicado"

    class Prioridad(models.TextChoices):
        NORMAL = "NORMAL", "Normal"
        ALTA = "ALTA", "Alta"
        URGENTE = "URGENTE", "Urgente / prioritaria"

    emisor = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="disposiciones_emitidas"
    )
    jurisdiccion = models.ForeignKey(
        "organizacion.Jurisdiction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="disposiciones",
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.DISPOSICION)
    prioridad = models.CharField(
        max_length=20, choices=Prioridad.choices, default=Prioridad.ALTA
    )
    titulo = models.CharField(max_length=200)
    cuerpo = models.TextField()
    destinatarios_count = models.PositiveIntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Disposición de zona"
        verbose_name_plural = "Disposiciones de zona"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()}: {self.titulo}"
