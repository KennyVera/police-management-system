"""Supervisión de casos relevantes (lectura) para el Jefe de Zona."""

from __future__ import annotations

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import EsJefeDeZona
from operativo.models import ExpedienteCaso, ParteAprehension
from operativo.pdf_service import build_pdf_bytes
from roles.director_zona.scope import ZoneScopeError, users_in_zone, zone_scope


def _user_label(u):
    if not u:
        return ""
    name = f"{u.first_name} {u.last_name}".strip()
    return name or u.username


def _parte_in_zone(obj: ParteAprehension, sectores: list[str]) -> bool:
    if not sectores:
        return False
    sector = (obj.sector_zona or "").strip()
    lugar = (obj.lugar or "").strip()
    if sector and sector in sectores:
        return True
    if lugar and lugar in sectores:
        return True
    # coincidencia parcial (ej. "Distrito 2 — Zona Norte" vs códigos)
    for s in sectores:
        if not s:
            continue
        if sector and (s in sector or sector in s):
            return True
        if lugar and (s in lugar or lugar in s):
            return True
    return False


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def parte_pdf(request, pk):
    """PDF de un parte de la zona (solo lectura / descarga)."""
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    try:
        obj = (
            ParteAprehension.objects.select_related(
                "tipo_delito", "creado_por", "alerta", "revisado_por"
            )
            .prefetch_related("multimedia")
            .get(pk=pk)
        )
    except ParteAprehension.DoesNotExist:
        return Response({"detail": "Parte no encontrado."}, status=404)

    if not _parte_in_zone(obj, list(scope.sectores or [])):
        return Response(
            {"detail": "El parte no pertenece a su jurisdicción."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        pdf_bytes = build_pdf_bytes(obj, generado_por=request.user)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo generar el PDF: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    filename = f"{obj.numero_caso or f'parte-{obj.id}'}.pdf"
    download = str(request.query_params.get("download", "")).lower() in (
        "1",
        "true",
        "yes",
    )
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    disposition = "attachment" if download else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    response["Content-Length"] = str(len(pdf_bytes))
    return response


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def casos_criticos(request):
    """
    Expedientes graves (prioridad Alta/Crítica) en el territorio del jefe.
    Se consideran casos de detectives de la zona o con parte/lugar en sectores de la zona.
    """
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    zone_users = users_in_zone(request.user)
    sectores = list(scope.sectores)
    qs = (
        ExpedienteCaso.objects.filter(
            prioridad__in=[ExpedienteCaso.Prioridad.ALTA, ExpedienteCaso.Prioridad.CRITICA]
        )
        .filter(
            Q(detective_asignado__in=zone_users)
            | Q(parte_origen__sector_zona__in=sectores)
            | Q(lugar__in=sectores)
        )
        .select_related("detective_asignado", "tipo_delito", "parte_origen")
        .distinct()
        .order_by("-prioridad", "-actualizado_en")[:100]
    )

    items = []
    for exp in qs:
        tiene_informe = False
        try:
            tiene_informe = exp.informe_final is not None
        except Exception:  # noqa: BLE001
            tiene_informe = False
        items.append(
            {
                "id": exp.id,
                "codigo_caso": exp.codigo_caso or "",
                "numero_expediente": exp.numero_expediente or "",
                "titulo": exp.titulo,
                "estado": exp.estado,
                "estado_label": exp.get_estado_display(),
                "prioridad": exp.prioridad,
                "prioridad_label": exp.get_prioridad_display(),
                "tipo_delito": getattr(exp.tipo_delito, "nombre", None) or "—",
                "lugar": exp.lugar or "",
                "fecha_hechos": exp.fecha_hechos.isoformat() if exp.fecha_hechos else None,
                "detective": _user_label(exp.detective_asignado),
                "unidad": exp.unidad or "",
                "bloqueado": exp.bloqueado,
                "actualizado_en": exp.actualizado_en.isoformat() if exp.actualizado_en else None,
                "tiene_informe": tiene_informe,
            }
        )

    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "total": len(items),
            "casos": items,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def caso_critico_detail(request, pk):
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    zone_users = users_in_zone(request.user)
    sectores = list(scope.sectores)
    try:
        exp = (
            ExpedienteCaso.objects.filter(
                Q(detective_asignado__in=zone_users)
                | Q(parte_origen__sector_zona__in=sectores)
                | Q(lugar__in=sectores)
            )
            .select_related("detective_asignado", "tipo_delito", "parte_origen")
            .prefetch_related("bitacora", "involucrados")
            .distinct()
            .get(pk=pk)
        )
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Caso no encontrado en su jurisdicción."}, status=404)

    bitacora = [
        {
            "id": b.id,
            "tipo": b.tipo,
            "tipo_label": b.get_tipo_display(),
            "fecha_hora": b.fecha_hora.isoformat() if b.fecha_hora else None,
            "lugar": b.lugar or "",
            "relato": b.relato or "",
        }
        for b in exp.bitacora.all()[:30]
    ]

    informe = None
    try:
        inf = exp.informe_final
        informe = {
            "id": inf.id,
            "conclusiones": inf.conclusiones or "",
            "creado_en": inf.creado_en.isoformat() if inf.creado_en else None,
            "elaborado_por": _user_label(inf.elaborado_por),
        }
    except Exception:  # noqa: BLE001
        informe = None

    return Response(
        {
            "id": exp.id,
            "codigo_caso": exp.codigo_caso or "",
            "numero_expediente": exp.numero_expediente or "",
            "titulo": exp.titulo,
            "descripcion": exp.descripcion or "",
            "documento_base": exp.documento_base or "",
            "observaciones": exp.observaciones or "",
            "estado": exp.estado,
            "estado_label": exp.get_estado_display(),
            "prioridad": exp.prioridad,
            "prioridad_label": exp.get_prioridad_display(),
            "tipo_delito": getattr(exp.tipo_delito, "nombre", None) or "—",
            "lugar": exp.lugar or "",
            "fecha_hechos": exp.fecha_hechos.isoformat() if exp.fecha_hechos else None,
            "detective": _user_label(exp.detective_asignado),
            "unidad": exp.unidad or "",
            "bloqueado": exp.bloqueado,
            "bitacora": bitacora,
            "informe": informe,
            "involucrados": [
                {
                    "id": inv.id,
                    "tipo": inv.tipo,
                    "tipo_label": inv.get_tipo_display(),
                    "nombres": inv.nombres,
                    "apellidos": inv.apellidos,
                    "cedula": inv.cedula or "",
                }
                for inv in exp.involucrados.all()[:40]
            ],
        }
    )
