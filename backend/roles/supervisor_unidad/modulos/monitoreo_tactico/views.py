from datetime import date, datetime, timedelta
from statistics import mean

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import SupervisorOnly
from operativo.models import (
    AlertaDespacho,
    AsignacionDiaria,
    NovedadIncidente,
    OrdenAdicional,
)
from operativo.serializers import _user_label
from roles.supervisor_unidad.cuadrantes_geo import build_cuadrantes_for_supervisor
from roles.supervisor_unidad.scope import agente_ids_en_zona, partes_en_zona_qs


def _segundos_respuesta(alerta):
    """Tiempo desde en camino (o asignación) hasta llegada al lugar."""
    inicio = alerta.en_camino_en or alerta.asignada_en
    fin = alerta.llegada_en
    if not inicio or not fin:
        return None
    return max(0, (fin - inicio).total_seconds())


def _asignaciones_zona_qs(supervisor, hoy=None):
    """Asignaciones del día solo de la zona / escuadras del supervisor."""
    hoy = hoy or date.today()
    agente_ids = agente_ids_en_zona(supervisor)
    return (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .filter(
            Q(supervisor=supervisor)
            | Q(escuadra__supervisor=supervisor)
            | Q(agente_id__in=agente_ids)
        )
        .select_related(
            "agente",
            "agente__profile",
            "companero",
            "vehiculo",
            "escuadra",
            "escuadra__agente_lider",
            "escuadra__vehiculo",
        )
        .prefetch_related("escuadra__companeros", "escuadra__companeros__profile")
        .order_by("unidad_label", "id")
    )


def _alerta_activa_para_escuadra(escuadra_id, agente_ids, alerta_por_escuadra, alerta_por_agente):
    if escuadra_id and escuadra_id in alerta_por_escuadra:
        return alerta_por_escuadra[escuadra_id]
    for aid in agente_ids:
        if aid in alerta_por_agente:
            return alerta_por_agente[aid]
    return None


def _serializar_unidad(*, key, label, placa, tipo, cuadrante, sector, lat, lng, turno_i, turno_f, escuadra_nombre, agentes, alerta):
    lider = agentes[0] if agentes else None
    companero = agentes[1] if len(agentes) > 1 else None
    return {
        "id": key,
        "agente": lider,
        "companero": companero,
        "agentes": agentes,
        "unidad_label": label,
        "vehiculo_placa": placa,
        "vehiculo_tipo": tipo,
        "cuadrante": cuadrante,
        "sector_detalle": sector,
        "latitud": lat,
        "longitud": lng,
        "turno_inicio": turno_i,
        "turno_fin": turno_f,
        "escuadra": escuadra_nombre,
        "estado_operativo": alerta.estado if alerta else "PATRULLAJE",
        "alerta_activa": (
            {
                "id": alerta.id,
                "titulo": alerta.titulo,
                "estado": alerta.estado,
                "estado_label": alerta.get_estado_display(),
                "prioridad": alerta.prioridad,
                "direccion": alerta.direccion,
                "latitud": alerta.latitud,
                "longitud": alerta.longitud,
            }
            if alerta
            else None
        ),
    }


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def unidades_gps(request):
    """Una patrulla por escuadra (zona del supervisor), sin duplicar integrantes."""
    hoy = date.today()
    qs = _asignaciones_zona_qs(request.user, hoy)

    alertas_activas = (
        AlertaDespacho.objects.filter(
            estado__in=[
                AlertaDespacho.Estado.ASIGNADA,
                AlertaDespacho.Estado.EN_CAMINO,
                AlertaDespacho.Estado.EN_LUGAR,
            ]
        )
        .filter(
            Q(escuadra__supervisor=request.user)
            | Q(asignada_por=request.user)
            | Q(agente_id__in=agente_ids_en_zona(request.user))
        )
        .select_related("agente", "escuadra")
        .order_by("-asignada_en")
    )
    alerta_por_escuadra = {}
    alerta_por_agente = {}
    for al in alertas_activas:
        if al.escuadra_id:
            alerta_por_escuadra.setdefault(al.escuadra_id, al)
        if al.agente_id:
            alerta_por_agente.setdefault(al.agente_id, al)

    # Agrupar por escuadra (una unidad). Sin escuadra → una por asignación.
    grupos = {}
    for a in qs:
        key = f"esc-{a.escuadra_id}" if a.escuadra_id else f"asig-{a.id}"
        g = grupos.get(key)
        if not g:
            grupos[key] = {
                "key": key,
                "escuadra": a.escuadra,
                "rows": [a],
            }
        else:
            g["rows"].append(a)

    items = []
    for g in grupos.values():
        rows = g["rows"]
        esc = g["escuadra"]
        # Preferir fila del líder / con GPS
        rows_sorted = sorted(
            rows,
            key=lambda r: (
                0 if esc and r.agente_id == esc.agente_lider_id else 1,
                0 if r.latitud is not None and r.longitud is not None else 1,
                r.id,
            ),
        )
        primary = rows_sorted[0]

        if esc:
            miembros_users = [esc.agente_lider] + list(esc.companeros.all())
            agentes = [_user_label(u) for u in miembros_users if u]
            agente_ids = [u.id for u in miembros_users if u]
            label = (
                f"{esc.nombre} · {primary.vehiculo_placa}"
                if primary.vehiculo_placa
                else esc.nombre
            )
            escuadra_nombre = esc.nombre
        else:
            agentes = [_user_label(primary.agente)]
            if primary.companero_id:
                agentes.append(_user_label(primary.companero))
            agente_ids = [primary.agente_id]
            if primary.companero_id:
                agente_ids.append(primary.companero_id)
            label = primary.unidad_label or primary.vehiculo_placa or "Unidad"
            escuadra_nombre = None

        # Coords: primera con GPS
        lat = lng = None
        for r in rows_sorted:
            if r.latitud is not None and r.longitud is not None:
                lat, lng = r.latitud, r.longitud
                break

        alerta = _alerta_activa_para_escuadra(
            esc.id if esc else None,
            agente_ids,
            alerta_por_escuadra,
            alerta_por_agente,
        )

        items.append(
            _serializar_unidad(
                key=g["key"],
                label=label,
                placa=primary.vehiculo_placa,
                tipo=primary.vehiculo_tipo,
                cuadrante=primary.cuadrante,
                sector=primary.sector_detalle,
                lat=lat,
                lng=lng,
                turno_i=primary.turno_inicio,
                turno_f=primary.turno_fin,
                escuadra_nombre=escuadra_nombre,
                agentes=agentes,
                alerta=alerta,
            )
        )

    items.sort(key=lambda u: (u["unidad_label"] or "", u["id"]))

    return Response(
        {
            "fecha": str(hoy),
            "actualizado_en": timezone.now().isoformat(),
            "zona_mapa": build_cuadrantes_for_supervisor(request.user),
            "unidades": items,
            "con_gps": sum(
                1 for u in items if u["latitud"] is not None and u["longitud"] is not None
            ),
        }
    )


