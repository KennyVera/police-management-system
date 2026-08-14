"""URLs de facturación admin bajo admin/facturacion/."""

from django.urls import path

from .views import auditoria, facturas, pagos, reportes, suscripciones, vencimientos

urlpatterns = [
    path("suscripciones/", suscripciones.list_suscripciones),
    path("suscripciones/<int:pk>/renovar/", suscripciones.renovar_suscripcion),
    path("suscripciones/<int:pk>/periodo/", suscripciones.cambiar_periodo),
    path("suscripciones/<int:pk>/historial/", suscripciones.historial_suscripcion),
    path("pagos/", pagos.pagos_list_create),
    path("pagos/transacciones/", pagos.transacciones),
    path("pagos/<int:pk>/confirmar/", pagos.confirmar_pago),
    path("pagos/<int:pk>/reembolso/", pagos.reembolso_pago),
    path("facturas/", facturas.list_facturas),
    path("facturas/generar/", facturas.generar_factura),
    path("facturas/<int:pk>/anular/", facturas.anular_factura),
    path("facturas/<int:pk>/exportar/", facturas.exportar_factura),
    path("facturas/<int:pk>/historial/", facturas.historial_factura),
    path("vencimientos/proximos/", vencimientos.proximos),
    path("vencimientos/vencidas/", vencimientos.vencidas),
    path("vencimientos/alertas/", vencimientos.alertas),
    path("vencimientos/<int:institucion_id>/gracia/", vencimientos.set_gracia),
    path("vencimientos/historial/", vencimientos.historial_vencimientos),
    path("reportes/diario/", reportes.reporte_diario_view),
    path("reportes/mensual/", reportes.reporte_mensual_view),
    path("reportes/anual/", reportes.reporte_anual_view),
    path("reportes/pdf/", reportes.reporte_pdf_view),
    path("auditoria/", auditoria.list_auditoria),
]
