from django.contrib import admin

from saas_core.models import (
    ConfigAuditoria,
    ConfiguracionPlataforma,
    EventoFinanciero,
    Factura,
    Institucion,
    Pago,
    PlanSuscripcion,
    SuscripcionEvento,
)

admin.site.register(PlanSuscripcion)
admin.site.register(Institucion)
admin.site.register(SuscripcionEvento)
admin.site.register(Factura)
admin.site.register(Pago)
admin.site.register(EventoFinanciero)
admin.site.register(ConfiguracionPlataforma)
admin.site.register(ConfigAuditoria)
