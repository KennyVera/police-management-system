"""Reportes y rendición de cuentas local (PDF / Excel desde ClickHouse)."""

from __future__ import annotations

from datetime import date

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EsJefeDeZona
from roles.director_zona.reportes_service import (
    build_dashboard_snapshot_pdf,
    build_mapa_calor_pdf,
    build_ranking_distritos_pdf,
    build_zone_report_excel,
    build_zone_report_pdf,
    collect_zone_report_data,
)
from roles.director_zona.scope import ZoneScopeError, zone_scope
from tactico.services import panel_queries as panel
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


@api_view(["GET", "POST"])
@permission_classes([EsJefeDeZona])
def dashboard_exportar_pdf(request):
    """
    Exporta un snapshot PDF del Dashboard según la pestaña activa.

    Body POST opcional:
      - vista: "delitos" | "mapa" | "ranking" (default delitos)
      - panel: snapshot del panel (vista delitos / ranking)
      - mapa: { puntos, total_puntos } (vista mapa)
      - radar: reloj criminológico (vista mapa)
      - ranking: ranking_eficiencia (vista ranking)
      - filtros: fecha_desde, fecha_hasta, distrito, tipo_delito
    """
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    payload_in = request.data if request.method == "POST" and isinstance(request.data, dict) else {}
    vista = (payload_in.get("vista") or request.query_params.get("vista") or "delitos").lower()
    if vista in {"mapa_calor", "mapa-calor", "heat"}:
        vista = "mapa"
    if vista in {"ranking_distritos", "ranking-distritos", "leaderboard"}:
        vista = "ranking"
    if vista not in {"delitos", "mapa", "ranking"}:
        return Response(
            {"detail": "vista debe ser 'delitos', 'mapa' o 'ranking'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    juris = {
        "id": scope.jurisdiccion_id,
        "nombre": scope.jurisdiccion_nombre,
        "codigo": scope.jurisdiccion_codigo,
    }
    emisor = _emisor_label(request.user)
    zona_slug = (scope.jurisdiccion_codigo or scope.jurisdiccion_nombre or "zona").replace(" ", "_")

    # ——— Mapa de calor ———
    if vista == "mapa":
        filtros = payload_in.get("filtros") if isinstance(payload_in.get("filtros"), dict) else {}
        try:
            fecha_desde = _parse_date(
                filtros.get("fecha_desde") or request.query_params.get("fecha_desde"),
                "fecha_desde",
            )
            fecha_hasta = _parse_date(
                filtros.get("fecha_hasta") or request.query_params.get("fecha_hasta"),
                "fecha_hasta",
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if fecha_hasta is None:
            fecha_hasta = date.today()
        if fecha_desde is None:
            from datetime import timedelta

            fecha_desde = fecha_hasta - timedelta(days=30)

        distrito = (filtros.get("distrito") or request.query_params.get("distrito") or "").strip()
        tipo = (filtros.get("tipo_delito") or request.query_params.get("tipo_delito") or "").strip()
        filtros_out = {
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
            "distrito": distrito or None,
            "tipo_delito": tipo or None,
        }

        mapa_data = payload_in.get("mapa") if isinstance(payload_in.get("mapa"), dict) else None
        radar_data = payload_in.get("radar") if isinstance(payload_in.get("radar"), dict) else None

        if mapa_data is None or mapa_data.get("puntos") is None:
            try:
                puntos = panel.mapa_puntos(
                    scope,
                    fecha_desde,
                    fecha_hasta,
                    distrito=distrito,
                    tipo_delito=tipo,
                    limit=2000,
                )
                mapa_data = {"total_puntos": len(puntos), "puntos": puntos}
            except ClickHouseReadOnlyError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as exc:  # noqa: BLE001
                return Response(
                    {"detail": f"Error consultando mapa de calor: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        if radar_data is None:
            # Preferir radar del panel enviado; si no, calcularlo
            panel_snap = payload_in.get("panel") if isinstance(payload_in.get("panel"), dict) else {}
            radar_data = panel_snap.get("radar") if isinstance(panel_snap.get("radar"), dict) else None
        if radar_data is None:
            try:
                radar_data = panel.radar_cronologia(
                    scope,
                    fecha_desde,
                    fecha_hasta,
                    distrito=distrito,
                    tipo_delito=tipo,
                )
            except Exception:  # noqa: BLE001
                radar_data = {"dias": [], "picos": []}

        try:
            pdf_bytes = build_mapa_calor_pdf(
                emisor=emisor,
                jurisdiccion=juris,
                filtros=filtros_out,
                mapa=mapa_data,
                radar=radar_data,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Error generando PDF de mapa: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        filename = f"mapa_calor_{zona_slug}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(pdf_bytes))
        return response

    # ——— Ranking distritos ———
    if vista == "ranking":
        filtros = payload_in.get("filtros") if isinstance(payload_in.get("filtros"), dict) else {}
        try:
            fecha_desde = _parse_date(
                filtros.get("fecha_desde") or request.query_params.get("fecha_desde"),
                "fecha_desde",
            )
            fecha_hasta = _parse_date(
                filtros.get("fecha_hasta") or request.query_params.get("fecha_hasta"),
                "fecha_hasta",
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if fecha_hasta is None:
            fecha_hasta = date.today()
        if fecha_desde is None:
            from datetime import timedelta

            fecha_desde = fecha_hasta - timedelta(days=30)

        distrito = (filtros.get("distrito") or request.query_params.get("distrito") or "").strip()
        tipo = (filtros.get("tipo_delito") or request.query_params.get("tipo_delito") or "").strip()
        filtros_out = {
            "fecha_desde": fecha_desde.isoformat(),
            "fecha_hasta": fecha_hasta.isoformat(),
            "distrito": distrito or None,
            "tipo_delito": tipo or None,
        }

        ranking_data = payload_in.get("ranking")
        if not isinstance(ranking_data, list):
            panel_snap = payload_in.get("panel") if isinstance(payload_in.get("panel"), dict) else {}
            ranking_data = panel_snap.get("ranking_eficiencia")
        if not isinstance(ranking_data, list):
            try:
                ranking_data = panel.ranking_eficiencia(
                    scope,
                    fecha_desde,
                    fecha_hasta,
                    distrito=distrito,
                    tipo_delito=tipo,
                )
            except Exception as exc:  # noqa: BLE001
                return Response(
                    {"detail": f"Error consultando ranking: {exc}"},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        try:
            pdf_bytes = build_ranking_distritos_pdf(
                emisor=emisor,
                jurisdiccion=juris,
                filtros=filtros_out,
                ranking=ranking_data,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Error generando PDF de ranking: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        filename = f"ranking_distritos_{zona_slug}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(pdf_bytes))
        return response

    # ——— Delitos locales (panel principal) ———
    panel_data = None
    if isinstance(payload_in.get("panel"), dict) and payload_in["panel"].get("kpis") is not None:
        panel_data = {
            **payload_in["panel"],
            "jurisdiccion": juris,
        }

    if panel_data is None:
        try:
            fecha_desde = _parse_date(request.query_params.get("fecha_desde"), "fecha_desde")
            fecha_hasta = _parse_date(request.query_params.get("fecha_hasta"), "fecha_hasta")
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        distrito = (request.query_params.get("distrito") or "").strip()
        tipo = (request.query_params.get("tipo_delito") or "").strip()
        filtros = payload_in.get("filtros") or {}
        if isinstance(filtros, dict):
            try:
                fecha_desde = _parse_date(
                    filtros.get("fecha_desde") or request.query_params.get("fecha_desde"),
                    "fecha_desde",
                )
                fecha_hasta = _parse_date(
                    filtros.get("fecha_hasta") or request.query_params.get("fecha_hasta"),
                    "fecha_hasta",
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            distrito = (filtros.get("distrito") or distrito or "").strip()
            tipo = (filtros.get("tipo_delito") or tipo or "").strip()

        try:
            panel_data = panel.build_panel(
                request.user,
                scope,
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta,
                distrito=distrito,
                tipo_delito=tipo,
            )
        except ClickHouseReadOnlyError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Error armando panel táctico: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    try:
        pdf_bytes = build_dashboard_snapshot_pdf(panel_data, emisor=emisor)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"Error generando PDF: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    filename = f"dashboard_tactico_{zona_slug}.pdf"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response["Content-Length"] = str(len(pdf_bytes))
    return response
