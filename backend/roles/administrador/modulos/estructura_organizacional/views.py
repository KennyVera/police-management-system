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
from tactico.services.geo_scope import _collect_descendant_ids

ZONE_ROLES = {
    SystemRole.DIRECTOR_ZONA,
    SystemRole.SUPERVISOR_UNIDAD,
    SystemRole.DETECTIVE,
    SystemRole.AGENTE_OPERATIVO,
}

NO_ZONE_ROLES = {
    SystemRole.VISOR_EJECUTIVO,
    SystemRole.ADMIN_SISTEMA,
    SystemRole.SUPERADMIN_SAAS,
}


def _institucion_of(request):
    return getattr(getattr(request.user, "profile", None), "institucion", None)


def _users_qs(institucion=None):
    qs = User.objects.select_related(
        "profile", "profile__departamento", "profile__jurisdiccion"
    ).exclude(profile__isnull=True)
    if institucion:
        qs = qs.filter(profile__institucion=institucion)
    return qs


def _jefe_de_zona(jurisdiccion_id, institucion=None):
    qs = User.objects.select_related("profile").filter(
        profile__role=SystemRole.DIRECTOR_ZONA,
        profile__jurisdiccion_id=jurisdiccion_id,
        profile__estado=AccountStatus.ACTIVO,
    )
    if institucion:
        qs = qs.filter(profile__institucion=institucion)
    return qs.first()


def _serialize_asignacion(user, institucion=None):
    data = PoliceUserSerializer(user).data
    profile = user.profile
    jur = profile.jurisdiccion
    data["zona"] = profile.zona or (jur.nombre if jur else "")
    data["requiere_zona"] = profile.role in ZONE_ROLES
    data["alcance_global"] = profile.role == SystemRole.VISOR_EJECUTIVO
    jefe = None
    if jur and profile.role != SystemRole.DIRECTOR_ZONA:
        jefe = _jefe_de_zona(jur.id, institucion)
    elif profile.role == SystemRole.DIRECTOR_ZONA and jur:
        jefe = user
    if jefe:
        data["jefe_zona"] = {
            "id": jefe.id,
            "nombre": f"{jefe.first_name} {jefe.last_name}".strip() or jefe.email,
            "email": jefe.email,
        }
    else:
        data["jefe_zona"] = None
    return data


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def jurisdicciones_collection(request):
    if request.method == "GET":
        qs = Jurisdiction.objects.select_related("parent").all()
        tipo = request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
        activo = request.query_params.get("activo")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() in ("1", "true", "yes"))
        data = JurisdictionSerializer(qs, many=True).data
        institucion = _institucion_of(request)
        jur_map = {j.id: j for j in qs}
        for row in data:
            jur = jur_map.get(row["id"])
            jefe = _jefe_de_zona(row["id"], institucion)
            tree = _collect_descendant_ids(jur) if jur else [row["id"]]
            personal_qs = UserProfile.objects.filter(
                Q(jurisdiccion_id__in=tree) | Q(zona=row["nombre"]),
                estado=AccountStatus.ACTIVO,
            ).exclude(role__in=NO_ZONE_ROLES)
            if institucion:
                personal_qs = personal_qs.filter(institucion=institucion)
            row["jefe_zona"] = (
                {
                    "id": jefe.id,
                    "nombre": f"{jefe.first_name} {jefe.last_name}".strip() or jefe.email,
                }
                if jefe
                else None
            )
            row["personal_count"] = personal_qs.count()
        return Response(data)

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

    jefe = _jefe_de_zona(obj.id, institucion)
    return {
        "jurisdiccion": JurisdictionSerializer(obj).data,
        "jefe_zona": (
            {
                "id": jefe.id,
                "nombre": f"{jefe.first_name} {jefe.last_name}".strip() or jefe.email,
                "email": jefe.email,
            }
            if jefe
            else None
        ),
        "personal": [
            _serialize_asignacion(u, institucion)
            for u in qs.order_by("profile__role", "last_name", "first_name")
        ],
        "total": qs.count(),
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
        return Response(
            [
                _serialize_asignacion(u, institucion)
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
            profile.jurisdiccion = None
            profile.zona = ""
            profile.departamento = None
            profile.save(update_fields=["jurisdiccion", "zona", "departamento"])
            results.append(_serialize_asignacion(user, institucion))
            continue

        try:
            jur = Jurisdiction.objects.get(pk=jur_id, activo=True)
        except Jurisdiction.DoesNotExist:
            return Response(
                {"detail": "Zona no encontrada o inactiva."}, status=404
            )

        if role == SystemRole.DIRECTOR_ZONA:
            prev = UserProfile.objects.filter(
                role=SystemRole.DIRECTOR_ZONA,
                jurisdiccion_id=jur.id,
                estado=AccountStatus.ACTIVO,
            ).exclude(user_id=user.id)
            if institucion:
                prev = prev.filter(institucion=institucion)
            for other in prev:
                other.jurisdiccion = None
                other.zona = ""
                other.save(update_fields=["jurisdiccion", "zona"])

        profile.jurisdiccion = jur
        profile.zona = jur.nombre
        profile.departamento = None
        profile.save(update_fields=["jurisdiccion", "zona", "departamento"])
        user = User.objects.select_related(
            "profile", "profile__jurisdiccion", "profile__departamento"
        ).get(pk=user.id)
        results.append(_serialize_asignacion(user, institucion))

    return Response({"results": results, "errors": errors})


@api_view(["GET"])
@permission_classes([AdminOnly])
def catalogos(request):
    institucion = _institucion_of(request)
    zonas = Jurisdiction.objects.filter(activo=True).select_related("parent").order_by(
        "tipo", "nombre"
    )
    zonas_data = []
    for z in zonas:
        jefe = _jefe_de_zona(z.id, institucion)
        tree = _collect_descendant_ids(z)
        base = UserProfile.objects.filter(
            Q(jurisdiccion_id__in=tree) | Q(zona=z.nombre),
            estado=AccountStatus.ACTIVO,
        ).exclude(role__in=NO_ZONE_ROLES)
        if institucion:
            base = base.filter(institucion=institucion)

        def _count(role):
            return base.filter(role=role).count()

        zonas_data.append(
            {
                "id": z.id,
                "tipo": z.tipo,
                "tipo_label": z.get_tipo_display(),
                "nombre": z.nombre,
                "codigo": z.codigo,
                "parent_id": z.parent_id,
                "parent_nombre": z.parent.nombre if z.parent_id else None,
                "disponible_jefe": jefe is None,
                "jefe_zona": (
                    {
                        "id": jefe.id,
                        "nombre": f"{jefe.first_name} {jefe.last_name}".strip()
                        or jefe.email,
                        "email": jefe.email,
                        "role_label": jefe.profile.get_role_display(),
                    }
                    if jefe
                    else None
                ),
                "conteos": {
                    "supervisores": _count(SystemRole.SUPERVISOR_UNIDAD),
                    "detectives": _count(SystemRole.DETECTIVE),
                    "agentes": _count(SystemRole.AGENTE_OPERATIVO),
                    "total": base.count(),
                },
            }
        )

    return Response(
        {
            "tipos_jurisdiccion": [
                {"code": c, "label": l} for c, l in JurisdictionType.choices
            ],
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
