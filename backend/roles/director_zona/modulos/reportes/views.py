"""Reportes y rendición de cuentas local (PDF / Excel desde ClickHouse)."""

from __future__ import annotations

from datetime import date

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EsJefeDeZona
from roles.director_zona.reportes_service import (
    build_zone_report_excel,
    build_zone_report_pdf,
    collect_zone_report_data,
)
from roles.director_zona.scope import ZoneScopeError, zone_scope
from tactico.services.clickhouse_client import ClickHouseReadOnlyError


def _parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise ValueError(f"Parámetro '{field}' inválido. Use YYYY-MM-DD.") from exc


def _emisor_label(user) -> str:
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.username


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def reporte_preview(request):
    """Vista previa JSON del informe de zona (datos ClickHouse filtrados)."""
    try:
        scope = zone_scope(request.user)
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    audiencia = (request.query_params.get("audiencia") or "ALTO_MANDO").upper()
    if audiencia not in {"ALTO_MANDO", "AUTORIDADES_CIVILES"}:
        return Response(
            {"detail": "audiencia debe ser ALTO_MANDO o AUTORIDADES_CIVILES."},
            status=400,
        )

    try:
        data = collect_zone_report_data(
            scope,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            audiencia=audiencia,
        )
    except ClickHouseReadOnlyError as exc:
        return Response({"detail": str(exc)}, status=400)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    data["emisor"] = _emisor_label(request.user)
    return Response(data)


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def reporte_exportar(request):
    """
    Exporta el informe de zona.

    Query:
      - formato: pdf | excel
      - audiencia: ALTO_MANDO | AUTORIDADES_CIVILES
      - fecha_desde / fecha_hasta
    """
    try:
        scope = zone_scope(request.user)
        fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
        fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    formato = (request.query_params.get("formato") or "pdf").lower()
    audiencia = (request.query_params.get("audiencia") or "ALTO_MANDO").upper()
    if audiencia not in {"ALTO_MANDO", "AUTORIDADES_CIVILES"}:
        return Response({"detail": "audiencia inválida."}, status=400)
    if formato not in {"pdf", "excel", "xlsx"}:
        return Response({"detail": "formato debe ser pdf o excel."}, status=400)

    try:
        data = collect_zone_report_data(
            scope,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            audiencia=audiencia,
        )
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error consultando ClickHouse: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    emisor = _emisor_label(request.user)
    zona_slug = (scope.jurisdiccion_codigo or scope.jurisdiccion_nombre or "zona").replace(" ", "_")
    if audiencia == "ALTO_MANDO":
        titulo = f"Informe de zona — Rendición al Alto Mando ({scope.jurisdiccion_nombre})"
    else:
        titulo = (
            f"Estadísticas de seguridad territorial — "
            f"Autoridades civiles ({scope.jurisdiccion_nombre})"
        )

    if formato in {"excel", "xlsx"}:
        payload = build_zone_report_excel(data)
        filename = f"informe_zona_{zona_slug}.xlsx"
        response = HttpResponse(
            payload,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    else:
        payload = build_zone_report_pdf(data, titulo=titulo, emisor=emisor)
        filename = f"informe_zona_{zona_slug}.pdf"
        response = HttpResponse(payload, content_type="application/pdf")

    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Content-Length"] = str(len(payload))
    return response
