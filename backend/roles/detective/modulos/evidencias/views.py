from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

import hashlib

from accounts.permissions import DetectiveOnly
from operativo.minio_service import download_object, upload_evidencia
from operativo.models import EvidenciaCaso, ExpedienteCaso, MovimientoCustodia
from operativo.serializers import EvidenciaCasoSerializer, MovimientoCustodiaSerializer


def _expediente_asignado(user, pk):
    return ExpedienteCaso.objects.filter(detective_asignado=user).get(pk=pk)


def _locked(exp):
    if exp.bloqueado:
        return Response(
            {"detail": "Expediente bloqueado (Cerrado / Enviado a Fiscalía)."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _get_evidencia(user, pk):
    return (
        EvidenciaCaso.objects.filter(expediente__detective_asignado=user)
        .select_related("expediente")
        .prefetch_related("movimientos")
        .get(pk=pk)
    )


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def meta(request):
    return Response(
        {
            "tipos": [{"value": c.value, "label": c.label} for c in EvidenciaCaso.Tipo],
            "categorias_fisicas": [
                {"value": c.value, "label": c.label} for c in EvidenciaCaso.CategoriaFisica
            ],
            "estados_custodia": [
                {"value": c.value, "label": c.label}
                for c in EvidenciaCaso.EstadoCustodia
            ],
        }
    )


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def evidencias_collection(request):
    qs = (
        EvidenciaCaso.objects.filter(expediente__detective_asignado=request.user)
        .select_related("expediente", "registrado_por")
        .prefetch_related("movimientos")
    )
    expediente_id = request.query_params.get("expediente")
    if expediente_id:
        qs = qs.filter(expediente_id=expediente_id)
    tipo = request.query_params.get("tipo")
    if tipo:
        qs = qs.filter(tipo=tipo)
    return Response(EvidenciaCasoSerializer(qs, many=True).data)


@api_view(["GET", "DELETE"])
@permission_classes([DetectiveOnly])
def evidencia_detail(request, pk):
    try:
        obj = _get_evidencia(request.user, pk)
    except EvidenciaCaso.DoesNotExist:
        return Response({"detail": "Evidencia no encontrada."}, status=404)

    if request.method == "GET":
        return Response(EvidenciaCasoSerializer(obj).data)

    locked = _locked(obj.expediente)
    if locked:
        return locked
    obj.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([DetectiveOnly])
def evidencia_archivo(request, pk):
    """Sirve el archivo vía backend (evita fallos de URL firmada MinIO en el navegador)."""
    try:
        obj = _get_evidencia(request.user, pk)
    except EvidenciaCaso.DoesNotExist:
        return Response({"detail": "Evidencia no encontrada."}, status=404)
    if not obj.object_key:
        return Response({"detail": "Esta evidencia no tiene archivo digital."}, status=404)

    try:
        data = download_object(obj.object_key, obj.bucket or None)
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo leer el archivo en MinIO: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    filename = (obj.nombre_archivo or f"evidencia-{obj.id}").replace('"', "")
    as_download = request.query_params.get("download") in ("1", "true", "True")
    disposition = "attachment" if as_download else "inline"
    content_type = obj.content_type or "application/octet-stream"
    response = HttpResponse(data, content_type=content_type)
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    response["Content-Length"] = str(len(data))
    response["Cache-Control"] = "private, max-age=300"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api_view(["POST"])
@permission_classes([DetectiveOnly])
@parser_classes([MultiPartParser, FormParser])
def evidencia_digital(request):
    expediente_id = request.data.get("expediente")
    archivo = request.FILES.get("archivo")
    descripcion = (request.data.get("descripcion") or "").strip()
    if not expediente_id:
        return Response({"detail": "Indica el expediente."}, status=400)
    if not archivo:
        return Response({"detail": "Adjunta el archivo (campo archivo)."}, status=400)

    try:
        exp = _expediente_asignado(request.user, expediente_id)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    locked = _locked(exp)
    if locked:
        return locked

    file_bytes = archivo.read()
    sha256 = hashlib.sha256(file_bytes).hexdigest()
    if not descripcion:
        descripcion = archivo.name

    try:
        stored = upload_evidencia(
            file_bytes=file_bytes,
            filename=archivo.name,
            content_type=archivo.content_type or "application/octet-stream",
            folder=f"expedientes/{exp.id}",
        )
    except Exception as exc:  # noqa: BLE001
        return Response(
            {"detail": f"No se pudo subir a MinIO: {exc}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    detective_name = request.user.get_full_name() or request.user.username
    obj = EvidenciaCaso(
        expediente=exp,
        tipo=EvidenciaCaso.Tipo.DIGITAL,
        descripcion=descripcion,
        nombre_archivo=stored["nombre_archivo"],
        content_type=stored["content_type"] or "",
        tamanio_bytes=stored["tamanio_bytes"],
        bucket=stored["bucket"],
        object_key=stored["object_key"],
        sha256=sha256,
        estado_custodia=EvidenciaCaso.EstadoCustodia.EN_CUSTODIA,
        custodio_actual=detective_name,
        ubicacion_actual="Repositorio digital MinIO",
        registrado_por=request.user,
    )
    obj.ensure_codigo()
    obj.save()
    MovimientoCustodia.objects.create(
        evidencia=obj,
        entregado_por=detective_name,
        recibido_por=detective_name,
        destino="En custodia digital",
        motivo="Ingreso inicial de evidencia multimedia",
        registrado_por=request.user,
    )
    return Response(EvidenciaCasoSerializer(obj).data, status=201)


@api_view(["POST"])
@permission_classes([DetectiveOnly])
def evidencia_fisica(request):
    expediente_id = request.data.get("expediente")
    descripcion = (request.data.get("descripcion") or "").strip()
    categoria = (request.data.get("categoria_fisica") or "").strip()
    if not expediente_id:
        return Response({"detail": "Indica el expediente."}, status=400)
    if not descripcion:
        return Response({"detail": "Describe la evidencia física."}, status=400)
    valid_cat = {c.value for c in EvidenciaCaso.CategoriaFisica}
    if categoria not in valid_cat:
        return Response({"detail": "Categoría física inválida."}, status=400)

    try:
        exp = _expediente_asignado(request.user, expediente_id)
    except ExpedienteCaso.DoesNotExist:
        return Response({"detail": "Expediente no encontrado."}, status=404)

    locked = _locked(exp)
    if locked:
        return locked

    obj = EvidenciaCaso(
        expediente=exp,
        tipo=EvidenciaCaso.Tipo.FISICA,
        descripcion=descripcion,
        categoria_fisica=categoria,
        numero_serie=(request.data.get("numero_serie") or "").strip(),
        peso=(request.data.get("peso") or "").strip(),
        caracteristicas=(request.data.get("caracteristicas") or "").strip(),
        estado_custodia=EvidenciaCaso.EstadoCustodia.EN_CUSTODIA,
        custodio_actual=(
            request.data.get("custodio_actual")
            or request.user.get_full_name()
            or request.user.username
        ),
        ubicacion_actual=(request.data.get("ubicacion_actual") or "Bodega de evidencias").strip(),
        registrado_por=request.user,
    )
    obj.ensure_codigo()
    obj.save()
    return Response(EvidenciaCasoSerializer(obj).data, status=201)


@api_view(["POST"])
@permission_classes([DetectiveOnly])
def movimiento_custodia(request, pk):
    try:
        evidencia = _get_evidencia(request.user, pk)
    except EvidenciaCaso.DoesNotExist:
        return Response({"detail": "Evidencia no encontrada."}, status=404)

    locked = _locked(evidencia.expediente)
    if locked:
        return locked

    # Flujo simplificado (UI cadena de custodia): estado + motivo
    nuevo_estado = (request.data.get("estado_custodia") or "").strip()
    if nuevo_estado:
        valid = {c.value for c in EvidenciaCaso.EstadoCustodia}
        if nuevo_estado not in valid:
            return Response({"detail": "Estado de custodia inválido."}, status=400)
        motivo = (request.data.get("motivo") or "").strip() or f"Cambio a {nuevo_estado}"
        detective_name = request.user.get_full_name() or request.user.username
        label = dict(EvidenciaCaso.EstadoCustodia.choices).get(nuevo_estado, nuevo_estado)
        mov = MovimientoCustodia.objects.create(
            evidencia=evidencia,
            entregado_por=evidencia.custodio_actual or detective_name,
            recibido_por=detective_name,
            destino=label,
            motivo=motivo,
            observaciones=(request.data.get("observaciones") or "").strip(),
            registrado_por=request.user,
        )
        evidencia.estado_custodia = nuevo_estado
        evidencia.ubicacion_actual = label
        evidencia.custodio_actual = detective_name
        evidencia.save(
            update_fields=[
                "estado_custodia",
                "ubicacion_actual",
                "custodio_actual",
                "actualizado_en",
            ]
        )
        return Response(
            {
                "movimiento": MovimientoCustodiaSerializer(mov).data,
                "evidencia": EvidenciaCasoSerializer(evidencia).data,
            },
            status=201,
        )

    entregado_por = (request.data.get("entregado_por") or "").strip()
    recibido_por = (request.data.get("recibido_por") or "").strip()
    destino = (request.data.get("destino") or "").strip()
    motivo = (request.data.get("motivo") or "").strip()
    if not all([entregado_por, recibido_por, destino, motivo]):
        return Response(
            {"detail": "Completa entregado_por, recibido_por, destino y motivo."},
            status=400,
        )

    mov = MovimientoCustodia.objects.create(
        evidencia=evidencia,
        entregado_por=entregado_por,
        recibido_por=recibido_por,
        destino=destino,
        motivo=motivo,
        observaciones=(request.data.get("observaciones") or "").strip(),
        registrado_por=request.user,
    )
    evidencia.custodio_actual = recibido_por
    evidencia.ubicacion_actual = destino
    evidencia.save(update_fields=["custodio_actual", "ubicacion_actual", "actualizado_en"])
    return Response(MovimientoCustodiaSerializer(mov).data, status=201)
