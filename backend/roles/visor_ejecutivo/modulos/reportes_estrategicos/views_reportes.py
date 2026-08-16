"""
Reportes Estratégicos — Visor Ejecutivo (Alto Mando).

Stubs de generación PDF listos para conectar datos reales
(PostgreSQL + ClickHouse) y ampliar el diseño ReportLab.
"""

from __future__ import annotations

from django.contrib import messages
from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import render
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response

from accounts.models import SystemRole
from roles.visor_ejecutivo.modulos.reportes_estrategicos.pdf_reportes import (
    build_reporte_pdf,
)


class VisorEjecutivoOnly(BasePermission):
    """
    Solo VISOR_EJECUTIVO o is_superuser.
    Jefe de Zona / Supervisor / otros roles → 403.
    """

    message = "Acceso exclusivo del Visor Ejecutivo (Alto Mando)."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        if profile is None:
            return False
        return profile.role == SystemRole.VISOR_EJECUTIVO


REPORTES_CATALOGO = [
    {
        "slug": "dossier-presidencial",
        "titulo": "Dossier Presidencial",
        "descripcion": (
            "Resumen ejecutivo nacional, mapas de calor macro y tasa de "
            "criminalidad global para toma de decisión de gobierno."
        ),
        "icono": "account_balance",
        "fuentes": ["ClickHouse", "PostgreSQL"],
        "endpoint": "dossier-presidencial/",
        "filename_stub": "dossier_presidencial.pdf",
    },
    {
        "slug": "auditoria-comandantes",
        "titulo": "Auditoría de Desempeño de Comandantes",
        "descripcion": (
            "Ranking de eficiencia cruzando fuerza logística (Postgres) vs. "
            "resolución de delitos (ClickHouse)."
        ),
        "icono": "military_tech",
        "fuentes": ["PostgreSQL", "ClickHouse"],
        "endpoint": "auditoria-comandantes/",
        "filename_stub": "auditoria_comandantes.pdf",
    },
    {
        "slug": "impacto-presupuestario",
        "titulo": "Análisis de Impacto Presupuestario",
        "descripcion": (
            "Relación costo-beneficio entre inversión logística y reducción "
            "porcentual de la criminalidad."
        ),
        "icono": "payments",
        "fuentes": ["PostgreSQL", "ClickHouse"],
        "endpoint": "impacto-presupuestario/",
        "filename_stub": "impacto_presupuestario.pdf",
    },
    {
        "slug": "cuellos-botella",
        "titulo": "Informe de Cuellos de Botella (Impunidad)",
        "descripcion": (
            "Trazabilidad de tiempos muertos entre la creación del parte y "
            "su aprobación final."
        ),
        "icono": "hourglass_top",
        "fuentes": ["PostgreSQL"],
        "endpoint": "cuellos-botella/",
        "filename_stub": "cuellos_botella_impunidad.pdf",
    },
    {
        "slug": "desplazamiento-criminal",
        "titulo": "Reporte de Desplazamiento Criminal",
        "descripcion": (
            "Análisis macro-espacial para detectar migración delictiva entre "
            "zonas colindantes."
        ),
        "icono": "moving",
        "fuentes": ["ClickHouse"],
        "endpoint": "desplazamiento-criminal/",
        "filename_stub": "desplazamiento_criminal.pdf",
    },
]


def _user_is_visor(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    return bool(profile and profile.role == SystemRole.VISOR_EJECUTIVO)


def _pdf_response(reporte: dict, request) -> HttpResponse:
    pdf_bytes = build_reporte_pdf(reporte["slug"], request.user.get_username())
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{reporte["filename_stub"]}"'
    resp["Content-Length"] = str(len(pdf_bytes))
    resp["X-CrimeTrack-Report"] = reporte["slug"]
    resp["Cache-Control"] = "no-store"
    return resp


def _stub_payload(reporte: dict, request) -> dict:
    return {
        "status": "ready",
        "message": (
            f"Reporte «{reporte['titulo']}» generado con contenido ejecutivo "
            "(datos demo). Listo para conectar ClickHouse / PostgreSQL."
        ),
        "reporte": reporte["slug"],
        "titulo": reporte["titulo"],
        "fuentes": reporte["fuentes"],
        "formato": "pdf",
        "user": request.user.get_username(),
        "demo_content": True,
        "download": (
            f"/api/roles/visor_ejecutivo/reportes_estrategicos/{reporte['endpoint']}"
        ),
    }


def _stub_download_response(reporte: dict, request):
    """
    Por defecto descarga PDF válido.
    Si ?meta=1 → JSON informativo (sin archivo).
    """
    if (request.query_params.get("meta") or "").lower() in ("1", "true", "yes"):
        return Response(_stub_payload(reporte, request))
    return _pdf_response(reporte, request)


@require_GET
def reportes_ejecutivos_page(request):
    """Renderiza el catálogo HTML (Tailwind CDN) de reportes estratégicos."""
    if not _user_is_visor(request.user):
        if not request.user.is_authenticated:
            return HttpResponseForbidden("Autenticación requerida.")
        return HttpResponseForbidden(
            "HTTP 403 Forbidden — Solo Visor Ejecutivo / Alto Mando."
        )

    messages.info(
        request,
        "Catálogo de reportes estratégicos. Las descargas generan un PDF stub válido.",
    )
    return render(
        request,
        "visor_ejecutivo/reportes_ejecutivos.html",
        {
            "reportes": REPORTES_CATALOGO,
            "api_base": "/api/roles/visor_ejecutivo/reportes_estrategicos/",
        },
    )


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def catalogo_reportes(request):
    """Lista los 5 reportes de alto nivel disponibles para el Alto Mando."""
    return Response(
        {
            "role": "Visor Ejecutivo (Alto Mando)",
            "module": "reportes_estrategicos",
            "count": len(REPORTES_CATALOGO),
            "results": REPORTES_CATALOGO,
        }
    )


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def descargar_dossier_presidencial(request):
    return _stub_download_response(REPORTES_CATALOGO[0], request)


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def descargar_auditoria_comandantes(request):
    return _stub_download_response(REPORTES_CATALOGO[1], request)


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def descargar_impacto_presupuestario(request):
    return _stub_download_response(REPORTES_CATALOGO[2], request)


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def descargar_cuellos_botella(request):
    return _stub_download_response(REPORTES_CATALOGO[3], request)


@api_view(["GET"])
@permission_classes([VisorEjecutivoOnly])
def descargar_desplazamiento_criminal(request):
    return _stub_download_response(REPORTES_CATALOGO[4], request)
