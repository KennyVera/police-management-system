from django.db import models


class JurisdictionType(models.TextChoices):
    ZONA = "ZONA", "Zona"
    SUBZONA = "SUBZONA", "Subzona"
    DISTRITO = "DISTRITO", "Distrito"
    CIRCUITO = "CIRCUITO", "Circuito"
    SUBCIRCUITO = "SUBCIRCUITO", "Subcircuito"


class Jurisdiction(models.Model):
    tipo = models.CharField(max_length=20, choices=JurisdictionType.choices)
    nombre = models.CharField(max_length=160)
    codigo = models.CharField(max_length=40, unique=True)
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="hijos",
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tipo", "nombre"]
        verbose_name = "Jurisdicción"
        verbose_name_plural = "Jurisdicciones"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()}: {self.nombre}"


class Department(models.Model):
    nombre = models.CharField(max_length=160)
    codigo = models.CharField(max_length=40, unique=True)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "Departamento"
        verbose_name_plural = "Departamentos"

    def __str__(self) -> str:
        return self.nombre
