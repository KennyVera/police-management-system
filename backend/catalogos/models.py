from django.db import models


class TipoDelito(models.Model):
    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=160)
    descripcion = models.TextField(blank=True)
    articulo_penal = models.CharField(max_length=120, blank=True)
    codigo_iucr = models.CharField(max_length=20, blank=True)
    clasificacion_fbi = models.CharField(max_length=120, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "Tipo de delito"
        verbose_name_plural = "Tipos de delitos"

    def __str__(self) -> str:
        return self.nombre


class CatalogoOperativoTipo(models.TextChoices):
    MARCA_VEHICULO = "MARCA_VEHICULO", "Marcas de vehículos"
    TIPO_ARMA = "TIPO_ARMA", "Tipos de armas"
    COLOR = "COLOR", "Colores"
    TIPO_DROGA = "TIPO_DROGA", "Tipos de drogas"
    OTRO = "OTRO", "Otro catálogo operativo"


class CatalogoItem(models.Model):
    tipo = models.CharField(max_length=40, choices=CatalogoOperativoTipo.choices)
    codigo = models.CharField(max_length=40)
    nombre = models.CharField(max_length=160)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["tipo", "nombre"]
        unique_together = [("tipo", "codigo")]
        verbose_name = "Ítem de catálogo operativo"
        verbose_name_plural = "Ítems de catálogos operativos"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()}: {self.nombre}"


class VariableGlobal(models.Model):
    clave = models.CharField(max_length=80, unique=True)
    nombre = models.CharField(max_length=160)
    valor = models.CharField(max_length=255)
    unidad = models.CharField(max_length=40, blank=True)
    descripcion = models.TextField(blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["clave"]
        verbose_name = "Variable global"
        verbose_name_plural = "Variables globales"

    def __str__(self) -> str:
        return f"{self.clave}={self.valor}"