@api_view(["GET"])
@permission_classes([SupervisorOnly])
def estadisticas(request):
    """KPIs del día: auxilios, tiempos de respuesta y novedades (zona supervisor)."""
    hoy = date.today()
    inicio = timezone.make_aware(datetime.combine(hoy, datetime.min.time()))
    fin = inicio + timedelta(days=1)
    agente_ids = agente_ids_en_zona(request.user)

    alertas_hoy = AlertaDespacho.objects.filter(
        asignada_en__gte=inicio,
        asignada_en__lt=fin,
    ).exclude(estado=AlertaDespacho.Estado.PENDIENTE).filter(
        Q(escuadra__supervisor=request.user)
        | Q(asignada_por=request.user)
        | Q(agente_id__in=agente_ids)
    )

    atendidos = alertas_hoy.filter(
        estado__in=[
            AlertaDespacho.Estado.EN_LUGAR,
            AlertaDespacho.Estado.CERRADA,
        ]
    )
    cerrados = alertas_hoy.filter(estado=AlertaDespacho.Estado.CERRADA).count()
    en_curso = alertas_hoy.filter(
        estado__in=[
            AlertaDespacho.Estado.ASIGNADA,
            AlertaDespacho.Estado.EN_CAMINO,
            AlertaDespacho.Estado.EN_LUGAR,
        ]
    ).count()

    tiempos = []
    for al in alertas_hoy.filter(llegada_en__isnull=False):
        seg = _segundos_respuesta(al)
        if seg is not None:
            tiempos.append(seg)

    avg_seg = mean(tiempos) if tiempos else None
    avg_min = round(avg_seg / 60.0, 1) if avg_seg is not None else None

    novedades_hoy = NovedadIncidente.objects.filter(
        Q(fecha_hora__gte=inicio, fecha_hora__lt=fin)
        | Q(creado_en__gte=inicio, creado_en__lt=fin),
        creado_por_id__in=agente_ids,
    ).count() if agente_ids else 0

    partes_generados = partes_en_zona_qs(request.user).filter(
        creado_en__gte=inicio, creado_en__lt=fin
    ).count()

    ordenes_hoy = OrdenAdicional.objects.filter(
        creado_en__gte=inicio,
        creado_en__lt=fin,
        agente_id__in=agente_ids,
    ).count() if agente_ids else 0

    por_prioridad = list(
        alertas_hoy.values("prioridad").annotate(total=Count("id")).order_by("prioridad")
    )

    # Una unidad = una escuadra (o asignación suelta) en la zona
    grupos = set()
    for row in (
        AsignacionDiaria.objects.filter(fecha=hoy, activo=True)
        .filter(
            Q(supervisor=request.user)
            | Q(escuadra__supervisor=request.user)
            | Q(agente_id__in=agente_ids)
        )
        .values("id", "escuadra_id")
    ):
        eid = row["escuadra_id"]
        grupos.add(f"esc-{eid}" if eid else f"asig-{row['id']}")
    unidades_turno = len(grupos)

    return Response(
        {
            "fecha": str(hoy),
            "auxilios": {
                "asignados_hoy": alertas_hoy.count(),
                "atendidos": atendidos.count(),
                "cerrados": cerrados,
                "en_curso": en_curso,
                "por_prioridad": [
                    {"prioridad": p["prioridad"], "total": p["total"]} for p in por_prioridad
                ],
            },
            "tiempos": {
                "muestras": len(tiempos),
                "promedio_minutos": avg_min,
                "promedio_segundos": round(avg_seg, 0) if avg_seg is not None else None,
            },
            "novedades_hoy": novedades_hoy,
            "partes_hoy": partes_generados,
            "ordenes_hoy": ordenes_hoy,
            "unidades_en_turno": unidades_turno,
        }
    )
