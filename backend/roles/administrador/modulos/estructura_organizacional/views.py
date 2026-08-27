from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import AccountStatus, SystemRole, UserProfile
from accounts.permissions import AdminOnly
from accounts.serializers import (
    JurisdictionSerializer,
    PlazaAssignSerializer,
    PoliceUserSerializer,
)
from organizacion.models import Jurisdiction, JurisdictionType
from operativo.models import Notificacion
from operativo.notifications import notify_user
from tactico.services.geo_scope import _collect_descendant_ids

ZONE_ROLES = {
    SystemRole.DIRECTOR_ZONA,
    SystemRole.SUPERVISOR_UNIDAD,
    SystemRole.FISCAL,
    SystemRole.DETECTIVE,
    SystemRole.AGENTE_OPERATIVO,
}

NO_ZONE_ROLES = {
    SystemRole.VISOR_EJECUTIVO,
    SystemRole.ADMIN_SISTEMA,
    SystemRole.SUPERADMIN_SAAS,
}

_ZONA_ENLACE = {
    SystemRole.DIRECTOR_ZONA: "/app/director_zona/inteligencia",
    SystemRole.SUPERVISOR_UNIDAD: "/app/supervisor_unidad/despacho_operativo/auxilios",
    SystemRole.AGENTE_OPERATIVO: "/app/agente_operativo/dashboard",
    SystemRole.DETECTIVE: "/app/detective/casos",
    SystemRole.FISCAL: "/app/fiscal/bandeja",
}


def _notify_asignacion_zona(user, jur, *, desasignado=False):
    role = user.profile.role
    if desasignado:
        notify_user(
            user=user,
            tipo=Notificacion.Tipo.ASIGNACION_ZONA,
            titulo="Cambio de asignación territorial",
            mensaje="Tu asignación de zona ha sido retirada por el administrador.",
            enlace=_ZONA_ENLACE.get(role, ""),
        )
        return
    notify_user(
        user=user,
        tipo=Notificacion.Tipo.ASIGNACION_ZONA,
        titulo="Asignado a zona operativa",
        mensaje=f"Has sido asignado a {jur.nombre}. Revisa tu panel para operar en ese territorio.",
        enlace=_ZONA_ENLACE.get(role, ""),
    )


def _institucion_of(request):
    return getattr(getattr(request.user, "profile", None), "institucion", None)


def _users_qs(institucion=None):
    qs = User.objects.select_related(
        "profile", "profile__departamento", "profile__jurisdiccion"
    ).exclude(profile__isnull=True)
    if institucion:
        qs = qs.filter(
            Q(profile__institucion=institucion) | Q(profile__institucion__isnull=True)
        )
    return qs


def _jefe_payload(jefe):
    if not jefe:
        return None
    return {
        "id": jefe.id,
        "nombre": f"{jefe.first_name} {jefe.last_name}".strip() or jefe.email,
        "email": jefe.email,
        "role_label": jefe.profile.get_role_display() if hasattr(jefe, "profile") else None,
    }


def _zona_raiz(jur: Jurisdiction) -> Jurisdiction:
    """Sube el árbol hasta la Zona (nivel mando del Jefe de Zona)."""
    current = jur
    seen = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        if current.tipo == JurisdictionType.ZONA:
            return current
        parent_id = current.parent_id
        if not parent_id:
            break
        nxt = current.parent if getattr(current, "parent_id", None) == parent_id else None
        if nxt is None:
            nxt = (
                Jurisdiction.objects.select_related("parent")
                .filter(pk=parent_id)
                .first()
            )
        current = nxt
    return jur


def _load_jefes_por_zona(institucion=None):
    """Mapa jurisdiccion_id -> User (solo jefes activos con zona)."""
    qs = User.objects.select_related("profile", "profile__jurisdiccion").filter(
        profile__role=SystemRole.DIRECTOR_ZONA,
        profile__jurisdiccion_id__isnull=False,
        profile__estado=AccountStatus.ACTIVO,
    )
    if institucion:
        qs = qs.filter(
            Q(profile__institucion=institucion) | Q(profile__institucion__isnull=True)
        )
    return {u.profile.jurisdiccion_id: u for u in qs}


