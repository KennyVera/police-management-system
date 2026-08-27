"""Panel Suscripción y Uso — Admin de Institución (tenant-scoped)."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import AccountStatus, SystemRole, UserProfile
from accounts.permissions import AdminOnly
from operativo.models import ParteAprehension
from saas_core.facturacion.services.pdf_svc import build_factura_pdf
from saas_core.models import Institucion, SuscripcionEvento
from saas_core.models_facturacion import Factura, UsageLog


def _institucion(request) -> Institucion | None:
    profile = getattr(request.user, "profile", None)
    if not profile:
        return None
    return getattr(profile, "institucion", None)


def _precio_periodo(inst: Institucion) -> Decimal:
    plan = inst.plan_actual
    if not plan:
        return Decimal("0")
    if inst.periodo_facturacion == "ANUAL" and plan.precio_anual is not None:
        return plan.precio_anual
    return plan.precio_mensual or Decimal("0")


def _demo_series(dias: int) -> dict:
    """Serie de demostración (solo si la institución no tiene datos reales)."""
    hoy = timezone.localdate()
    labels: list[str] = []
    partes_acc = 0
    series_partes: list[int] = []
    series_usuarios: list[int] = []
    bumps_p = [2, 3, 1, 4, 2, 5, 3, 4, 2, 3, 6, 2, 4, 3, 5]
    for i in range(dias - 1, -1, -1):
        d = hoy - timedelta(days=i)
        labels.append(d.isoformat())
        partes_acc += bumps_p[i % len(bumps_p)]
        series_partes.append(partes_acc)
        # Usuarios = plantilla estable (no se acumula)
        series_usuarios.append(3)
    return {
        "labels": labels,
        "series": [
            {
                "key": "partes",
                "label": "Partes policiales (acum.)",
                "data": series_partes,
                "modo": "acumulado",
            },
            {
                "key": "usuarios_activos",
                "label": "Usuarios activos",
                "data": series_usuarios,
                "modo": "nivel",
            },
        ],
        "fuente": "demo",
        "dias": dias,
        "resumen": {"partes_periodo": partes_acc, "usuarios_activos": 3},
    }


def _usuarios_activos_institucion(inst: Institucion) -> int:
    """Solo perfiles de ESTA institución (excluye superadmin / sin tenant)."""
    return (
        UserProfile.objects.filter(
            institucion_id=inst.id,
            estado=AccountStatus.ACTIVO,
        )
        .exclude(role=SystemRole.SUPERADMIN_SAAS)
        .count()
    )


def _build_uso(inst: Institucion, dias: int = 30) -> dict:
    hoy = timezone.localdate()
    inicio = hoy - timedelta(days=dias - 1)
    fechas = [inicio + timedelta(days=i) for i in range(dias)]
    labels = [d.isoformat() for d in fechas]

    logs = UsageLog.objects.filter(
        institucion_id=inst.id,
        fecha__gte=inicio,
        fecha__lte=hoy,
        metrica__in=[UsageLog.Metrica.PARTES, UsageLog.Metrica.USUARIOS_ACTIVOS],
    ).values("fecha", "metrica", "cantidad")

    by_key: dict[str, dict[date, int]] = {
        UsageLog.Metrica.PARTES: {},
        UsageLog.Metrica.USUARIOS_ACTIVOS: {},
    }
    for row in logs:
        by_key[row["metrica"]][row["fecha"]] = int(row["cantidad"] or 0)

    # Partes del tenant (nunca globales)
    if not by_key[UsageLog.Metrica.PARTES]:
        partes_qs = ParteAprehension.objects.filter(
            institucion_id=inst.id,
            fecha_hora__date__gte=inicio,
            fecha_hora__date__lte=hoy,
        )
        for row in (
            partes_qs.annotate(dia=TruncDate("fecha_hora"))
            .values("dia")
            .annotate(n=Count("id"))
        ):
            if row["dia"]:
                by_key[UsageLog.Metrica.PARTES][row["dia"]] = row["n"]

    activos_hoy = _usuarios_activos_institucion(inst)
    if not by_key[UsageLog.Metrica.USUARIOS_ACTIVOS]:
        # Sin historial: nivel constante = plantilla actual de la institución
        for d in fechas:
            by_key[UsageLog.Metrica.USUARIOS_ACTIVOS][d] = activos_hoy

    # Partes: acumulado diario. Usuarios: nivel (NO sumar día a día).
    partes_c: list[int] = []
    usuarios_n: list[int] = []
    total_partes = 0
    for d in fechas:
        total_partes += int(by_key[UsageLog.Metrica.PARTES].get(d, 0))
        partes_c.append(total_partes)
        usuarios_n.append(int(by_key[UsageLog.Metrica.USUARIOS_ACTIVOS].get(d, 0)))

    # Demo solo si la institución no tiene usuarios ni partes
    if total_partes == 0 and activos_hoy == 0:
        return _demo_series(dias)

    return {
        "labels": labels,
        "series": [
            {
                "key": "partes",
                "label": "Partes policiales (acum.)",
                "data": partes_c,
                "modo": "acumulado",
            },
            {
                "key": "usuarios_activos",
                "label": "Usuarios activos",
                "data": usuarios_n,
                "modo": "nivel",
            },
        ],
        "fuente": "datos",
        "dias": dias,
        "institucion_id": inst.id,
        "resumen": {
            "partes_periodo": total_partes,
            "usuarios_activos": activos_hoy,
        },
    }


def _serialize_factura(f: Factura) -> dict:
    estado_ui = "PENDIENTE"
    if f.estado == Factura.Estado.PAGADA:
        estado_ui = "PAGADO"
    elif f.estado in (Factura.Estado.VENCIDA, Factura.Estado.ANULADA):
        estado_ui = f.estado
    elif f.estado in (Factura.Estado.EMITIDA, Factura.Estado.BORRADOR):
        estado_ui = "PENDIENTE"

    return {
        "id": f.id,
        "numero": f.numero,
        "fecha": (f.fecha_emision or f.creado_en.date()).isoformat(),
        "monto": float(f.monto),
        "estado": f.estado,
        "estado_ui": estado_ui,
        "periodo_inicio": f.periodo_inicio.isoformat() if f.periodo_inicio else None,
        "periodo_fin": f.periodo_fin.isoformat() if f.periodo_fin else None,
        "pdf_url": f.pdf_url or "",
        "plan": f.plan.nombre if f.plan_id else None,
    }


@api_view(["GET"])
@permission_classes([AdminOnly])
def billing_dashboard(request):
    """Vista principal del panel (equivalente a BillingDashboardView)."""
    inst = _institucion(request)
    if not inst:
        return Response(
            {
                "detail": "Tu cuenta no está vinculada a una institución.",
                "plan": None,
                "uso": _demo_series(30),
                "facturas": [],
            },
            status=200,
        )

    plan = inst.plan_actual
    dias = int(request.query_params.get("dias") or 30)
    dias = 7 if dias <= 7 else 30

    usuarios_activos = _usuarios_activos_institucion(inst)
    partes_mes = ParteAprehension.objects.filter(
        institucion_id=inst.id,
        fecha_hora__date__gte=timezone.localdate().replace(day=1),
    ).count()

    facturas = [
        _serialize_factura(f)
        for f in Factura.objects.filter(institucion_id=inst.id)
        .select_related("plan")
        .order_by("-creado_en")[:24]
    ]

    # Facturas demo si no hay historial (preview UI)
    if not facturas:
        facturas = [
            {
                "id": -1,
                "numero": "FAC-DEMO-001",
                "fecha": (timezone.localdate() - timedelta(days=32)).isoformat(),
                "monto": float(_precio_periodo(inst) or 149),
                "estado": "PAGADA",
                "estado_ui": "PAGADO",
                "periodo_inicio": (timezone.localdate() - timedelta(days=62)).isoformat(),
                "periodo_fin": (timezone.localdate() - timedelta(days=32)).isoformat(),
                "pdf_url": "",
                "plan": plan.nombre if plan else "Plan demo",
                "demo": True,
            },
            {
                "id": -2,
                "numero": "FAC-DEMO-002",
                "fecha": (timezone.localdate() - timedelta(days=2)).isoformat(),
                "monto": float(_precio_periodo(inst) or 149),
                "estado": "EMITIDA",
                "estado_ui": "PENDIENTE",
                "periodo_inicio": (timezone.localdate() - timedelta(days=31)).isoformat(),
                "periodo_fin": timezone.localdate().isoformat(),
                "pdf_url": "",
                "plan": plan.nombre if plan else "Plan demo",
                "demo": True,
            },
        ]

    acceso_hasta = inst.fecha_renovacion.isoformat() if inst.fecha_renovacion else None

    return Response(
        {
            "module": "suscripcion_uso",
            "institucion": {
                "id": inst.id,
                "nombre": inst.nombre_comercial,
                "ruc": inst.ruc,
            },
            "plan": {
                "id": plan.id if plan else None,
                "codigo": plan.codigo if plan else None,
                "nombre": plan.nombre if plan else "Sin plan",
                "descripcion": (plan.descripcion if plan else "") or "",
                "precio": float(_precio_periodo(inst)),
                "periodo": inst.periodo_facturacion,
                "periodo_label": (
                    "Anual" if inst.periodo_facturacion == "ANUAL" else "Mensual"
                ),
                "proxima_renovacion": acceso_hasta,
                "estado_pago": inst.estado_pago,
                "estado_label": inst.get_estado_pago_display(),
                "cancelacion_solicitada": bool(inst.cancelacion_solicitada),
                "cancelacion_solicitada_en": (
                    inst.cancelacion_solicitada_en.isoformat()
                    if inst.cancelacion_solicitada_en
                    else None
                ),
                "acceso_hasta": acceso_hasta,
                "limite_usuarios": plan.limite_usuarios if plan else None,
                "almacenamiento_gb": plan.almacenamiento_gb if plan else None,
                "usuarios_activos": usuarios_activos,
                "partes_mes": partes_mes,
            },
            "uso": _build_uso(inst, dias=dias),
            "facturas": facturas,
            "generado_en": timezone.now().isoformat(),
        }
    )


@api_view(["POST"])
@permission_classes([AdminOnly])
def cancelar_suscripcion(request):
    """
    Cancela la renovación automática. El acceso se mantiene hasta fecha_renovacion.
    Requiere confirmacion=true en el body.
    """
    inst = _institucion(request)
    if not inst:
        return Response({"detail": "Sin institución asociada."}, status=400)

    conf = request.data.get("confirmacion")
    if conf not in (True, "true", "1", 1, "si", "sí", "yes"):
        return Response(
            {"detail": "Debes confirmar la cancelación (confirmacion=true)."},
            status=400,
        )

    if inst.cancelacion_solicitada:
        return Response(
            {
                "detail": "La cancelación ya estaba solicitada.",
                "acceso_hasta": (
                    inst.fecha_renovacion.isoformat() if inst.fecha_renovacion else None
                ),
            }
        )

    prev = inst.estado_pago
    inst.cancelacion_solicitada = True
    inst.cancelacion_solicitada_en = timezone.now()
    # No suspende ya: mantiene ACTIVO/PRUEBA hasta la fecha de corte
    inst.save(
        update_fields=[
            "cancelacion_solicitada",
            "cancelacion_solicitada_en",
        ]
    )

    SuscripcionEvento.objects.create(
        institucion=inst,
        accion=SuscripcionEvento.Accion.CANCELAR,
        plan_anterior=inst.plan_actual,
        plan_nuevo=inst.plan_actual,
        estado_anterior=prev,
        estado_nuevo=prev,
        nota=(
            request.data.get("motivo")
            or "Cancelación solicitada por administrador institucional. "
            "Acceso vigente hasta la fecha de renovación."
        ),
        creado_por=request.user,
    )

    return Response(
        {
            "detail": (
                "Suscripción marcada para no renovar. "
                "Conservarás el acceso hasta la fecha de corte."
            ),
            "cancelacion_solicitada": True,
            "acceso_hasta": (
                inst.fecha_renovacion.isoformat() if inst.fecha_renovacion else None
            ),
            "estado_pago": inst.estado_pago,
        }
    )


@api_view(["GET"])
@permission_classes([AdminOnly])
def factura_pdf(request, pk: int):
    inst = _institucion(request)
    if not inst:
        return Response({"detail": "Sin institución asociada."}, status=400)

    try:
        factura = Factura.objects.select_related("institucion", "plan").get(
            pk=pk, institucion=inst
        )
    except Factura.DoesNotExist:
        return Response({"detail": "Factura no encontrada."}, status=404)

    if factura.pdf_url:
        return Response({"pdf_url": factura.pdf_url, "redirect": True})

    emisor = (
        f"{request.user.first_name} {request.user.last_name}".strip()
        or request.user.email
        or "Administrador"
    )
    pdf = build_factura_pdf(factura, emisor=emisor)
    filename = f"{factura.numero or f'factura_{pk}'}.pdf".replace(" ", "_")
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    resp["Content-Length"] = str(len(pdf))
    return resp
