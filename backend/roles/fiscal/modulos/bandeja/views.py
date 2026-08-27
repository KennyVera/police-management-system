from django.contrib.auth.models import User
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import AccountStatus, SystemRole
from accounts.permissions import FiscalOnly
from operativo.minio_service import download_object
from operativo.models import (
    AsignacionCaso,
    ExpedienteCaso,
    Notificacion,
    ParteAprehension,
)
from operativo.notifications import notify_user
from operativo.pdf_service import build_pdf_bytes
from operativo.serializers import (
    ParteAprehensionSerializer,
    _user_label,
)


def _serialize_caso(asig: AsignacionCaso) -> dict:
    parte = asig.parte
    pdf_url = None
    if parte.pdf_object_key:
        try:
            from operativo.minio_service import get_presigned_url

            pdf_url = get_presigned_url(parte.pdf_object_key, parte.pdf_bucket or None)
        except Exception:  # noqa: BLE001
            pdf_url = None

    return {
        "id": asig.id,
        "estado": asig.estado,
        "estado_label": asig.get_estado_display(),
        "decision_notas": asig.decision_notas,
        "decidido_en": asig.decidido_en,
        "creado_en": asig.creado_en,
        "actualizado_en": asig.actualizado_en,
        "fiscal": _user_label(asig.fiscal),
        "detective": _user_label(asig.detective),
        "expediente_id": asig.expediente_id,
        "expediente_numero": (
            asig.expediente.numero_expediente if asig.expediente_id else None
        ),
        "parte": ParteAprehensionSerializer(parte).data,
        "parte_resumen": {
            "id": parte.id,
            "numero_caso": parte.numero_caso,
            "titulo": parte.titulo,
            "lugar": parte.lugar,
            "sector_zona": parte.sector_zona,
            "prioridad": parte.prioridad,
            "tipo_delito": getattr(parte.tipo_delito, "nombre", None),
            "fecha_hecho": parte.fecha_hecho,
            "aprobado_en": parte.aprobado_en,
            "creado_por": _user_label(parte.creado_por),
            "tiene_pdf": bool(parte.pdf_object_key),
            "pdf_url": pdf_url,
        },
    }


def _get_caso(pk) -> AsignacionCaso | None:
    try:
        return (
            AsignacionCaso.objects.select_related(
                "parte",
                "parte__tipo_delito",
                "parte__creado_por",
                "parte__creado_por__profile",
                "fiscal",
                "fiscal__profile",
                "detective",
                "detective__profile",
                "expediente",
            ).get(pk=pk)
        )
    except AsignacionCaso.DoesNotExist:
        return None


@api_view(["GET"])
@permission_classes([FiscalOnly])
def meta(request):
    detectives = [
        _user_label(u)
        for u in User.objects.filter(
            profile__role=SystemRole.DETECTIVE,
            profile__estado=AccountStatus.ACTIVO,
            is_active=True,
        )
        .select_related("profile")
        .order_by("first_name", "last_name")
    ]
    return Response(
        {
            "detectives": detectives,
            "estados": [
                {"value": c.value, "label": c.label} for c in AsignacionCaso.Estado
            ],
        }
    )


@api_view(["GET"])
@permission_classes([FiscalOnly])
def casos_collection(request):
    estado = (request.query_params.get("estado") or "pendientes").lower()
    qs = AsignacionCaso.objects.select_related(
        "parte",
        "parte__tipo_delito",
        "parte__creado_por",
        "parte__creado_por__profile",
        "fiscal",
        "fiscal__profile",
        "detective",
        "detective__profile",
        "expediente",
    ).order_by("-creado_en")

    if estado in ("pendientes", "pendiente"):
        qs = qs.filter(estado=AsignacionCaso.Estado.PENDIENTE_FISCAL)
    elif estado == "despacho":
        qs = qs.filter(estado=AsignacionCaso.Estado.DESPACHO_ADMIN)
    elif estado in ("investigacion", "indagacion"):
        qs = qs.filter(estado=AsignacionCaso.Estado.EN_INVESTIGACION)
    elif estado == "mios":
        qs = qs.filter(fiscal=request.user)
    elif estado not in ("todos", "all", ""):
        qs = qs.filter(estado=estado.upper())

    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(
            Q(parte__numero_caso__icontains=q)
            | Q(parte__titulo__icontains=q)
            | Q(parte__lugar__icontains=q)
            | Q(parte__tipo_delito__nombre__icontains=q)
        )

    return Response([_serialize_caso(a) for a in qs[:100]])


@api_view(["GET"])
@permission_classes([FiscalOnly])
def caso_detail(request, pk):
    asig = _get_caso(pk)
    if not asig:
        return Response({"detail": "Caso no encontrado."}, status=404)
    return Response(_serialize_caso(asig))


@api_view(["GET"])
@permission_classes([FiscalOnly])
def caso_pdf(request, pk):
    """Sirve el PDF del parte vía API autenticada (evita fallos de URL firmada MinIO)."""
    asig = _get_caso(pk)
    if not asig:
        return Response({"detail": "Caso no encontrado."}, status=404)

    parte = asig.parte
    pdf_bytes = None
    if parte.pdf_object_key:
        try:
            pdf_bytes = download_object(parte.pdf_object_key, parte.pdf_bucket or None)
        except Exception:  # noqa: BLE001
            pdf_bytes = None

    if not pdf_bytes:
        try:
            pdf_bytes = build_pdf_bytes(parte, generado_por=request.user)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"No se pudo obtener el PDF: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    filename = f"{parte.numero_caso or f'parte-{parte.id}'}.pdf"
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


