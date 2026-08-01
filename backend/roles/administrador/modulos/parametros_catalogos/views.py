from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import AdminOnly
from catalogos.models import CatalogoItem, CatalogoOperativoTipo, TipoDelito, VariableGlobal
from catalogos.serializers import (
    CatalogoItemSerializer,
    TipoDelitoSerializer,
    VariableGlobalAdminSerializer,
)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def tipos_delito_collection(request):
    if request.method == "GET":
        qs = TipoDelito.objects.all()
        activo = request.query_params.get("activo")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() in ("1", "true", "yes"))
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(codigo__icontains=q))
        return Response(TipoDelitoSerializer(qs, many=True).data)

    serializer = TipoDelitoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(TipoDelitoSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def tipo_delito_detail(request, pk):
    try:
        obj = TipoDelito.objects.get(pk=pk)
    except TipoDelito.DoesNotExist:
        return Response({"detail": "Tipo de delito no encontrado."}, status=404)

    if request.method == "GET":
        return Response(TipoDelitoSerializer(obj).data)

    serializer = TipoDelitoSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(TipoDelitoSerializer(obj).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def tipo_delito_inactivar(request, pk):
    try:
        obj = TipoDelito.objects.get(pk=pk)
    except TipoDelito.DoesNotExist:
        return Response({"detail": "Tipo de delito no encontrado."}, status=404)
    obj.activo = False
    obj.save(update_fields=["activo"])
    return Response(TipoDelitoSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def catalogos_collection(request):
    if request.method == "GET":
        qs = CatalogoItem.objects.all()
        tipo = request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)
        activo = request.query_params.get("activo")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() in ("1", "true", "yes"))
        return Response(CatalogoItemSerializer(qs, many=True).data)

    serializer = CatalogoItemSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(CatalogoItemSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def catalogo_detail(request, pk):
    try:
        obj = CatalogoItem.objects.get(pk=pk)
    except CatalogoItem.DoesNotExist:
        return Response({"detail": "Ítem no encontrado."}, status=404)

    if request.method == "GET":
        return Response(CatalogoItemSerializer(obj).data)

    serializer = CatalogoItemSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(CatalogoItemSerializer(obj).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def catalogo_inactivar(request, pk):
    try:
        obj = CatalogoItem.objects.get(pk=pk)
    except CatalogoItem.DoesNotExist:
        return Response({"detail": "Ítem no encontrado."}, status=404)
    obj.activo = False
    obj.save(update_fields=["activo"])
    return Response(CatalogoItemSerializer(obj).data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def variables_collection(request):
    qs = VariableGlobal.objects.all()
    return Response(VariableGlobalAdminSerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([AdminOnly])
def variable_detail(request, pk):
    try:
        obj = VariableGlobal.objects.get(pk=pk)
    except VariableGlobal.DoesNotExist:
        return Response({"detail": "Variable no encontrada."}, status=404)

    serializer = VariableGlobalAdminSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(VariableGlobalAdminSerializer(obj).data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def meta_catalogos(request):
    return Response(
        {
            "tipos_catalogo_operativo": [
                {"code": c, "label": l} for c, l in CatalogoOperativoTipo.choices
            ]
        }
    )
