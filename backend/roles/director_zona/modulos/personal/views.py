"""Gestión de personal regional del Jefe de Zona."""

from __future__ import annotations

from datetime import date

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import SystemRole
from accounts.permissions import EsJefeDeZona
from operativo.models import AsignacionDiaria, EvaluacionSupervisor, GestionHorario
from roles.director_zona.scope import (
    ZoneScopeError,
    supervisores_in_zone,
    users_in_zone,
    zone_scope,
)

# Estados operativos mostrados al jefe (síntesis del día).
ESTADO_ACTIVO = "ACTIVO"
ESTADO_FRANCO = "FRANCO"
ESTADO_VACACIONES = "VACACIONES"
ESTADO_CALAMIDAD = "CALAMIDAD"
ESTADO_ARRESTO = "ARRESTO"
ESTADO_PERMISO = "PERMISO"

HORARIO_TO_ESTADO = {
    GestionHorario.Tipo.PERMISO_MEDICO: ESTADO_CALAMIDAD,
    GestionHorario.Tipo.AUSENCIA: ESTADO_FRANCO,
    GestionHorario.Tipo.CAMBIO_TURNO: ESTADO_ACTIVO,
    GestionHorario.Tipo.FORMACION: ESTADO_ACTIVO,
    GestionHorario.Tipo.OTRO: ESTADO_PERMISO,
}


def _user_label(u):
    if not u:
        return ""
    name = f"{u.first_name} {u.last_name}".strip()
    return name or u.username


def _resolve_estado(user, hoy: date, asignados: set[int], gestiones: dict) -> tuple[str, str]:
    gest = gestiones.get(user.id)
    if gest:
        estado = HORARIO_TO_ESTADO.get(gest.tipo, ESTADO_PERMISO)
        detalle = gest.get_tipo_display()
        # Heurística por texto libre en detalle
        low = (gest.detalle or "").lower()
        if "vacacion" in low:
            estado = ESTADO_VACACIONES
        elif "calamidad" in low:
            estado = ESTADO_CALAMIDAD
        elif "arresto" in low or "disciplin" in low:
            estado = ESTADO_ARRESTO
        elif "franco" in low:
            estado = ESTADO_FRANCO
        return estado, detalle
    if user.id in asignados:
        return ESTADO_ACTIVO, "Con asignación de turno hoy"
    return ESTADO_FRANCO, "Sin turno asignado hoy"


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def estado_personal(request):
    """Listado del personal de la zona con estado operativo del día."""
    try:
        scope = zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    hoy = date.today()
    personal = (
        users_in_zone(request.user)
        .filter(
            profile__role__in=[
                SystemRole.SUPERVISOR_UNIDAD,
                SystemRole.AGENTE_OPERATIVO,
                SystemRole.DETECTIVE,
            ]
        )
        .order_by("profile__role", "last_name", "first_name")
    )

    asignados = set(
        AsignacionDiaria.objects.filter(fecha=hoy, agente__in=personal).values_list(
            "agente_id", flat=True
        )
    )
    gestiones = {
        g.agente_id: g
        for g in GestionHorario.objects.filter(
            fecha=hoy,
            agente__in=personal,
            estado=GestionHorario.Estado.APROBADO,
        ).order_by("agente_id", "-creado_en")
    }

    resumen = {
        ESTADO_ACTIVO: 0,
        ESTADO_FRANCO: 0,
        ESTADO_VACACIONES: 0,
        ESTADO_CALAMIDAD: 0,
        ESTADO_ARRESTO: 0,
        ESTADO_PERMISO: 0,
    }
    items = []
    for u in personal:
        estado, detalle = _resolve_estado(u, hoy, asignados, gestiones)
        resumen[estado] = resumen.get(estado, 0) + 1
        items.append(
            {
                "id": u.id,
                "nombre": _user_label(u),
                "email": u.email,
                "rol": u.profile.role,
                "rol_label": u.profile.get_role_display(),
                "unidad": u.profile.unidad or "",
                "zona": u.profile.zona or "",
                "jurisdiccion": getattr(u.profile.jurisdiccion, "nombre", None) or "",
                "estado": estado,
                "estado_detalle": detalle,
            }
        )

    return Response(
        {
            "jurisdiccion": {
                "id": scope.jurisdiccion_id,
                "nombre": scope.jurisdiccion_nombre,
                "codigo": scope.jurisdiccion_codigo,
            },
            "fecha": hoy.isoformat(),
            "resumen": resumen,
            "disponibles_hoy": resumen.get(ESTADO_ACTIVO, 0),
            "total": len(items),
            "personal": items,
        }
    )


