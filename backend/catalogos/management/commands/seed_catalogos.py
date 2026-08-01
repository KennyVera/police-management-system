from django.core.management.base import BaseCommand

from catalogos.models import CatalogoItem, CatalogoOperativoTipo, TipoDelito, VariableGlobal

DEFAULT_DELITOS = [
    ("ROBO", "Robo", "Art. relativo al robo", "120", "Robo / Property crime"),
    ("HURTO", "Hurto", "", "0820", "Larceny / Property crime"),
    ("EXTORSION", "Extorsión", "", "1210", "Robbery / Extortion"),
    ("EXTORSION_DIGITAL", "Extorsión digital", "Actualización código penal", "1211", "Cybercrime / Extortion"),
    ("HOMICIDIO", "Homicidio", "", "0110", "Homicide"),
    ("TRAFICO_DROGAS", "Tráfico de drogas", "", "1811", "Narcotics"),
]

DEFAULT_CATALOGOS = [
    (CatalogoOperativoTipo.MARCA_VEHICULO, "TOYOTA", "Toyota"),
    (CatalogoOperativoTipo.MARCA_VEHICULO, "CHEVROLET", "Chevrolet"),
    (CatalogoOperativoTipo.MARCA_VEHICULO, "KIA", "Kia"),
    (CatalogoOperativoTipo.TIPO_ARMA, "PISTOLA", "Pistola"),
    (CatalogoOperativoTipo.TIPO_ARMA, "REVOLVER", "Revólver"),
    (CatalogoOperativoTipo.TIPO_ARMA, "ESCOPETA", "Escopeta"),
    (CatalogoOperativoTipo.COLOR, "BLANCO", "Blanco"),
    (CatalogoOperativoTipo.COLOR, "NEGRO", "Negro"),
    (CatalogoOperativoTipo.COLOR, "ROJO", "Rojo"),
    (CatalogoOperativoTipo.TIPO_DROGA, "COCAINA", "Cocaína"),
    (CatalogoOperativoTipo.TIPO_DROGA, "MARIHUANA", "Marihuana"),
]

DEFAULT_VARS = [
    (
        "SESSION_IDLE_TIMEOUT_MIN",
        "Tiempo máximo de inactividad",
        "30",
        "minutos",
        "Minutos de inactividad antes de cerrar la sesión automáticamente.",
    ),
    (
        "MINIO_MAX_UPLOAD_MB",
        "Peso máximo de archivos (MinIO)",
        "25",
        "MB",
        "Tamaño máximo permitido para subir evidencias/archivos a MinIO.",
    ),
]


class Command(BaseCommand):
    help = "Siembra catálogos y variables globales por defecto"

    def handle(self, *args, **options):
        for codigo, nombre, articulo, iucr, fbi in DEFAULT_DELITOS:
            obj, created = TipoDelito.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "nombre": nombre,
                    "articulo_penal": articulo,
                    "codigo_iucr": iucr,
                    "clasificacion_fbi": fbi,
                },
            )
            if not created and (not obj.codigo_iucr or not obj.clasificacion_fbi):
                obj.codigo_iucr = obj.codigo_iucr or iucr
                obj.clasificacion_fbi = obj.clasificacion_fbi or fbi
                obj.save(update_fields=["codigo_iucr", "clasificacion_fbi", "actualizado_en"])
        for tipo, codigo, nombre in DEFAULT_CATALOGOS:
            CatalogoItem.objects.get_or_create(
                tipo=tipo,
                codigo=codigo,
                defaults={"nombre": nombre},
            )
        for clave, nombre, valor, unidad, desc in DEFAULT_VARS:
            VariableGlobal.objects.get_or_create(
                clave=clave,
                defaults={
                    "nombre": nombre,
                    "valor": valor,
                    "unidad": unidad,
                    "descripcion": desc,
                },
            )
        self.stdout.write(self.style.SUCCESS("Catálogos y variables globales listos."))
