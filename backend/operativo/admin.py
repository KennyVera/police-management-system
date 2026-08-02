from django.contrib import admin

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


@admin.register(ParteAprehension)
class ParteAprehensionAdmin(admin.ModelAdmin):
    list_display = ("id", "numero_caso", "estado_revision", "titulo", "lugar", "creado_por")
    list_filter = ("estado_revision", "bloqueado")
    search_fields = ("numero_caso", "titulo", "lugar")


@admin.register(NovedadIncidente)
class NovedadIncidenteAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "lugar", "fecha_hora", "creado_por")
    list_filter = ("tipo",)


@admin.register(MultimediaEvidencia)
class MultimediaEvidenciaAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre_archivo", "origen", "subido_por", "creado_en")
    list_filter = ("origen",)


@admin.register(AsignacionDiaria)
class AsignacionDiariaAdmin(admin.ModelAdmin):
    list_display = ("id", "agente", "fecha", "vehiculo_placa", "cuadrante", "activo")
    list_filter = ("fecha", "activo")


@admin.register(AlertaDespacho)
class AlertaDespachoAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "agente", "prioridad", "estado", "asignada_en")
    list_filter = ("estado", "prioridad", "origen")


@admin.register(OrdenAdicional)
class OrdenAdicionalAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "tipo", "agente", "estado", "prioridad", "creado_en")
    list_filter = ("tipo", "estado", "prioridad")


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "destinatario", "tipo", "leida", "creado_en")
    list_filter = ("tipo", "leida")


@admin.register(VehiculoFlota)
class VehiculoFlotaAdmin(admin.ModelAdmin):
    list_display = ("placa", "tipo", "activo")


@admin.register(Escuadra)
class EscuadraAdmin(admin.ModelAdmin):
    list_display = ("nombre", "fecha", "agente_lider", "vehiculo", "activo")
    filter_horizontal = ("companeros",)


@admin.register(GestionHorario)
class GestionHorarioAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "agente", "fecha", "estado")
    list_filter = ("tipo", "estado")


@admin.register(ExpedienteCaso)
class ExpedienteCasoAdmin(admin.ModelAdmin):
    list_display = (
        "numero_expediente",
        "titulo",
        "estado",
        "prioridad",
        "bloqueado",
        "detective_asignado",
    )
    list_filter = ("estado", "prioridad", "bloqueado", "origen_documento")
    search_fields = ("numero_expediente", "titulo")


@admin.register(InvolucradoExpediente)
class InvolucradoExpedienteAdmin(admin.ModelAdmin):
    list_display = ("id", "expediente", "tipo", "nombres", "apellidos", "cedula")
    list_filter = ("tipo",)


@admin.register(EvidenciaCaso)
class EvidenciaCasoAdmin(admin.ModelAdmin):
    list_display = ("codigo", "tipo", "expediente", "custodio_actual", "creado_en")
    list_filter = ("tipo", "categoria_fisica")


@admin.register(MovimientoCustodia)
class MovimientoCustodiaAdmin(admin.ModelAdmin):
    list_display = ("id", "evidencia", "destino", "recibido_por", "fecha_hora")


@admin.register(BitacoraInvestigacion)
class BitacoraInvestigacionAdmin(admin.ModelAdmin):
    list_display = ("id", "expediente", "tipo", "fecha_hora", "registrado_por")
    list_filter = ("tipo",)


@admin.register(BienInvestigado)
class BienInvestigadoAdmin(admin.ModelAdmin):
    list_display = ("id", "expediente", "tipo", "identificador")
    list_filter = ("tipo",)


@admin.register(SolicitudFiscal)
class SolicitudFiscalAdmin(admin.ModelAdmin):
    list_display = ("numero", "tipo", "estado", "expediente", "creado_en")
    list_filter = ("tipo", "estado")


@admin.register(InformeInvestigativo)
class InformeInvestigativoAdmin(admin.ModelAdmin):
    list_display = ("id", "expediente", "titulo", "elaborado_por", "creado_en")
