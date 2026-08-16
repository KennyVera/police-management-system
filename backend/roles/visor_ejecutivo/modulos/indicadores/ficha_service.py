"""Ficha técnica de jurisdicción para Visor Ejecutivo (Alto Mando)."""

from __future__ import annotations

from datetime import timedelta
from statistics import mean

from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone

from accounts.models import AccountStatus, SystemRole, UserProfile
from organizacion.models import Jurisdiction, JurisdictionType
from operativo.models import (
    AsignacionDiaria,
    Escuadra,
    ExpedienteCaso,
    ParteAprehension,
    VehiculoFlota,
)
from tactico.services.geo_scope import ZoneScope, _collect_descendant_ids


def _user_label(user: User | None) -> str:
    if not user:
        return ""
    return f"{user.first_name} {user.last_name}".strip() or user.username or user.email


def _scope_from_jurisdiction(jur: Jurisdiction) -> ZoneScope:
    tree_ids = _collect_descendant_ids(jur)
    rows = Jurisdiction.objects.filter(id__in=tree_ids, activo=True).values_list(
        "nombre", "codigo"
    )
    labels: list[str] = []
    seen: set[str] = set()
    for nombre, codigo in rows:
        for raw in (nombre, codigo):
            val = (raw or "").strip()
            if val and val not in seen:
                seen.add(val)
                labels.append(val)
    if not labels:
        labels = [jur.nombre]
    return ZoneScope(
        jurisdiccion_id=jur.id,
        jurisdiccion_nombre=jur.nombre,
        jurisdiccion_codigo=jur.codigo or "",
        sectores=tuple(labels),
    )


def _tree_ids(jur: Jurisdiction) -> list[int]:
    return _collect_descendant_ids(jur)


def _profiles_in_zona(jur: Jurisdiction, institucion=None):
    tree = _tree_ids(jur)
    qs = UserProfile.objects.filter(
        Q(jurisdiccion_id__in=tree) | Q(zona=jur.nombre),
        estado=AccountStatus.ACTIVO,
    ).select_related("user", "jurisdiccion")
    if institucion:
        qs = qs.filter(institucion=institucion)
    return qs


def _jefe_zona(jur: Jurisdiction, institucion=None) -> User | None:
    qs = User.objects.select_related("profile").filter(
        profile__role=SystemRole.DIRECTOR_ZONA,
        profile__jurisdiccion_id=jur.id,
        profile__estado=AccountStatus.ACTIVO,
    )
    if institucion:
        qs = qs.filter(profile__institucion=institucion)
    return qs.first()


def _week_bounds(ref=None):
    now = ref or timezone.now()
    # Semana calendario: lunes 00:00 → domingo
    local = timezone.localtime(now)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        days=local.weekday()
    )
    end = start + timedelta(days=7)
    prev_start = start - timedelta(days=7)
    return start, end, prev_start


def list_zonas(*, institucion=None) -> list[dict]:
    qs = (
        Jurisdiction.objects.filter(tipo=JurisdictionType.ZONA, activo=True)
        .order_by("nombre")
    )
    out = []
    for jur in qs:
        jefe = _jefe_zona(jur, institucion)
        personal = _profiles_in_zona(jur, institucion).count()
        out.append(
            {
                "id": jur.id,
                "nombre": jur.nombre,
                "codigo": jur.codigo,
                "personal_count": personal,
                "jefe_zona": (
                    {
                        "id": jefe.id,
                        "nombre": _user_label(jefe),
                        "email": jefe.email,
                    }
                    if jefe
                    else None
                ),
            }
        )
    return out


def _cadena_mando(jur: Jurisdiction, institucion=None) -> dict:
    profiles = _profiles_in_zona(jur, institucion)
    jefe = _jefe_zona(jur, institucion)

    def serialize_many(role):
        rows = profiles.filter(role=role).select_related("user")
        return [
            {
                "id": p.user_id,
                "nombre": _user_label(p.user),
                "email": p.user.email,
                "unidad": p.unidad or "",
                "rango": p.rango_policial or "",
            }
            for p in rows
        ]

    supervisores = serialize_many(SystemRole.SUPERVISOR_UNIDAD)
    detectives = serialize_many(SystemRole.DETECTIVE)
    agentes = serialize_many(SystemRole.AGENTE_OPERATIVO)

    return {
        "jefe_zona": (
            {
                "id": jefe.id,
                "nombre": _user_label(jefe),
                "email": jefe.email,
                "role": "DIRECTOR_ZONA",
            }
            if jefe
            else None
        ),
        "conteos": {
            "supervisores": len(supervisores),
            "detectives": len(detectives),
            "agentes": len(agentes),
            "total": len(supervisores) + len(detectives) + len(agentes) + (1 if jefe else 0),
        },
        "supervisores": supervisores,
        "detectives": detectives,
        "agentes": agentes,
    }


