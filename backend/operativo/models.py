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