def _jefe_for_jurisdiction(jur, jefes: dict):
    """Jefe asignado a esta jurisdicción o a su Zona padre."""
    current = jur
    seen = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)
        jefe = jefes.get(current.id)
        if jefe:
            return jefe
        current = current.parent
    return None


def _jefe_de_zona(jurisdiccion_id, institucion=None, cache=None):
    if cache is not None:
        if jurisdiccion_id in cache:
            return cache.get(jurisdiccion_id)
        # cache keyed by exact id; try walking parents via DB
        jur = Jurisdiction.objects.select_related("parent").filter(pk=jurisdiccion_id).first()
        if jur:
            return _jefe_for_jurisdiction(jur, cache)
        return None
    qs = User.objects.select_related("profile").filter(
        profile__role=SystemRole.DIRECTOR_ZONA,
        profile__jurisdiccion_id=jurisdiccion_id,
        profile__estado=AccountStatus.ACTIVO,
    )
    if institucion:
        qs = qs.filter(
            Q(profile__institucion=institucion) | Q(profile__institucion__isnull=True)
        )
    return qs.first()


def _descendant_index(jurs):
    children = {}
    for j in jurs:
        children.setdefault(j.parent_id, []).append(j.id)
    memo = {}

    def walk(jid, stack):
        if jid in memo:
            return memo[jid]
        if jid in stack:
            return [jid]
        stack.add(jid)
        ids = [jid]
        for cid in children.get(jid, []):
            ids.extend(walk(cid, stack))
        stack.discard(jid)
        memo[jid] = ids
        return ids

    return {j.id: walk(j.id, set()) for j in jurs}


def _profile_rows(institucion=None):
    qs = UserProfile.objects.filter(estado=AccountStatus.ACTIVO).exclude(
        role__in=NO_ZONE_ROLES
    )
    if institucion:
        qs = qs.filter(institucion=institucion)
    return list(qs.values("role", "jurisdiccion_id", "zona"))


def _counts_for_tree(rows, tree_ids, nombre):
    tree = set(tree_ids)
    supervisores = detectives = agentes = total = 0
    for row in rows:
        if row["jurisdiccion_id"] not in tree and row["zona"] != nombre:
            continue
        total += 1
        if row["role"] == SystemRole.SUPERVISOR_UNIDAD:
            supervisores += 1
        elif row["role"] == SystemRole.DETECTIVE:
            detectives += 1
        elif row["role"] == SystemRole.AGENTE_OPERATIVO:
            agentes += 1
    return {
        "supervisores": supervisores,
        "detectives": detectives,
        "agentes": agentes,
        "total": total,
    }


def _serialize_asignacion(user, institucion=None, jefes_cache=None):
    data = PoliceUserSerializer(user).data
    profile = user.profile
    jur = profile.jurisdiccion
    data["zona"] = profile.zona or (jur.nombre if jur else "")
    data["requiere_zona"] = profile.role in ZONE_ROLES
    data["alcance_global"] = profile.role == SystemRole.VISOR_EJECUTIVO
    jefe = None
    if jur and profile.role != SystemRole.DIRECTOR_ZONA:
        jefe = _jefe_de_zona(jur.id, institucion, cache=jefes_cache)
    elif profile.role == SystemRole.DIRECTOR_ZONA and jur:
        jefe = user
    payload = _jefe_payload(jefe)
    data["jefe_zona"] = (
        {"id": payload["id"], "nombre": payload["nombre"], "email": payload["email"]}
        if payload
        else None
    )
    return data


