from datetime import date, datetime, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import AccountStatus, SystemRole, UserProfile
from accounts.permissions import SupervisorOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    Escuadra,
    GestionHorario,
    ParteAprehension,
    VehiculoFlota,
)


def _pct(part, whole):
    if not whole:
        return 0
    return round((part / whole) * 100)


def _user_label(u):
    if not u:
        return "—"
    name = f"{u.first_name} {u.last_name}".strip()
    return name or u.username


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def home(request):
    hoy = date.today()
    ahora = timezone.localtime()
    inicio_dia = timezone.make_aware(datetime.combine(hoy, datetime.min.time()))

    # —— Personal / fuerza efectiva ——
    agentes_total = UserProfile.objects.filter(
        role=SystemRole.AGENTE_OPERATIVO,
        estado=AccountStatus.ACTIVO,
    ).count()
    agentes_activos = (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .values("agente_id")
        .distinct()
        .count()
    )
    fuerza_pct = _pct(agentes_activos, agentes_total) if agentes_total else 0

    # —— Control de calidad / partes ——
    partes_hoy = ParteAprehension.objects.filter(creado_en__gte=inicio_dia)
    aprobados = partes_hoy.filter(
        estado_revision=ParteAprehension.EstadoRevision.APROBADO
    ).count()
    pendientes = ParteAprehension.objects.filter(
        estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
    ).count()
    pendientes_hoy = partes_hoy.filter(
        estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
    ).count()
    devueltos = partes_hoy.filter(
        estado_revision=ParteAprehension.EstadoRevision.OBSERVADO
    ).count()
    total_calidad = aprobados + pendientes_hoy + devueltos
    revisados_hoy = aprobados + devueltos
    procesados_den = total_calidad or (revisados_hoy + pendientes)
    procesados_pct = _pct(revisados_hoy, procesados_den) if procesados_den else 0

    # —— Flota ——
    flota_total = VehiculoFlota.objects.count()
    flota_operativos = VehiculoFlota.objects.filter(activo=True).count()
    flota_mantenimiento = max(flota_total - flota_operativos, 0)
    flota_pct = _pct(flota_operativos, flota_total) if flota_total else 0

    # —— Alertas críticas ——
    alertas_criticas = (
        AlertaDespacho.objects.filter(
            prioridad=AlertaDespacho.Prioridad.ALTA,
            asignada_en__gte=inicio_dia - timedelta(days=1),
        )
        .exclude(estado__in=[AlertaDespacho.Estado.CERRADA, AlertaDespacho.Estado.CANCELADA])
        .count()
    )

    # —— Últimos partes pendientes ——
    pendientes_qs = (
        ParteAprehension.objects.filter(
            estado_revision=ParteAprehension.EstadoRevision.EN_REVISION
        )
        .select_related("creado_por", "tipo_delito")
        .order_by("-creado_en")[:6]
    )
    partes_revision = [
        {
            "id": p.id,
            "hora": timezone.localtime(p.creado_en).strftime("%H:%M") if p.creado_en else "—",
            "agente": _user_label(p.creado_por),
            "tipo_delito": getattr(p.tipo_delito, "nombre", None) or p.titulo or "—",
            "sector": p.sector_zona or p.lugar or "—",
            "estado": "Pendiente",
            "numero_caso": p.numero_caso or f"P-{p.id}",
        }
        for p in pendientes_qs
    ]

    # —— Actividad por escuadra ——
    escuadras = (
        Escuadra.objects.filter(fecha=hoy, activo=True)
        .annotate(n_asig=Count("asignaciones", filter=Q(asignaciones__activo=True)))
        .order_by("-n_asig", "nombre")[:8]
    )
    actividad_escuadras = [
        {"nombre": e.nombre or f"Escuadra {e.id}", "total": int(e.n_asig or 0)}
        for e in escuadras
    ]
    # Si no hay escuadras con asignaciones, listar escuadras en 0
    if not actividad_escuadras:
        actividad_escuadras = [
            {"nombre": e.nombre or f"Escuadra {e.id}", "total": 0}
            for e in Escuadra.objects.filter(fecha=hoy, activo=True).order_by("nombre")[:6]
        ]

    # —— Distribución por sector (desde asignaciones del día) ——
    sectores_raw = (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .exclude(cuadrante="")
        .values("cuadrante")
        .annotate(total=Count("id"))
        .order_by("-total")[:6]
    )
    distribucion_sectores = [
        {
            "sector": r["cuadrante"] or "Sin sector",
            "patrullas": r["total"],
            "estado": "activa",
        }
        for r in sectores_raw
    ]

    apro_pct = _pct(aprobados, total_calidad) if total_calidad else 0
    pend_pct = _pct(pendientes_hoy, total_calidad) if total_calidad else 0
    dev_pct = _pct(devueltos, total_calidad) if total_calidad else 0

    return Response(
        {
            "role": "Supervisor de Unidad",
            "module": "dashboard",
            "status": "ready",
            "user": request.user.get_username(),
            "fecha": ahora.strftime("%A, %d de %B de %Y"),
            "fecha_iso": hoy.isoformat(),
            "turno": {"inicio": "07:00", "fin": "19:00"},
            "kpis": {
                "fuerza_efectiva": {
                    "porcentaje": fuerza_pct,
                    "activos": agentes_activos,
                    "total": agentes_total,
                    "delta_ayer_pct": None,
                },
                "control_calidad": {
                    "pendientes": pendientes,
                    "revisados_hoy": revisados_hoy,
                    "procesados_pct": procesados_pct,
                },
                "flota": {
                    "porcentaje": flota_pct,
                    "operativos": flota_operativos,
                    "total": flota_total,
                    "en_mantenimiento": flota_mantenimiento,
                },
                "alertas_criticas": {"total": alertas_criticas},
            },
            "calidad_partes": {
                "total": total_calidad,
                "aprobados": aprobados,
                "pendientes": pendientes_hoy,
                "devueltos": devueltos,
                "aprobados_pct": apro_pct,
                "pendientes_pct": pend_pct,
                "devueltos_pct": dev_pct,
                "calidad_ok": (dev_pct <= 20) if total_calidad else True,
            },
            "partes_revision": partes_revision,
            "actividad_escuadras": actividad_escuadras,
            "distribucion_sectores": distribucion_sectores,
            "stats": {
                "partes_pendientes": pendientes,
                "escuadras_hoy": Escuadra.objects.filter(fecha=hoy, activo=True).count(),
                "asignaciones_hoy": AsignacionDiaria.objects.filter(
                    fecha=hoy, activo=True
                ).count(),
                "horarios_pendientes": GestionHorario.objects.filter(
                    estado=GestionHorario.Estado.PENDIENTE
                ).count(),
            },
        }
    )