def _partes_qs(scope: ZoneScope):
    return ParteAprehension.objects.filter(
        Q(sector_zona__in=scope.sectores) | Q(lugar__in=scope.sectores)
    )


def _carga_laboral(scope: ZoneScope) -> dict:
    start, end, prev_start = _week_bounds()
    qs = _partes_qs(scope)
    esta = qs.filter(fecha_hora__gte=start, fecha_hora__lt=end).count()
    pasada = qs.filter(fecha_hora__gte=prev_start, fecha_hora__lt=start).count()
    delta = esta - pasada
    pct = round((delta / pasada) * 100, 1) if pasada else (100.0 if esta else 0.0)
    return {
        "esta_semana": esta,
        "semana_pasada": pasada,
        "variacion": delta,
        "variacion_pct": pct,
        "desde": start.date().isoformat(),
        "hasta": (end - timedelta(seconds=1)).date().isoformat(),
    }


def _tasa_resolucion_casos(jur: Jurisdiction, institucion=None) -> dict:
    """Casos graves (ALTA/CRÍTICA) de detectives de la zona."""
    detective_ids = list(
        _profiles_in_zona(jur, institucion)
        .filter(role=SystemRole.DETECTIVE)
        .values_list("user_id", flat=True)
    )
    if not detective_ids:
        return {
            "asignados": 0,
            "resueltos": 0,
            "pendientes": 0,
            "tasa_pct": 0.0,
            "criterio": "prioridad ALTA/CRÍTICA · estado CERRADO",
        }

    qs = ExpedienteCaso.objects.filter(
        detective_asignado_id__in=detective_ids,
        prioridad__in=[
            ExpedienteCaso.Prioridad.ALTA,
            ExpedienteCaso.Prioridad.CRITICA,
        ],
    )
    if institucion:
        qs = qs.filter(institucion=institucion)

    asignados = qs.count()
    resueltos = qs.filter(estado=ExpedienteCaso.Estado.CERRADO).count()
    pendientes = max(asignados - resueltos, 0)
    tasa = round((resueltos / asignados) * 100, 1) if asignados else 0.0
    return {
        "asignados": asignados,
        "resueltos": resueltos,
        "pendientes": pendientes,
        "tasa_pct": tasa,
        "criterio": "prioridad ALTA/CRÍTICA · estado CERRADO",
    }


def _flota_zona(jur: Jurisdiction, institucion=None) -> dict:
    """Vehículos usados en escuadras/asignaciones recientes de personal de la zona."""
    tree = _tree_ids(jur)
    user_ids = list(
        _profiles_in_zona(jur, institucion).values_list("user_id", flat=True)
    )
    since = timezone.localdate() - timedelta(days=30)

    veh_ids: set[int] = set()
    if user_ids:
        veh_ids.update(
            Escuadra.objects.filter(
                fecha__gte=since,
                vehiculo_id__isnull=False,
            )
            .filter(Q(supervisor_id__in=user_ids) | Q(agente_lider_id__in=user_ids))
            .values_list("vehiculo_id", flat=True)
        )
        veh_ids.update(
            AsignacionDiaria.objects.filter(
                fecha__gte=since,
                vehiculo_id__isnull=False,
            )
            .filter(Q(agente_id__in=user_ids) | Q(zona_id__in=tree))
            .values_list("vehiculo_id", flat=True)
        )

    fuente = "asignaciones_zona"
    if veh_ids:
        flota = VehiculoFlota.objects.filter(id__in=veh_ids)
    else:
        # Fallback: flota global (sin FK territorial en el modelo)
        flota = VehiculoFlota.objects.all()
        fuente = "flota_institucional"

    total = flota.count()
    operativos = flota.filter(activo=True).count()
    taller = max(total - operativos, 0)
    return {
        "asignados": total,
        "operativos": operativos,
        "en_taller": taller,
        "label": f"{total} Patrulleros asignados ({operativos} Operativos, {taller} en Taller)",
        "fuente": fuente,
    }


