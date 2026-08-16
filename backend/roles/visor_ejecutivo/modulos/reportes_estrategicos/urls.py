from django.urls import path

from .views import home
from .views_reportes import (
    catalogo_reportes,
    descargar_auditoria_comandantes,
    descargar_cuellos_botella,
    descargar_desplazamiento_criminal,
    descargar_dossier_presidencial,
    descargar_impacto_presupuestario,
    reportes_ejecutivos_page,
)

urlpatterns = [
    path("", home, name="visor_ejecutivo-reportes_estrategicos-home"),
    path("catalogo/", catalogo_reportes, name="visor_ejecutivo-reportes-catalogo"),
    # Maqueta HTML (Tailwind) — opcional / servidor
    path(
        "vista/",
        reportes_ejecutivos_page,
        name="visor_ejecutivo-reportes-vista-html",
    ),
    # Stubs de descarga PDF (conectar WeasyPrint / ReportLab después)
    path(
        "dossier-presidencial/",
        descargar_dossier_presidencial,
        name="visor_ejecutivo-descargar-dossier-presidencial",
    ),
    path(
        "auditoria-comandantes/",
        descargar_auditoria_comandantes,
        name="visor_ejecutivo-descargar-auditoria-comandantes",
    ),
    path(
        "impacto-presupuestario/",
        descargar_impacto_presupuestario,
        name="visor_ejecutivo-descargar-impacto-presupuestario",
    ),
    path(
        "cuellos-botella/",
        descargar_cuellos_botella,
        name="visor_ejecutivo-descargar-cuellos-botella",
    ),
    path(
        "desplazamiento-criminal/",
        descargar_desplazamiento_criminal,
        name="visor_ejecutivo-descargar-desplazamiento-criminal",
    ),
]
