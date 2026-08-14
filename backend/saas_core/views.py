from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import UserProfile
from accounts.serializers import UserSerializer
from saas_core.models import Institucion, PlanSuscripcion, SuscripcionEvento
from saas_core.permissions import IsSuperAdminGlobal
from saas_core.serializers import (
    InstitucionSerializer,
    OnboardingRegistroSerializer,
    PlanAdminSerializer,
    PlanSuscripcionSerializer,
    SuscripcionEventoSerializer,
    SuscripcionListSerializer,
)


def _log_evento(
    *,
    institucion,
    accion,
    user=None,
    plan_anterior=None,
    plan_nuevo=None,
    estado_anterior="",
    estado_nuevo="",
    nota="",
):
    return SuscripcionEvento.objects.create(
        institucion=institucion,
        accion=accion,
        plan_anterior=plan_anterior,
        plan_nuevo=plan_nuevo,
        estado_anterior=estado_anterior or "",
        estado_nuevo=estado_nuevo or "",
        nota=nota or "",
        creado_por=user if getattr(user, "is_authenticated", False) else None,
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def list_planes(request):
    qs = PlanSuscripcion.objects.filter(activo=True, archivado=False).order_by(
        "orden", "precio_mensual"
    )
    return Response({"planes": PlanSuscripcionSerializer(qs, many=True).data})


@api_view(["POST"])
@permission_classes([AllowAny])
def registrar_institucion(request):
    """
    Onboarding multi-paso: crea Institución + Master Admin (ADMIN_SISTEMA)
    en una sola transacción y devuelve token de sesión (DRF Token).
    """
    serializer = OnboardingRegistroSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = serializer.save()
    user = result["user"]
    return Response(
        {
            "token": result["token"],
            "token_type": "Token",
            "user": UserSerializer(user).data,
            "institucion": InstitucionSerializer(result["institucion"]).data,
            "redirect": f"/app/{user.profile.role_slug}/dashboard",
            "detail": "Institución registrada. Sesión iniciada como Administrador de Institución.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def estadisticas_saas(request):
    """Dashboard SuperAdmin: MRR simulado, instituciones y tenants."""
    instituciones = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios"))

    activas = instituciones.filter(esta_activa=True)
    mrr = (
        activas.filter(plan_actual__isnull=False)
        .aggregate(total=Sum("plan_actual__precio_mensual"))
        .get("total")
        or 0
    )
    usuarios_totales = UserProfile.objects.exclude(role="SUPERADMIN_SAAS").count()

    tenants = []
    for inst in instituciones.order_by("-fecha_registro"):
        tenants.append(
            {
                "id": inst.id,
                "nombre_comercial": inst.nombre_comercial,
                "ruc": inst.ruc,
                "plan_actual": inst.plan_actual.nombre if inst.plan_actual_id else "—",
                "plan_codigo": inst.plan_actual.codigo if inst.plan_actual_id else None,
                "precio_mensual": float(inst.plan_actual.precio_mensual)
                if inst.plan_actual_id
                else 0,
                "esta_activa": inst.esta_activa,
                "estado_pago": inst.estado_pago,
                "estado_pago_label": inst.get_estado_pago_display(),
                "fecha_registro": inst.fecha_registro.isoformat()
                if inst.fecha_registro
                else None,
                "fecha_renovacion": inst.fecha_renovacion.isoformat()
                if inst.fecha_renovacion
                else None,
                "usuarios_count": inst.usuarios_count,
                "admin_email": getattr(inst.admin_institucional, "email", None),
            }
        )

    return Response(
        {
            "kpis": {
                "mrr": float(mrr),
                "instituciones_activas": activas.count(),
                "instituciones_totales": instituciones.count(),
                "usuarios_totales": usuarios_totales,
            },
            "tenants": tenants,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def tenant_detalle(request, pk):
    try:
        inst = Institucion.objects.select_related(
            "plan_actual", "admin_institucional"
        ).get(pk=pk)
    except Institucion.DoesNotExist:
        return Response({"detail": "Institución no encontrada."}, status=404)
    data = InstitucionSerializer(inst).data
    data["usuarios"] = [
        {
            "id": p.user_id,
            "email": p.user.email,
            "nombre": f"{p.user.first_name} {p.user.last_name}".strip(),
            "rol": p.role,
            "rol_label": p.get_role_display(),
            "estado": p.estado,
        }
        for p in UserProfile.objects.filter(institucion=inst)
        .select_related("user")
        .order_by("role", "user__last_name")[:100]
    ]
    return Response(data)


# ─── Planes (SuperAdmin) ─────────────────────────────────────────────────────


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_planes(request):
    if request.method == "GET":
        solo_archivados = request.query_params.get("archivados") == "1"
        qs = PlanSuscripcion.objects.annotate(
            instituciones_count=Count("instituciones")
        ).order_by("orden", "precio_mensual")
        qs = qs.filter(archivado=solo_archivados)
        return Response({"planes": PlanAdminSerializer(qs, many=True).data})

    data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
    if "codigo" in data and data["codigo"]:
        data["codigo"] = str(data["codigo"]).strip().upper().replace(" ", "_")
    serializer = PlanAdminSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    plan = serializer.save()
    plan = PlanSuscripcion.objects.annotate(
        instituciones_count=Count("instituciones")
    ).get(pk=plan.pk)
    return Response(
        PlanAdminSerializer(plan).data, status=status.HTTP_201_CREATED
    )


@api_view(["GET", "PATCH", "PUT"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_plan_detalle(request, pk):
    try:
        plan = PlanSuscripcion.objects.annotate(
            instituciones_count=Count("instituciones")
        ).get(pk=pk)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)

    if request.method == "GET":
        return Response(PlanAdminSerializer(plan).data)

    data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
    if "codigo" in data and data["codigo"]:
        data["codigo"] = str(data["codigo"]).strip().upper().replace(" ", "_")
    serializer = PlanAdminSerializer(plan, data=data, partial=True)
    serializer.is_valid(raise_exception=True)
    plan = serializer.save()
    plan = PlanSuscripcion.objects.annotate(
        instituciones_count=Count("instituciones")
    ).get(pk=plan.pk)
    return Response(PlanAdminSerializer(plan).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_plan_duplicar(request, pk):
    try:
        origen = PlanSuscripcion.objects.get(pk=pk)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)

    base = f"{origen.codigo}_COPIA"
    codigo = base
    n = 1
    while PlanSuscripcion.objects.filter(codigo__iexact=codigo).exists():
        n += 1
        codigo = f"{base}{n}"

    copia = PlanSuscripcion.objects.create(
        codigo=codigo,
        nombre=f"{origen.nombre} (copia)",
        descripcion=origen.descripcion,
        audiencia=origen.audiencia,
        precio_mensual=origen.precio_mensual,
        precio_anual=origen.precio_anual,
        limite_usuarios=origen.limite_usuarios,
        almacenamiento_gb=origen.almacenamiento_gb,
        tiene_analitica_avanzada=origen.tiene_analitica_avanzada,
        on_premise=origen.on_premise,
        modulos=list(origen.modulos or []),
        caracteristicas=origen.caracteristicas,
        activo=False,
        archivado=False,
        orden=origen.orden + 1,
    )
    copia = PlanSuscripcion.objects.annotate(
        instituciones_count=Count("instituciones")
    ).get(pk=copia.pk)
    return Response(
        PlanAdminSerializer(copia).data, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_plan_toggle_activo(request, pk):
    try:
        plan = PlanSuscripcion.objects.get(pk=pk)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)
    if "activo" in request.data:
        plan.activo = bool(request.data["activo"])
    else:
        plan.activo = not plan.activo
    plan.save(update_fields=["activo", "actualizado_en"])
    plan = PlanSuscripcion.objects.annotate(
        instituciones_count=Count("instituciones")
    ).get(pk=plan.pk)
    return Response(PlanAdminSerializer(plan).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_plan_archivar(request, pk):
    try:
        plan = PlanSuscripcion.objects.get(pk=pk)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)
    archivar = request.data.get("archivado", True)
    plan.archivado = bool(archivar)
    if plan.archivado:
        plan.activo = False
    plan.save(update_fields=["archivado", "activo", "actualizado_en"])
    plan = PlanSuscripcion.objects.annotate(
        instituciones_count=Count("instituciones")
    ).get(pk=plan.pk)
    return Response(PlanAdminSerializer(plan).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_plan_instituciones(request, pk):
    try:
        plan = PlanSuscripcion.objects.get(pk=pk)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)
    qs = (
        Institucion.objects.filter(plan_actual=plan)
        .select_related("admin_institucional", "plan_actual")
        .annotate(usuarios_count=Count("usuarios"))
        .order_by("nombre_comercial")
    )
    return Response(
        {
            "plan": PlanAdminSerializer(
                PlanSuscripcion.objects.annotate(
                    instituciones_count=Count("instituciones")
                ).get(pk=pk)
            ).data,
            "instituciones": SuscripcionListSerializer(qs, many=True).data,
        }
    )


# ─── Suscripciones (SuperAdmin) ───────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripciones(request):
    qs = (
        Institucion.objects.select_related("plan_actual", "admin_institucional")
        .annotate(usuarios_count=Count("usuarios"))
        .order_by("-fecha_registro")
    )
    estado = request.query_params.get("estado")
    if estado:
        qs = qs.filter(estado_pago=estado)
    return Response(
        {
            "suscripciones": SuscripcionListSerializer(qs, many=True).data,
            "planes": PlanAdminSerializer(
                PlanSuscripcion.objects.filter(archivado=False).annotate(
                    instituciones_count=Count("instituciones")
                ),
                many=True,
            ).data,
        }
    )


def _get_institucion_or_404(institucion_id):
    try:
        return Institucion.objects.select_related("plan_actual").get(pk=institucion_id)
    except Institucion.DoesNotExist:
        return None


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_asignar(request):
    institucion_id = request.data.get("institucion_id")
    plan_id = request.data.get("plan_id")
    nota = request.data.get("nota") or ""
    inst = _get_institucion_or_404(institucion_id)
    if not inst:
        return Response({"detail": "Institución no encontrada."}, status=404)
    try:
        plan = PlanSuscripcion.objects.get(pk=plan_id, archivado=False)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)

    anterior = inst.plan_actual
    estado_ant = inst.estado_pago
    inst.plan_actual = plan
    if inst.estado_pago in (
        Institucion.EstadoPago.CANCELADO,
        Institucion.EstadoPago.SUSPENDIDO,
    ):
        inst.estado_pago = Institucion.EstadoPago.ACTIVO
        inst.esta_activa = True
    if not inst.fecha_renovacion:
        inst.fecha_renovacion = (timezone.now() + timedelta(days=30)).date()
    inst.save()
    _log_evento(
        institucion=inst,
        accion=SuscripcionEvento.Accion.ASIGNAR,
        user=request.user,
        plan_anterior=anterior,
        plan_nuevo=plan,
        estado_anterior=estado_ant,
        estado_nuevo=inst.estado_pago,
        nota=nota,
    )
    inst = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios")).get(pk=inst.pk)
    return Response(SuscripcionListSerializer(inst).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_cambiar(request):
    institucion_id = request.data.get("institucion_id")
    plan_id = request.data.get("plan_id")
    nota = request.data.get("nota") or ""
    inst = _get_institucion_or_404(institucion_id)
    if not inst:
        return Response({"detail": "Institución no encontrada."}, status=404)
    try:
        plan = PlanSuscripcion.objects.get(pk=plan_id, archivado=False)
    except PlanSuscripcion.DoesNotExist:
        return Response({"detail": "Plan no encontrado."}, status=404)

    anterior = inst.plan_actual
    if anterior and anterior.pk == plan.pk:
        return Response({"detail": "La institución ya tiene este plan."}, status=400)

    inst.plan_actual = plan
    inst.save(update_fields=["plan_actual"])
    _log_evento(
        institucion=inst,
        accion=SuscripcionEvento.Accion.CAMBIAR,
        user=request.user,
        plan_anterior=anterior,
        plan_nuevo=plan,
        estado_anterior=inst.estado_pago,
        estado_nuevo=inst.estado_pago,
        nota=nota,
    )
    inst = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios")).get(pk=inst.pk)
    return Response(SuscripcionListSerializer(inst).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_renovar(request):
    institucion_id = request.data.get("institucion_id")
    meses = int(request.data.get("meses") or 1)
    nota = request.data.get("nota") or ""
    if meses < 1 or meses > 36:
        return Response({"detail": "Meses debe estar entre 1 y 36."}, status=400)
    inst = _get_institucion_or_404(institucion_id)
    if not inst:
        return Response({"detail": "Institución no encontrada."}, status=404)

    base = inst.fecha_renovacion or timezone.now().date()
    if base < timezone.now().date():
        base = timezone.now().date()
    # approx months as 30 days
    inst.fecha_renovacion = base + timedelta(days=30 * meses)
    estado_ant = inst.estado_pago
    if inst.estado_pago != Institucion.EstadoPago.CANCELADO:
        inst.estado_pago = Institucion.EstadoPago.ACTIVO
        inst.esta_activa = True
    inst.save()
    _log_evento(
        institucion=inst,
        accion=SuscripcionEvento.Accion.RENOVAR,
        user=request.user,
        plan_anterior=inst.plan_actual,
        plan_nuevo=inst.plan_actual,
        estado_anterior=estado_ant,
        estado_nuevo=inst.estado_pago,
        nota=nota or f"Renovación por {meses} mes(es)",
    )
    inst = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios")).get(pk=inst.pk)
    return Response(SuscripcionListSerializer(inst).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_suspender(request):
    institucion_id = request.data.get("institucion_id")
    nota = request.data.get("nota") or ""
    inst = _get_institucion_or_404(institucion_id)
    if not inst:
        return Response({"detail": "Institución no encontrada."}, status=404)
    estado_ant = inst.estado_pago
    inst.estado_pago = Institucion.EstadoPago.SUSPENDIDO
    inst.esta_activa = False
    inst.save(update_fields=["estado_pago", "esta_activa"])
    _log_evento(
        institucion=inst,
        accion=SuscripcionEvento.Accion.SUSPENDER,
        user=request.user,
        plan_anterior=inst.plan_actual,
        plan_nuevo=inst.plan_actual,
        estado_anterior=estado_ant,
        estado_nuevo=inst.estado_pago,
        nota=nota,
    )
    inst = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios")).get(pk=inst.pk)
    return Response(SuscripcionListSerializer(inst).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_cancelar(request):
    institucion_id = request.data.get("institucion_id")
    nota = request.data.get("nota") or ""
    inst = _get_institucion_or_404(institucion_id)
    if not inst:
        return Response({"detail": "Institución no encontrada."}, status=404)
    estado_ant = inst.estado_pago
    anterior = inst.plan_actual
    inst.estado_pago = Institucion.EstadoPago.CANCELADO
    inst.esta_activa = False
    inst.save(update_fields=["estado_pago", "esta_activa"])
    _log_evento(
        institucion=inst,
        accion=SuscripcionEvento.Accion.CANCELAR,
        user=request.user,
        plan_anterior=anterior,
        plan_nuevo=anterior,
        estado_anterior=estado_ant,
        estado_nuevo=inst.estado_pago,
        nota=nota,
    )
    inst = Institucion.objects.select_related(
        "plan_actual", "admin_institucional"
    ).annotate(usuarios_count=Count("usuarios")).get(pk=inst.pk)
    return Response(SuscripcionListSerializer(inst).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsSuperAdminGlobal])
def admin_suscripcion_historial(request, institucion_id):
    try:
        inst = Institucion.objects.get(pk=institucion_id)
    except Institucion.DoesNotExist:
        return Response({"detail": "Institución no encontrada."}, status=404)
    eventos = (
        SuscripcionEvento.objects.filter(institucion=inst)
        .select_related("plan_anterior", "plan_nuevo", "creado_por")
        .order_by("-creado_en")
    )
    return Response(
        {
            "institucion": InstitucionSerializer(inst).data,
            "historial": SuscripcionEventoSerializer(eventos, many=True).data,
        }
    )
