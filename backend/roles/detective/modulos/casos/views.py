from django.http import HttpResponse
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import DetectiveOnly
from catalogos.models import TipoDelito
from operativo.minio_service import download_object, upload_evidencia
from operativo.models import ExpedienteCaso, InvolucradoExpediente
from operativo.notifications import notify_user
from operativo.serializers import (
    ExpedienteCasoSerializer,
    InvolucradoExpedienteSerializer,
    TipoDelitoMiniSerializer,
)


def _expedientes_qs(user):
    return (
        ExpedienteCaso.objects.filter(detective_asignado=user)
        .select_related("tipo_delito", "detective_asignado", "jefe_asignador", "parte_origen")
        .prefetch_related("involucrados", "evidencias", "bitacora")
    )


def _locked(exp):
    if exp.bloqueado:
        return Response(
            {"detail": "Expediente bloqueado (Cerrado / Enviado a Fiscalía)."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def meta(request):
    unidades = (
        ExpedienteCaso.objects.filter(detective_asignado=request.user)
        .exclude(unidad="")
        .values_list("unidad", flat=True)
        .distinct()
        .order_by("unidad")
    )
    return Response(
        {
            "estados": [
                {"value": c.value, "label": c.label} for c in ExpedienteCaso.Estado
            ],
            "prioridades": [
                {"value": c.value, "label": c.label} for c in ExpedienteCaso.Prioridad
            ],
            "origenes_documento": [
                {"value": c.value, "label": c.label}
                for c in ExpedienteCaso.OrigenDocumento
            ],
            "tipos_involucrado": [
                {"value": c.value, "label": c.label} for c in InvolucradoExpediente.Tipo
            ],
            "generos_involucrado": [
                {"value": c.value, "label": c.label} for c in InvolucradoExpediente.Genero
            ],
            "estados_civiles": [
                {"value": c.value, "label": c.label}
                for c in InvolucradoExpediente.EstadoCivil
            ],
            "tipos_delito": TipoDelitoMiniSerializer(
                TipoDelito.objects.filter(activo=True).order_by("nombre")[:200],
                many=True,
            ).data,
            "unidades": list(unidades),
        }
    )


@api_view(["GET", "POST"])
@permission_classes([DetectiveOnly])
def expedientes_collection(request):
    if request.method == "GET":
        qs = _expedientes_qs(request.user)
        estado = request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        prioridad = request.query_params.get("prioridad")
        if prioridad:
            qs = qs.filter(prioridad=prioridad)
        tipo_delito = request.query_params.get("tipo_delito")
        if tipo_delito:
            qs = qs.filter(tipo_delito_id=tipo_delito)
        unidad = (request.query_params.get("unidad") or "").strip()
        if unidad:
            qs = qs.filter(unidad__icontains=unidad)
        fecha_desde = request.query_params.get("fecha_desde")
        if fecha_desde:
            qs = qs.filter(creado_en__date__gte=fecha_desde)
        fecha_hasta = request.query_params.get("fecha_hasta")
        if fecha_hasta:
            qs = qs.filter(creado_en__date__lte=fecha_hasta)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(titulo__icontains=q)
                | Q(numero_expediente__icontains=q)
                | Q(codigo_caso__icontains=q)
                | Q(lugar__icontains=q)
                | Q(unidad__icontains=q)
                | Q(involucrados__nombres__icontains=q)
                | Q(involucrados__apellidos__icontains=q)
                | Q(involucrados__cedula__icontains=q)
                | Q(tipo_delito__nombre__icontains=q)
            ).distinct()
        return Response(ExpedienteCasoSerializer(qs, many=True).data)

    data = request.data.copy()
    data["detective_asignado"] = request.user.id
    ser = ExpedienteCasoSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(detective_asignado=request.user)
    notify_user(
        user=request.user,
        tipo="EXPEDIENTE_ASIGNADO",
        titulo=f"Expediente asignado: {obj.numero_expediente}",
        mensaje=(
            f"Se te asignó el caso «{obj.titulo}». "
            f"Documento base: {obj.get_origen_documento_display()}."
        ),
        enlace="/app/detective/casos",
    )
    return Response(ExpedienteCasoSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([DetectiveOnly])
def expediente_detail(request, pk):
    try:
        obj = _expedientes_qs(request.user).get(pk=pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if request.method == "GET":
        return Response(ExpedienteCasoSerializer(obj).data)

    locked = _locked(obj)
    if locked:
        return locked

    ser = ExpedienteCasoSerializer(obj, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.validated_data.pop("detective_asignado", None)
    ser.validated_data.pop("bloqueado", None)
    ser.validated_data.pop("estado", None)
    obj = ser.save()
    return Response(ExpedienteCasoSerializer(obj).data)


@api_view(["POST"])
@permission_classes([DetectiveOnly])
def expediente_cambiar_estado(request, pk):
    estado = (request.data.get("estado") or "").strip()
    valid = {c.value for c in ExpedienteCaso.Estado}
    if estado not in valid:
        return Response({"detail": "Estado inválido."}, status=400)
    if estado == ExpedienteCaso.Estado.CERRADO:
        return Response(
            {
                "detail": (
                    "Para cerrar y enviar a Fiscalía usa Actividades → "
                    "Informe Investigativo Final."
                )
            },
            status=400,
        )
    try:
        obj = _expedientes_qs(request.user).get(pk=pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    locked = _locked(obj)
    if locked:
        return locked

    obj.estado = estado
    if request.data.get("observaciones") is not None:
        obj.observaciones = request.data.get("observaciones") or ""
    obj.save(update_fields=["estado", "observaciones", "actualizado_en"])
    return Response(ExpedienteCasoSerializer(obj).data)


def _payload_involucrado(request):
    """Normaliza QueryDict / JSON a dict plano para el serializer."""
    raw = request.data
    keys = [
        "tipo",
        "nombres",
        "apellidos",
        "cedula",
        "fecha_nacimiento",
        "alias",
        "genero",
        "nacionalidad",
        "telefono",
        "direccion",
        "ocupacion",
        "estado_civil",
        "observaciones",
    ]
    data = {}
    for key in keys:
        if key not in raw:
            continue
        val = raw.get(key)
        if val in (None, ""):
            if key == "fecha_nacimiento":
                data[key] = None
            else:
                data[key] = ""
        else:
            data[key] = val
    return data


def _guardar_foto_involucrado(obj, archivo):
    if not archivo:
        return
    content_type = getattr(archivo, "content_type", "") or ""
    if content_type and not content_type.startswith("image/"):
        raise ValueError("La foto debe ser una imagen (JPG/PNG).")
    stored = upload_evidencia(
        file_bytes=archivo.read(),
        filename=archivo.name,
        content_type=content_type or "image/jpeg",
        folder=f"expedientes/{obj.expediente_id}/involucrados",
    )
    obj.foto_nombre = stored["nombre_archivo"]
    obj.foto_content_type = stored["content_type"] or ""
    obj.foto_bucket = stored["bucket"]
    obj.foto_object_key = stored["object_key"]
    obj.save(
        update_fields=[
            "foto_nombre",
            "foto_content_type",
            "foto_bucket",
            "foto_object_key",
            "actualizado_en",
        ]
    )


@api_view(["GET", "POST"])
@permission_classes([DetectiveOnly])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def involucrados_collection(request, pk):
    try:
        exp = _expedientes_qs(request.user).get(pk=pk)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    if request.method == "GET":
        return Response(
            InvolucradoExpedienteSerializer(exp.involucrados.all(), many=True).data
        )

    locked = _locked(exp)
    if locked:
        return locked

    data = {**_payload_involucrado(request), "expediente": exp.id}
    ser = InvolucradoExpedienteSerializer(data=data)
    ser.is_valid(raise_exception=True)
    obj = ser.save(expediente=exp)
    foto = request.FILES.get("foto")
    if foto:
        try:
            _guardar_foto_involucrado(obj, foto)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"detail": f"Involucrado creado, pero la foto falló: {exc}"},
                status=status.HTTP_201_CREATED,
            )
    return Response(InvolucradoExpedienteSerializer(obj).data, status=201)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([DetectiveOnly])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def involucrado_detail(request, pk, inv_id):
    try:
        exp = _expedientes_qs(request.user).get(pk=pk)
        obj = exp.involucrados.get(pk=inv_id)
    except (ExpedienteCaso.DoesNotExist, InvolucradoExpediente.DoesNotExist):
        return Response({"detail": "Involucrado no encontrado."}, status=404)

    if request.method == "GET":
        return Response(InvolucradoExpedienteSerializer(obj).data)

    locked = _locked(exp)
    if locked:
        return locked

    if request.method == "DELETE":
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    data = _payload_involucrado(request)
    ser = InvolucradoExpedienteSerializer(obj, data=data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.validated_data.pop("expediente", None)
    obj = ser.save()
    foto = request.FILES.get("foto")
    if foto:
        try:
            _guardar_foto_involucrado(obj, foto)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Datos guardados, pero la foto falló: {exc}"}, status=400)
    return Response(InvolucradoExpedienteSerializer(obj).data)


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def involucrado_foto(request, pk, inv_id):
    try:
        exp = _expedientes_qs(request.user).get(pk=pk)
        obj = exp.involucrados.get(pk=inv_id)
    except (ExpedienteCaso.DoesNotExist, InvolucradoExpediente.DoesNotExist):
        return Response({"detail": "Involucrado no encontrado."}, status=404)
    if not obj.foto_object_key:
        return Response({"detail": "Sin foto de perfil."}, status=404)
    try:
        data = download_object(obj.foto_object_key, obj.foto_bucket or None)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo leer la foto: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    filename = (obj.foto_nombre or f"involucrado-{obj.id}.jpg").replace('"', "")
    response = HttpResponse(data, content_type=obj.foto_content_type or "image/jpeg")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    response["Content-Length"] = str(len(data))
    response["Cache-Control"] = "private, max-age=300"
    return response


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def involucrado_perfil(request, pk, inv_id):
    """Perfil enriquecido: datos, stats e historial en expedientes del detective."""
    try:
        exp = _expedientes_qs(request.user).get(pk=pk)
        obj = exp.involucrados.get(pk=inv_id)
    except (ExpedienteCaso.DoesNotExist, InvolucradoExpediente.DoesNotExist):
        return Response({"detail": "Involucrado no encontrado."}, status=404)

    qs = InvolucradoExpediente.objects.filter(
        expediente__detective_asignado=request.user
    ).select_related("expediente", "expediente__tipo_delito")
    if (obj.cedula or "").strip():
        qs = qs.filter(cedula=obj.cedula.strip())
    else:
        qs = qs.filter(pk=obj.id)

    historial = []
    seen_exp = set()
    for row in qs.order_by("-expediente__creado_en"):
        if row.expediente_id in seen_exp:
            continue
        seen_exp.add(row.expediente_id)
        historial.append(
            {
                "involucrado_id": row.id,
                "tipo": row.tipo,
                "tipo_label": row.get_tipo_display(),
                "expediente_id": row.expediente_id,
                "codigo_caso": row.expediente.codigo_caso or "",
                "numero_expediente": row.expediente.numero_expediente or "",
                "titulo": row.expediente.titulo,
                "estado": row.expediente.estado,
                "estado_label": row.expediente.get_estado_display(),
                "delito": getattr(row.expediente.tipo_delito, "nombre", None) or "—",
                "fecha": row.expediente.creado_en,
                "nota": row.observaciones
                or f"Hay registros de que esta persona figura como {row.get_tipo_display().lower()}.",
            }
        )

    stats = {
        "total": len(historial),
        "victima": qs.filter(
            tipo__in=[
                InvolucradoExpediente.Tipo.VICTIMA,
                InvolucradoExpediente.Tipo.DENUNCIANTE,
            ]
        )
        .values("expediente_id")
        .distinct()
        .count(),
        "sospechoso": qs.filter(tipo=InvolucradoExpediente.Tipo.SOSPECHOSO)
        .values("expediente_id")
        .distinct()
        .count(),
        "testigo": qs.filter(tipo=InvolucradoExpediente.Tipo.TESTIGO)
        .values("expediente_id")
        .distinct()
        .count(),
    }

    return Response(
        {
            "involucrado": InvolucradoExpedienteSerializer(obj).data,
            "stats": stats,
            "historial": historial,
        }
    )