def _sla_aprobacion(scope: ZoneScope) -> dict:
    """Tiempo medio desde envío a revisión hasta aprobación (días)."""
    qs = (
        _partes_qs(scope)
        .filter(
            estado_revision=ParteAprehension.EstadoRevision.APROBADO,
            aprobado_en__isnull=False,
        )
        .filter(Q(enviado_revision_en__isnull=False) | Q(creado_en__isnull=False))
    )

    duraciones_horas: list[float] = []
    for parte in qs.order_by("-aprobado_en")[:500].only(
        "aprobado_en", "enviado_revision_en", "creado_en"
    ):
        inicio = parte.enviado_revision_en or parte.creado_en
        if not inicio or not parte.aprobado_en:
            continue
        delta = parte.aprobado_en - inicio
        horas = delta.total_seconds() / 3600.0
        if horas >= 0:
            duraciones_horas.append(horas)

    if not duraciones_horas:
        return {
            "muestra": 0,
            "promedio_horas": None,
            "promedio_dias": None,
            "cuello_botella": False,
            "mensaje": "Sin partes aprobados con timestamps suficientes en esta zona.",
        }

    avg_h = mean(duraciones_horas)
    avg_d = round(avg_h / 24.0, 2)
    cuello = avg_d >= 3.0
    return {
        "muestra": len(duraciones_horas),
        "promedio_horas": round(avg_h, 1),
        "promedio_dias": avg_d,
        "cuello_botella": cuello,
        "mensaje": (
            f"Los supervisores tardan ~{avg_d} días en auditar/aprobar. "
            + ("Hay cuello de botella en esta zona." if cuello else "Dentro de umbral aceptable (< 3 días).")
        ),
    }


def _semaforo_estres(
    *,
    delitos_semana: int,
    agentes_operativos: int,
) -> dict:
    ratio = delitos_semana / max(agentes_operativos, 1)
    if ratio >= 40:
        nivel = "ROJO"
        tono = "danger"
        mensaje = (
            f"Zona colapsada: {delitos_semana} delitos esta semana vs "
            f"{agentes_operativos} agentes. Se requieren refuerzos."
        )
    elif ratio >= 15:
        nivel = "AMARILLO"
        tono = "warn"
        mensaje = (
            f"Estrés elevado: {delitos_semana} delitos / {agentes_operativos} agentes. "
            "Monitorear y valorar apoyo."
        )
    else:
        nivel = "VERDE"
        tono = "good"
        mensaje = (
            f"Carga controlada: {delitos_semana} delitos / {agentes_operativos} agentes."
        )
    return {
        "nivel": nivel,
        "tono": tono,
        "ratio": round(ratio, 2),
        "delitos_semana": delitos_semana,
        "agentes_operativos": agentes_operativos,
        "mensaje": mensaje,
        "umbrales": {"verde_max": 14.99, "amarillo_max": 39.99, "rojo_min": 40},
    }


def build_ficha(jur_id: int, *, institucion=None) -> dict | None:
    try:
        jur = Jurisdiction.objects.get(pk=jur_id, tipo=JurisdictionType.ZONA, activo=True)
    except Jurisdiction.DoesNotExist:
        return None

    scope = _scope_from_jurisdiction(jur)
    cadena = _cadena_mando(jur, institucion)
    carga = _carga_laboral(scope)
    resolucion = _tasa_resolucion_casos(jur, institucion)
    flota = _flota_zona(jur, institucion)
    sla = _sla_aprobacion(scope)
    agentes_op = cadena["conteos"]["agentes"]
    semaforo = _semaforo_estres(
        delitos_semana=carga["esta_semana"],
        agentes_operativos=agentes_op,
    )

    return {
        "zona": {
            "id": jur.id,
            "nombre": jur.nombre,
            "codigo": jur.codigo,
        },
        "cadena_mando": cadena,
        "carga_laboral": carga,
        "tasa_resolucion": resolucion,
        "flota": flota,
        "sla_respuesta": sla,
        "semaforo_estres": semaforo,
        "generado_en": timezone.now().isoformat(),
    }