def _jurisdicciones_payload(qs, institucion, all_jurs=None):
    all_jurs = all_jurs or qs
    jefes = _load_jefes_por_zona(institucion)
    trees = _descendant_index(all_jurs)
    rows = _profile_rows(institucion)
    by_id = {j.id: j for j in all_jurs}
    data = JurisdictionSerializer(qs, many=True).data
    for row in data:
        jur = by_id.get(row["id"])
        jefe = _jefe_for_jurisdiction(jur, jefes) if jur else jefes.get(row["id"])
        counts = _counts_for_tree(rows, trees.get(row["id"], [row["id"]]), row["nombre"])
        row["jefe_zona"] = (
            {
                "id": jefe.id,
                "nombre": f"{jefe.first_name} {jefe.last_name}".strip() or jefe.email,
                "email": jefe.email,
                "role_label": (
                    jefe.profile.get_role_display()
                    if hasattr(jefe, "profile")
                    else "Director / Jefe de Zona"
                ),
            }
            if jefe
            else None
        )
        row["personal_count"] = counts["total"]
    return data


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def jurisdicciones_collection(request):
    if request.method == "GET":
        scope = request.query_params.get("scope")
        db_qs = Jurisdiction.objects.select_related("parent")
        if scope == "mapa":
            db_qs = db_qs.filter(
                activo=True,
                tipo__in=(JurisdictionType.ZONA, JurisdictionType.SUBZONA),
            )
        else:
            tipo = request.query_params.get("tipo")
            if tipo:
                db_qs = db_qs.filter(tipo=tipo)
            activo = request.query_params.get("activo")
            if activo is not None:
                flag = activo.lower() in ("1", "true", "yes")
                db_qs = db_qs.filter(activo=flag)

        qs = list(db_qs)
        all_jurs = list(Jurisdiction.objects.select_related("parent").all())
        institucion = _institucion_of(request)
        return Response(_jurisdicciones_payload(qs, institucion, all_jurs))

    serializer = JurisdictionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(JurisdictionSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def jurisdiccion_detail(request, pk):
    try:
        obj = Jurisdiction.objects.select_related("parent").get(pk=pk)
    except Jurisdiction.DoesNotExist:
        return Response({"detail": "Jurisdicción no encontrada."}, status=404)

    if request.method == "GET":
        return Response(JurisdictionSerializer(obj).data)

    serializer = JurisdictionSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(JurisdictionSerializer(obj).data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def jurisdiccion_personal(request, pk):
    """Detalle de usuarios que trabajan en la zona/jurisdicción (y descendientes)."""
    try:
        obj = Jurisdiction.objects.get(pk=pk)
    except Jurisdiction.DoesNotExist:
        return Response({"detail": "Jurisdicción no encontrada."}, status=404)

    institucion = _institucion_of(request)
    payload = _personal_payload(obj, institucion)
    return Response(payload)


def _personal_payload(obj: Jurisdiction, institucion):
    tree_ids = _collect_descendant_ids(obj)
    labels = list(
        Jurisdiction.objects.filter(id__in=tree_ids).values_list("nombre", flat=True)
    )

    qs = (
        _users_qs(institucion)
        .filter(Q(profile__jurisdiccion_id__in=tree_ids) | Q(profile__zona__in=labels))
        .exclude(
            profile__role__in=[SystemRole.ADMIN_SISTEMA, SystemRole.SUPERADMIN_SAAS]
        )
    )

    jefes = _load_jefes_por_zona(institucion)
    jefe = _jefe_for_jurisdiction(obj, jefes)
    users = list(qs.order_by("profile__role", "last_name", "first_name"))
    return {
        "jurisdiccion": JurisdictionSerializer(obj).data,
        "jefe_zona": _jefe_payload(jefe),
        "personal": [_serialize_asignacion(u, institucion, jefes) for u in users],
        "total": len(users),
    }


@api_view(["GET"])
@permission_classes([AdminOnly])
def jurisdiccion_personal_pdf(request, pk):
    """PDF del personal de la zona — se abre inline en el navegador."""
    from django.http import HttpResponse

    from roles.administrador.modulos.estructura_organizacional.pdf_zona import (
        build_zona_personal_pdf,
    )

    try:
        obj = Jurisdiction.objects.get(pk=pk)
    except Jurisdiction.DoesNotExist:
        return Response({"detail": "Jurisdicción no encontrada."}, status=404)

    institucion = _institucion_of(request)
    payload = _personal_payload(obj, institucion)
    emisor = (
        f"{request.user.first_name} {request.user.last_name}".strip()
        or request.user.email
    )
    pdf = build_zona_personal_pdf(payload, emisor=emisor)
    slug = (obj.codigo or obj.nombre or "zona").replace(" ", "_")
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="zona_{slug}_personal.pdf"'
    return resp


@api_view(["POST"])
@permission_classes([AdminOnly])
def jurisdiccion_restablecer_asignaciones(request, pk):
    """Quita a todos los usuarios asignados a esta zona (no borra la zona)."""
    try:
        obj = Jurisdiction.objects.get(pk=pk)
    except Jurisdiction.DoesNotExist:
        return Response({"detail": "Jurisdicción no encontrada."}, status=404)

    institucion = _institucion_of(request)
    tree_ids = _collect_descendant_ids(obj)
    labels = list(
        Jurisdiction.objects.filter(id__in=tree_ids).values_list("nombre", flat=True)
    )

    qs = UserProfile.objects.filter(
        Q(jurisdiccion_id__in=tree_ids) | Q(zona__in=labels)
    ).exclude(role__in=[SystemRole.ADMIN_SISTEMA, SystemRole.SUPERADMIN_SAAS])
    if institucion:
        qs = qs.filter(institucion=institucion)

    n = qs.count()
    qs.update(jurisdiccion=None, zona="", departamento=None)
    return Response(
        {
            "detail": f"Se restablecieron {n} asignación(es) de «{obj.nombre}».",
            "liberados": n,
            "jurisdiccion_id": obj.id,
        }
    )


@api_view(["POST"])
@permission_classes([AdminOnly])
def jurisdiccion_inactivar(request, pk):
    try:
        obj = Jurisdiction.objects.get(pk=pk)
    except Jurisdiction.DoesNotExist:
        return Response({"detail": "Jurisdicción no encontrada."}, status=404)
    obj.activo = False
    obj.save(update_fields=["activo"])
    return Response(JurisdictionSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def plazas(request):
    """Asignación de funcionarios a zonas (jurisdicciones)."""
    institucion = _institucion_of(request)

    if request.method == "GET":
        qs = _users_qs(institucion).exclude(
            profile__role__in=[SystemRole.ADMIN_SISTEMA, SystemRole.SUPERADMIN_SAAS]
        )
        role = request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role)
        sin_zona = request.query_params.get("sin_zona")
        if sin_zona and sin_zona.lower() in ("1", "true", "yes"):
            qs = qs.filter(
                profile__role__in=ZONE_ROLES,
                profile__jurisdiccion__isnull=True,
            )
        jurisdiccion_id = request.query_params.get("jurisdiccion_id")
        if jurisdiccion_id:
            qs = qs.filter(profile__jurisdiccion_id=jurisdiccion_id)
        jefes = _load_jefes_por_zona(institucion)
        return Response(
            [
                _serialize_asignacion(u, institucion, jefes)
                for u in qs.order_by("profile__role", "last_name", "first_name")
            ]
        )

    # Batch: user_ids[] o user_id único
    raw_ids = request.data.get("user_ids")
    if raw_ids is None and request.data.get("user_id") is not None:
        raw_ids = [request.data.get("user_id")]
    if not raw_ids:
        return Response({"detail": "Indique user_id o user_ids."}, status=400)

    jur_id = request.data.get("jurisdiccion_id", "__missing__")
    unassign = request.data.get("unassign") or jur_id is None
    results = []
    errors = []
    jefes = _load_jefes_por_zona(institucion)

    for uid in raw_ids:
        try:
            user = User.objects.select_related("profile", "profile__jurisdiccion").get(
                pk=uid
            )
        except User.DoesNotExist:
            errors.append({"user_id": uid, "detail": "Usuario no encontrado."})
            continue

        profile = user.profile
        role = profile.role

        if role == SystemRole.VISOR_EJECUTIVO:
            errors.append(
                {
                    "user_id": uid,
                    "detail": "El Visor Ejecutivo no requiere asignación de zona.",
                }
            )
            continue

        if role not in ZONE_ROLES:
            errors.append(
                {"user_id": uid, "detail": "Este rol no admite asignación territorial."}
            )
            continue

        if unassign or jur_id is None:
            had_zona = profile.jurisdiccion_id is not None
            profile.jurisdiccion = None
            profile.zona = ""
            profile.departamento = None
            profile.save(update_fields=["jurisdiccion", "zona", "departamento"])
            if had_zona:
                _notify_asignacion_zona(user, None, desasignado=True)
            results.append(_serialize_asignacion(user, institucion, jefes))
            continue

        try:
            jur = Jurisdiction.objects.select_related("parent").get(pk=jur_id, activo=True)
        except Jurisdiction.DoesNotExist:
            return Response(
                {"detail": "Zona no encontrada o inactiva."}, status=404
            )

        # El Jefe de Zona siempre se ancla a la Zona raíz (no a subzona/distrito).
        if role == SystemRole.DIRECTOR_ZONA:
            jur = _zona_raiz(jur)
            if jur.tipo != JurisdictionType.ZONA:
                errors.append(
                    {
                        "user_id": uid,
                        "detail": "El Jefe de Zona solo puede asignarse a una Zona.",
                    }
                )
                continue
            prev = UserProfile.objects.filter(
                role=SystemRole.DIRECTOR_ZONA,
                jurisdiccion_id=jur.id,
                estado=AccountStatus.ACTIVO,
            ).exclude(user_id=user.id)
            if institucion:
                prev = prev.filter(
                    Q(institucion=institucion) | Q(institucion__isnull=True)
                )
            for other in prev.select_related("user"):
                other.jurisdiccion = None
                other.zona = ""
                other.save(update_fields=["jurisdiccion", "zona"])
                _notify_asignacion_zona(other.user, jur, desasignado=True)

        profile.jurisdiccion = jur
        profile.zona = jur.nombre
        profile.departamento = None
        update_fields = ["jurisdiccion", "zona", "departamento"]
        if institucion and not profile.institucion_id:
            profile.institucion = institucion
            update_fields.append("institucion")
        profile.save(update_fields=update_fields)
        user = User.objects.select_related(
            "profile", "profile__jurisdiccion", "profile__departamento"
        ).get(pk=user.id)
        _notify_asignacion_zona(user, jur)
        jefes = _load_jefes_por_zona(institucion)
        results.append(_serialize_asignacion(user, institucion, jefes))

    return Response({"results": results, "errors": errors})


@api_view(["GET"])
@permission_classes([AdminOnly])
def catalogos(request):
    institucion = _institucion_of(request)
    preselect = request.query_params.get("jurisdiccion_id")
    zonas = list(
        Jurisdiction.objects.filter(activo=True)
        .select_related("parent")
        .order_by("tipo", "nombre")
    )
    jefes = _load_jefes_por_zona(institucion)
    trees = _descendant_index(zonas)
    rows = _profile_rows(institucion)
    zonas_data = []
    for z in zonas:
        jefe = _jefe_for_jurisdiction(z, jefes)
        payload = _jefe_payload(jefe)
        zonas_data.append(
            {
                "id": z.id,
                "tipo": z.tipo,
                "tipo_label": z.get_tipo_display(),
                "nombre": z.nombre,
                "codigo": z.codigo,
                "parent_id": z.parent_id,
                "parent_nombre": z.parent.nombre if z.parent_id else None,
                "disponible_jefe": jefe is None if z.tipo == JurisdictionType.ZONA else None,
                "jefe_zona": payload,
                "conteos": _counts_for_tree(rows, trees.get(z.id, [z.id]), z.nombre),
            }
        )

    return Response(
        {
            "tipos_jurisdiccion": [
                {"code": c, "label": l} for c, l in JurisdictionType.choices
            ],
            "jurisdiccion_id": int(preselect) if str(preselect or "").isdigit() else None,
            "zonas": zonas_data,
            "roles_con_zona": [
                {"code": r, "label": dict(SystemRole.choices).get(r, r)}
                for r in (
                    SystemRole.DIRECTOR_ZONA,
                    SystemRole.SUPERVISOR_UNIDAD,
                    SystemRole.DETECTIVE,
                    SystemRole.AGENTE_OPERATIVO,
                )
            ],
        }
    )