@api_view(["POST"])
@permission_classes([FiscalOnly])
def despacho_admin(request, pk):
    """Opción A: delito menor / contravención → despacho administrativo."""
    asig = _get_caso(pk)
    if not asig:
        return Response({"detail": "Caso no encontrado."}, status=404)
    if asig.estado != AsignacionCaso.Estado.PENDIENTE_FISCAL:
        return Response(
            {"detail": "Solo se puede despachar casos pendientes de revisión fiscal."},
            status=400,
        )

    notas = (request.data.get("notas") or request.data.get("decision_notas") or "").strip()
    asig.fiscal = request.user
    asig.estado = AsignacionCaso.Estado.DESPACHO_ADMIN
    asig.decision_notas = notas
    asig.decidido_en = timezone.now()
    asig.save(
        update_fields=[
            "fiscal",
            "estado",
            "decision_notas",
            "decidido_en",
            "actualizado_en",
        ]
    )

    if asig.parte.creado_por_id:
        notify_user(
            user=asig.parte.creado_por,
            tipo=Notificacion.Tipo.SISTEMA,
            titulo="Parte con despacho administrativo",
            mensaje=(
                f"El Fiscal resolvió el parte {asig.parte.numero_caso or asig.parte_id} "
                "por vía administrativa (contravención / delito menor)."
            ),
            parte=asig.parte,
            enlace="/app/agente_operativo/registro_operativo/partes_aprehension",
        )

    return Response(_serialize_caso(asig))


@api_view(["POST"])
@permission_classes([FiscalOnly])
def abrir_investigacion(request, pk):
    """Opción B: delito grave → abre expediente y asigna detective."""
    asig = _get_caso(pk)
    if not asig:
        return Response({"detail": "Caso no encontrado."}, status=404)
    if asig.estado != AsignacionCaso.Estado.PENDIENTE_FISCAL:
        return Response(
            {"detail": "Solo se puede abrir investigación en casos pendientes."},
            status=400,
        )

    detective_id = request.data.get("detective") or request.data.get("detective_id")
    if not detective_id:
        return Response({"detail": "Debes seleccionar un detective."}, status=400)

    try:
        detective = User.objects.select_related("profile").get(
            pk=detective_id,
            profile__role=SystemRole.DETECTIVE,
            profile__estado=AccountStatus.ACTIVO,
            is_active=True,
        )
    except User.DoesNotExist:
        return Response({"detail": "Detective no encontrado o inactivo."}, status=404)

    notas = (request.data.get("notas") or request.data.get("decision_notas") or "").strip()
    parte = asig.parte

    documento = (
        f"Parte policial {parte.numero_caso or parte.id}\n"
        f"Título: {parte.titulo}\n"
        f"Lugar: {parte.lugar}\n"
        f"Sector: {parte.sector_zona}\n"
        f"Hechos: {parte.descripcion or parte.relato_hechos or ''}\n"
        f"Decisión fiscal: Indagación previa.\n"
        f"{notas}"
    ).strip()

    exp = ExpedienteCaso(
        titulo=parte.titulo or f"Caso parte {parte.numero_caso or parte.id}",
        descripcion=(parte.descripcion or parte.relato_hechos or "")[:2000],
        estado=ExpedienteCaso.Estado.INDAGACION_PREVIA,
        prioridad=parte.prioridad or ExpedienteCaso.Prioridad.MEDIA,
        detective_asignado=detective,
        jefe_asignador=request.user,
        tipo_delito=parte.tipo_delito,
        origen_documento=ExpedienteCaso.OrigenDocumento.PARTE_APREHENSION,
        parte_origen=parte,
        documento_base=documento,
        fecha_hechos=parte.fecha_hecho,
        lugar=parte.lugar or "",
        unidad=getattr(getattr(request.user, "profile", None), "unidad", "")
        or "Fiscalía de Turno",
    )
    exp.save()

    asig.fiscal = request.user
    asig.detective = detective
    asig.expediente = exp
    asig.estado = AsignacionCaso.Estado.EN_INVESTIGACION
    asig.decision_notas = notas
    asig.decidido_en = timezone.now()
    asig.save(
        update_fields=[
            "fiscal",
            "detective",
            "expediente",
            "estado",
            "decision_notas",
            "decidido_en",
            "actualizado_en",
        ]
    )

    fiscal_nombre = (
        f"{request.user.first_name} {request.user.last_name}".strip()
        or request.user.username
    )
    delito = getattr(parte.tipo_delito, "nombre", None) or parte.titulo or "delito"
    caso_label = parte.numero_caso or f"#{parte.id}"

    notify_user(
        user=detective,
        tipo=Notificacion.Tipo.CASO_FISCAL,
        titulo=f"Caso asignado por Fiscalía: {caso_label}",
        mensaje=(
            f"El Fiscal {fiscal_nombre} te ha asignado el Caso {caso_label} "
            f"por {delito}. Expediente {exp.numero_expediente}."
        ),
        parte=parte,
        enlace=f"/app/detective/casos?exp={exp.id}",
    )

    return Response(_serialize_caso(asig), status=status.HTTP_201_CREATED)