@api_view(["GET"])
@permission_classes([EsJefeDeZona])
def list_supervisores(request):
    try:
        zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    items = [
        {
            "id": u.id,
            "nombre": _user_label(u),
            "email": u.email,
            "unidad": u.profile.unidad or "",
            "zona": u.profile.zona or "",
        }
        for u in supervisores_in_zone(request.user).order_by("last_name", "first_name")
    ]
    # Fallback demo: si no hay supervisores en jurisdicción, listar todos los del rol
    if not items:
        items = [
            {
                "id": u.id,
                "nombre": _user_label(u),
                "email": u.email,
                "unidad": getattr(u.profile, "unidad", "") or "",
                "zona": getattr(u.profile, "zona", "") or "",
            }
            for u in User.objects.filter(profile__role=SystemRole.SUPERVISOR_UNIDAD)
            .select_related("profile")
            .order_by("last_name")[:50]
        ]
    return Response({"supervisores": items})


@api_view(["GET", "POST"])
@permission_classes([EsJefeDeZona])
def evaluaciones_collection(request):
    try:
        zone_scope(request.user)
    except ZoneScopeError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        qs = (
            EvaluacionSupervisor.objects.filter(evaluador=request.user)
            .select_related("supervisor", "supervisor__profile")
            .order_by("-creado_en")[:100]
        )
        return Response(
            {
                "evaluaciones": [
                    {
                        "id": e.id,
                        "supervisor_id": e.supervisor_id,
                        "supervisor": _user_label(e.supervisor),
                        "unidad": getattr(e.supervisor.profile, "unidad", "") or "",
                        "calificacion": e.calificacion,
                        "anotacion": e.anotacion,
                        "periodo": e.periodo,
                        "creado_en": e.creado_en.isoformat() if e.creado_en else None,
                    }
                    for e in qs
                ]
            }
        )

    supervisor_id = request.data.get("supervisor_id")
    try:
        calificacion = int(request.data.get("calificacion"))
    except (TypeError, ValueError):
        return Response({"detail": "calificacion debe ser un entero 1–5."}, status=400)
    if calificacion < 1 or calificacion > 5:
        return Response({"detail": "calificacion debe estar entre 1 y 5."}, status=400)

    try:
        supervisor = User.objects.select_related("profile").get(
            pk=supervisor_id, profile__role=SystemRole.SUPERVISOR_UNIDAD
        )
    except User.DoesNotExist:
        return Response({"detail": "Supervisor no encontrado."}, status=404)

    obj = EvaluacionSupervisor.objects.create(
        evaluador=request.user,
        supervisor=supervisor,
        calificacion=calificacion,
        anotacion=(request.data.get("anotacion") or "").strip(),
        periodo=(request.data.get("periodo") or "").strip(),
    )
    return Response(
        {
            "id": obj.id,
            "supervisor_id": obj.supervisor_id,
            "supervisor": _user_label(obj.supervisor),
            "calificacion": obj.calificacion,
            "anotacion": obj.anotacion,
            "periodo": obj.periodo,
            "creado_en": obj.creado_en.isoformat(),
        },
        status=201,
    )


@api_view(["DELETE"])
@permission_classes([EsJefeDeZona])
def evaluacion_detail(request, pk):
    try:
        obj = EvaluacionSupervisor.objects.get(pk=pk, evaluador=request.user)
    except EvaluacionSupervisor.DoesNotExist:
        return Response({"detail": "Evaluación no encontrada."}, status=404)
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
