from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import UserProfile
from accounts.permissions import AdminOnly
from accounts.serializers import (
    DepartmentSerializer,
    JurisdictionSerializer,
    PlazaAssignSerializer,
    PoliceUserSerializer,
)
from django.contrib.auth.models import User
from organizacion.models import Department, Jurisdiction, JurisdictionType


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
        return Response(JurisdictionSerializer(qs, many=True).data)

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
def departamentos_collection(request):
    if request.method == "GET":
        qs = Department.objects.all()
        activo = request.query_params.get("activo")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() in ("1", "true", "yes"))
        return Response(DepartmentSerializer(qs, many=True).data)

    serializer = DepartmentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(DepartmentSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([AdminOnly])
def departamento_detail(request, pk):
    try:
        obj = Department.objects.get(pk=pk)
    except Department.DoesNotExist:
        return Response({"detail": "Departamento no encontrado."}, status=404)

    if request.method == "GET":
        return Response(DepartmentSerializer(obj).data)

    serializer = DepartmentSerializer(obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    return Response(DepartmentSerializer(obj).data)


@api_view(["POST"])
@permission_classes([AdminOnly])
def departamento_inactivar(request, pk):
    try:
        obj = Department.objects.get(pk=pk)
    except Department.DoesNotExist:
        return Response({"detail": "Departamento no encontrado."}, status=404)
    obj.activo = False
    obj.save(update_fields=["activo"])
    return Response(DepartmentSerializer(obj).data)


@api_view(["GET", "POST"])
@permission_classes([AdminOnly])
def plazas(request):
    if request.method == "GET":
        qs = User.objects.select_related(
            "profile", "profile__departamento", "profile__jurisdiccion"
        ).exclude(profile__isnull=True)
        return Response(PoliceUserSerializer(qs, many=True).data)

    serializer = PlazaAssignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = User.objects.select_related("profile").get(pk=serializer.validated_data["user_id"])
    if "departamento_id" in serializer.validated_data:
        user.profile.departamento_id = serializer.validated_data["departamento_id"]
    if "jurisdiccion_id" in serializer.validated_data:
        user.profile.jurisdiccion_id = serializer.validated_data["jurisdiccion_id"]
    user.profile.save()
    return Response(PoliceUserSerializer(user).data)


@api_view(["GET"])
@permission_classes([AdminOnly])
def catalogos(request):
    return Response(
        {
            "tipos_jurisdiccion": [
                {"code": c, "label": l} for c, l in JurisdictionType.choices
            ],
        }
    )
