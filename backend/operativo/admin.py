from django.contrib import admin

from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    Escuadra,
    GestionHorario,
    MultimediaEvidencia,
    Notificacion,
    NovedadIncidente,
    OrdenAdicional,
    ParteAprehension,
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
