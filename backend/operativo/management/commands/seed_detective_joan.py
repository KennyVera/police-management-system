"""Nutre a DetectiveJoan con expedientes coherentes para un dashboard épico."""

from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import SystemRole
from catalogos.models import TipoDelito
from operativo.models import (
    BienInvestigado,
    BitacoraInvestigacion,
    EvidenciaCaso,
    ExpedienteCaso,
    InvolucradoExpediente,
    MovimientoCustodia,
    Notificacion,
)
from operativo.notifications import notify_user

TAG = "JOAN-SEED"


def _aware(days_ago: int, hour: int = 10):
    base = timezone.localtime() - timedelta(days=days_ago)
    naive = datetime(base.year, base.month, base.day, hour, 15, 0)
    if timezone.is_naive(naive):
        return timezone.make_aware(naive)
    return naive


def _pick_delito(*keys: str):
    for key in keys:
        found = TipoDelito.objects.filter(activo=True, nombre__icontains=key).first()
        if found:
            return found
    return TipoDelito.objects.filter(activo=True).first()


CASES = [
    # —— Activos recientes (indagación) ——
    {
        "key": "extorsion-urdesa",
        "titulo": "Extorsión digital — comerciantes Urdesa",
        "descripcion": "Cadena de amenazas por WhatsApp a dueños de locales en Urdesa Central.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Urdesa Central, Guayaquil",
        "unidad": "Policía Judicial · Unidad de Extorsión",
        "delitos": ("extorsi", "cyber", "digital"),
        "creado_hace": 12,
        "actividad_hace": 1,
        "involucrados": [
            ("VICTIMA", "Patricia", "Mendoza", "0915566778"),
            ("VICTIMA", "Luis", "Cabrera", "0923344556"),
            ("SOSPECHOSO", "NN", "Alias 'El Contador'", ""),
        ],
        "bitacoras": [
            (0, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Entrevista a víctima Patricia Mendoza. Entrega capturas de amenazas."),
            (1, BitacoraInvestigacion.TipoAccion.ANALISIS, "Análisis de números IMEI vinculados a las llamadas."),
        ],
        "evidencias": [
            ("DIGITAL", "Capturas WhatsApp y audio de amenaza", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.CELULAR, "Teléfono decomisado en diligencia"),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "GYE-8821", "Motocicleta usada en seguimiento a víctima"),
    },
    {
        "key": "robo-malecón",
        "titulo": "Robo agravado — Malecón 2000",
        "descripcion": "Asalto a turistas con arma de fuego; se recuperó parte del botín.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.CRITICA,
        "lugar": "Malecón 2000, Guayaquil",
        "unidad": "Policía Judicial · Grupo Anti-Delincuencia",
        "delitos": ("robo",),
        "creado_hace": 8,
        "actividad_hace": 0,
        "involucrados": [
            ("VICTIMA", "John", "Peterson", "P-998877"),
            ("SOSPECHOSO", "Kevin", "Alcívar", "0932211445"),
            ("TESTIGO", "Rosa", "Paredes", "0911122334"),
        ],
        "bitacoras": [
            (0, BitacoraInvestigacion.TipoAccion.DILIGENCIA, "Inspección ocular y levantamiento de cámaras del Malecón."),
            (2, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Testigo Rosa Paredes identifica motocicleta de escape."),
        ],
        "evidencias": [
            ("DIGITAL", "Video CCTV cámara 12 — 19:42", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.ARMA, "Arma corta cal. 9mm sin serie legible"),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "GSE-4410", "Moto de escape vista en video"),
    },
    {
        "key": "hurto-centenario",
        "titulo": "Hurto reiterado — Mercado Centenario",
        "descripcion": "Banda de carteristas opera en horas pico del mercado.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Mercado del Centenario, Guayaquil",
        "unidad": "Policía Judicial · Delitos contra la propiedad",
        "delitos": ("hurto",),
        "creado_hace": 6,
        "actividad_hace": 2,
        "involucrados": [
            ("VICTIMA", "Elena", "Quiroz", "0945566778"),
            ("SOSPECHOSO", "Diego", "Vera", "0956677889"),
        ],
        "bitacoras": [
            (2, BitacoraInvestigacion.TipoAccion.VIGILANCIA, "Vigilancia encubierta en pasillos 3 y 4 del mercado."),
        ],
        "evidencias": [
            ("DIGITAL", "Fotografías de modus operandi", None),
        ],
        "bien": None,
    },
    {
        "key": "drogas-trinitaria",
        "titulo": "Tráfico de drogas — microtráfico Isla Trinitaria",
        "descripcion": "Punto de venta identificado tras denuncia anónima y vigilancia.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Isla Trinitaria, Guayaquil",
        "unidad": "Antinarcóticos · Equipo Delta",
        "delitos": ("droga", "narco", "tráfico"),
        "creado_hace": 15,
        "actividad_hace": 3,
        "involucrados": [
            ("SOSPECHOSO", "Franklin", "Zambrano", "0967788990"),
            ("SOSPECHOSO", "Andrea", "Chávez", "0978899001"),
            ("TESTIGO", "NN", "Colaborador reservado", ""),
        ],
        "bitacoras": [
            (3, BitacoraInvestigacion.TipoAccion.VIGILANCIA, "Observación de entregas en esquina 12 y Calle 5."),
            (5, BitacoraInvestigacion.TipoAccion.ANALISIS, "Cruce de placas con denuncias previas."),
        ],
        "evidencias": [
            ("FISICA", EvidenciaCaso.CategoriaFisica.DROGA, "Fundas con sustancia sospechosa — muestra A"),
            ("FISICA", EvidenciaCaso.CategoriaFisica.CELULAR, "Smartphone con chat de distribución"),
        ],
        "bien": (BienInvestigado.TipoBien.INMUEBLE, "Calle 5 y 12, casa esquinera", "Punto de acopio provisional"),
    },
    {
        "key": "accidente-via-perimetral",
        "titulo": "Accidente de tránsito con fuga — Vía Perimetral",
        "descripcion": "Choque con lesionados; conductor fuga. Se investiga identidad del vehículo.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Vía Perimetral km 12, Guayaquil",
        "unidad": "Policía Judicial · Accidentes",
        "delitos": ("accidente", "tránsito", "transito"),
        "creado_hace": 4,
        "actividad_hace": 1,
        "involucrados": [
            ("VICTIMA", "Marcos", "Ibáñez", "0989900112"),
            ("SOSPECHOSO", "NN", "Conductor prófugo", ""),
        ],
        "bitacoras": [
            (1, BitacoraInvestigacion.TipoAccion.DILIGENCIA, "Levantamiento pericial y recolección de restos de pintura."),
        ],
        "evidencias": [
            ("FISICA", EvidenciaCaso.CategoriaFisica.OTRO, "Fragmentos de faro y placa parcial"),
            ("DIGITAL", "Video peaje Perimetral — 22:18", None),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "Placa parcial GYE-7*", "Sedán oscuro visto en peaje"),
    },
    # —— Instrucción fiscal ——
    {
        "key": "homicidio-estero",
        "titulo": "Homicidio — sector Estero Salado",
        "descripcion": "Homicidio por arma de fuego; causa formal abierta en Fiscalía.",
        "estado": ExpedienteCaso.Estado.INSTRUCCION_FISCAL,
        "prioridad": ExpedienteCaso.Prioridad.CRITICA,
        "lugar": "Estero Salado, Guayaquil",
        "unidad": "Policía Judicial · Homicidios",
        "delitos": ("homicidio", "asesin"),
        "creado_hace": 40,
        "actividad_hace": 2,
        "involucrados": [
            ("VICTIMA", "José", "Pincay", "0901122334"),
            ("SOSPECHOSO", "Bryan", "Torres", "0912233445"),
            ("DENUNCIANTE", "Ana", "Pincay", "0923344556"),
        ],
        "bitacoras": [
            (2, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Declaración de Ana Pincay ante fiscal."),
            (10, BitacoraInvestigacion.TipoAccion.ANALISIS, "Informe balístico preliminar recibido."),
        ],
        "evidencias": [
            ("FISICA", EvidenciaCaso.CategoriaFisica.ARMA, "Casquillos 9mm — escena"),
            ("DIGITAL", "Peritaje fotográfico escena del crimen", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.DOCUMENTO, "Autopsia médico-legal (copia)"),
        ],
        "bien": (BienInvestigado.TipoBien.INMUEBLE, "Callejón sin nombre, solar 14", "Lugar de los hechos"),
    },
    {
        "key": "organizacion-sur",
        "titulo": "Crimen organizado — red sur Guayaquil",
        "descripcion": "Estructura dedicada a cobros y logística; instrucción fiscal en curso.",
        "estado": ExpedienteCaso.Estado.INSTRUCCION_FISCAL,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Guasmo Sur, Guayaquil",
        "unidad": "Policía Judicial · Crimen Organizado",
        "delitos": ("organiza", "extorsi"),
        "creado_hace": 55,
        "actividad_hace": 4,
        "involucrados": [
            ("SOSPECHOSO", "Raúl", "Moreira", "0934455667"),
            ("SOSPECHOSO", "Cinthya", "Loor", "0945566778"),
            ("TESTIGO", "NN", "Protegido Fiscalía", ""),
        ],
        "bitacoras": [
            (4, BitacoraInvestigacion.TipoAccion.ANALISIS, "Mapeo de jerarquía y rutas de cobro."),
            (12, BitacoraInvestigacion.TipoAccion.DILIGENCIA, "Allanamiento autorizado — bodega sur."),
        ],
        "evidencias": [
            ("DIGITAL", "Extractos de interceptación autorizada", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.DOCUMENTO, "Libretas de cobros decomisadas"),
            ("FISICA", EvidenciaCaso.CategoriaFisica.CELULAR, "Terminales con chips prepago"),
        ],
        "bien": (BienInvestigado.TipoBien.INMUEBLE, "Bodega Av. 25 de Julio", "Centro logístico temporal"),
    },
    {
        "key": "secuestro-exprés",
        "titulo": "Secuestro exprés — vía a Samborondón",
        "descripcion": "Privación corta de libertad con cobro; víctima liberada. Instrucción abierta.",
        "estado": ExpedienteCaso.Estado.INSTRUCCION_FISCAL,
        "prioridad": ExpedienteCaso.Prioridad.CRITICA,
        "lugar": "Vía a Samborondón, Guayas",
        "unidad": "Policía Judicial · Secuestros",
        "delitos": ("secuestro", "extorsi"),
        "creado_hace": 28,
        "actividad_hace": 5,
        "involucrados": [
            ("VICTIMA", "Ricardo", "Navarrete", "0956677889"),
            ("SOSPECHOSO", "Jonathan", "Bailón", "0967788990"),
        ],
        "bitacoras": [
            (5, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Reconstrucción del trayecto con la víctima."),
        ],
        "evidencias": [
            ("DIGITAL", "Geolocalización celular víctima", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.VEHICULO, "Restos de cinta adhesiva en vehículo"),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "PCB-2209", "Camioneta usada en el traslado"),
    },
    # —— Suspendidos ——
    {
        "key": "fraude-suspendido",
        "titulo": "Fraude informático — cuentas bancarias (suspendido)",
        "descripcion": "Suspendido por disposición fiscal a la espera de peritaje informático externo.",
        "estado": ExpedienteCaso.Estado.SUSPENDIDO,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Guayaquil (ámbito digital)",
        "unidad": "Policía Judicial · Delitos Informáticos",
        "delitos": ("fraude", "cyber", "digital"),
        "creado_hace": 60,
        "actividad_hace": 20,
        "involucrados": [
            ("VICTIMA", "Banco Demo", "Sucursal 4", ""),
            ("SOSPECHOSO", "NN", "Operador remoto", ""),
        ],
        "bitacoras": [
            (20, BitacoraInvestigacion.TipoAccion.ANALISIS, "Expediente suspendido hasta informe forense."),
        ],
        "evidencias": [
            ("DIGITAL", "Logs de acceso sospechoso", None),
        ],
        "bien": None,
    },
    # —— Estancados (sin actividad > 15 días) ——
    {
        "key": "estancado-samborondon",
        "titulo": "Amenazas — urbanización La Puntilla",
        "descripcion": "Caso sin diligencias recientes; requiere reactivación inmediata.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "La Puntilla, Samborondón",
        "unidad": "Policía Judicial · Grupo 3",
        "delitos": ("amenaz", "extorsi"),
        "creado_hace": 45,
        "actividad_hace": 22,
        "involucrados": [
            ("VICTIMA", "Carolina", "Espinoza", "0978899001"),
            ("SOSPECHOSO", "NN", "Llamadas anónimas", ""),
        ],
        "bitacoras": [
            (22, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Última entrevista a víctima — sin avances posteriores."),
        ],
        "evidencias": [
            ("DIGITAL", "Grabación de llamada amenazante", None),
        ],
        "bien": None,
    },
    {
        "key": "estancado-duran",
        "titulo": "Robo de vehículo — Durán centro",
        "descripcion": "Expediente detenido: falta cruzar bases de chatarrerías.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Durán, Guayas",
        "unidad": "Policía Judicial · Vehículos",
        "delitos": ("robo",),
        "creado_hace": 50,
        "actividad_hace": 25,
        "involucrados": [
            ("VICTIMA", "Héctor", "Salazar", "0989900112"),
            ("SOSPECHOSO", "NN", "Desconocido", ""),
        ],
        "bitacoras": [
            (25, BitacoraInvestigacion.TipoAccion.DILIGENCIA, "Última visita a chatarrería sector industrial."),
        ],
        "evidencias": [
            ("DIGITAL", "Foto placa y motor", None),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "GSE-9912", "Camioneta robada"),
    },
    # —— Cerrados este mes ——
    {
        "key": "cerrado-mes-1",
        "titulo": "Hurto flagrante — Centro Comercial Mall del Sol",
        "descripcion": "Caso cerrado: sospechoso identificado y a órdenes de Fiscalía.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Mall del Sol, Guayaquil",
        "unidad": "Policía Judicial · Delitos menores",
        "delitos": ("hurto",),
        "creado_hace": 10,
        "cerrado_hace": 0,
        "actividad_hace": 0,
        "involucrados": [
            ("VICTIMA", "Store Demo", "Local 214", ""),
            ("SOSPECHOSO", "Pedro", "Quiñónez", "0901234567"),
        ],
        "bitacoras": [
            (0, BitacoraInvestigacion.TipoAccion.ANALISIS, "Informe final remitido a Fiscalía."),
            (4, BitacoraInvestigacion.TipoAccion.ENTREVISTA, "Confrontación con video de seguridad."),
        ],
        "evidencias": [
            ("DIGITAL", "Video cámara local 214", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.OTRO, "Mercadería recuperada"),
        ],
        "bien": None,
    },
    {
        "key": "cerrado-mes-2",
        "titulo": "Extorsión telefónica — profesional independiente",
        "descripcion": "Cerrado tras identificación del número y mediación fiscal.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Kennedy Norte, Guayaquil",
        "unidad": "Policía Judicial · Extorsión",
        "delitos": ("extorsi",),
        "creado_hace": 12,
        "cerrado_hace": 1,
        "actividad_hace": 1,
        "involucrados": [
            ("VICTIMA", "Sofía", "Ramos", "0912345678"),
            ("SOSPECHOSO", "Miguel", "Cedeño", "0923456789"),
        ],
        "bitacoras": [
            (1, BitacoraInvestigacion.TipoAccion.ANALISIS, "Cierre: informe y remisión completa."),
        ],
        "evidencias": [
            ("DIGITAL", "Registros de llamadas", None),
        ],
        "bien": None,
    },
    {
        "key": "cerrado-mes-3",
        "titulo": "Robo a domicilio — Bastión Popular",
        "descripcion": "Cerrado con aprehensión de dos sospechosos.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Bastión Popular, Guayaquil",
        "unidad": "Policía Judicial · Grupo 1",
        "delitos": ("robo",),
        "creado_hace": 14,
        "cerrado_hace": 0,
        "actividad_hace": 0,
        "involucrados": [
            ("VICTIMA", "Gloria", "Mera", "0934567890"),
            ("SOSPECHOSO", "Álex", "Holguín", "0945678901"),
            ("SOSPECHOSO", "Danny", "Paz", "0956789012"),
        ],
        "bitacoras": [
            (0, BitacoraInvestigacion.TipoAccion.DILIGENCIA, "Allanamiento y recuperación de electrodomésticos."),
        ],
        "evidencias": [
            ("FISICA", EvidenciaCaso.CategoriaFisica.OTRO, "TV y laptop recuperados"),
            ("DIGITAL", "Inventario fotográfico", None),
        ],
        "bien": (BienInvestigado.TipoBien.INMUEBLE, "Manzana 12 solar 5", "Domicilio de la víctima"),
    },
    {
        "key": "cerrado-mes-4",
        "titulo": "Tráfico de drogas — operativo conjunto Durán",
        "descripcion": "Cerrado: decomiso y remisión a Fiscalía Antidrogas.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.CRITICA,
        "lugar": "Durán, Guayas",
        "unidad": "Antinarcóticos · Equipo Bravo",
        "delitos": ("droga", "narco"),
        "creado_hace": 9,
        "cerrado_hace": 1,
        "actividad_hace": 1,
        "involucrados": [
            ("SOSPECHOSO", "Esteban", "García", "0967890123"),
        ],
        "bitacoras": [
            (1, BitacoraInvestigacion.TipoAccion.ANALISIS, "Cadena de custodia completa — cierre."),
        ],
        "evidencias": [
            ("FISICA", EvidenciaCaso.CategoriaFisica.DROGA, "Paquete 1.2 kg sustancia controlada"),
            ("FISICA", EvidenciaCaso.CategoriaFisica.CELULAR, "Teléfonos de la red"),
        ],
        "bien": (BienInvestigado.TipoBien.VEHICULO, "GSE-3301", "Furgoneta de transporte"),
    },
    # —— Cerrados mes anterior (para Δ efectividad) ——
    {
        "key": "cerrado-prev-1",
        "titulo": "Hurto — terminal terrestre (mes anterior)",
        "descripcion": "Caso cerrado el mes pasado.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.BAJA,
        "lugar": "Terminal Terrestre, Guayaquil",
        "unidad": "Policía Judicial · Delitos menores",
        "delitos": ("hurto",),
        "creado_hace": 55,
        "cerrado_hace": 35,
        "actividad_hace": 35,
        "involucrados": [
            ("VICTIMA", "Turista", "NN", ""),
            ("SOSPECHOSO", "José", "Lino", "0978901234"),
        ],
        "bitacoras": [
            (35, BitacoraInvestigacion.TipoAccion.ANALISIS, "Cierre mes anterior."),
        ],
        "evidencias": [
            ("DIGITAL", "Video terminal cámara 3", None),
        ],
        "bien": None,
    },
    {
        "key": "cerrado-prev-2",
        "titulo": "Estafa — venta falsa de vehículos (mes anterior)",
        "descripcion": "Cerrado el mes pasado tras mediación y remisión.",
        "estado": ExpedienteCaso.Estado.CERRADO,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Guayaquil (online + presencial)",
        "unidad": "Policía Judicial · Estafas",
        "delitos": ("estafa", "fraude"),
        "creado_hace": 60,
        "cerrado_hace": 40,
        "actividad_hace": 40,
        "involucrados": [
            ("VICTIMA", "Andrés", "Villacís", "0989012345"),
            ("SOSPECHOSO", "Pablo", "Reyes", "0990123456"),
        ],
        "bitacoras": [
            (40, BitacoraInvestigacion.TipoAccion.ANALISIS, "Informe de cierre mes anterior."),
        ],
        "evidencias": [
            ("DIGITAL", "Conversaciones Marketplace", None),
            ("FISICA", EvidenciaCaso.CategoriaFisica.DOCUMENTO, "Comprobantes de transferencia"),
        ],
        "bien": None,
    },
]


class Command(BaseCommand):
    help = "Nutre DetectiveJoan@gmail.com con casos coherentes para un dashboard épico"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default="DetectiveJoan@gmail.com",
            help="Email del detective a nutrir",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Elimina expedientes previos taggeados JOAN-SEED de ese detective",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"]
        detective = User.objects.filter(
            email__iexact=email, profile__role=SystemRole.DETECTIVE
        ).first()
        if not detective:
            detective = User.objects.filter(
                username__iexact=email, profile__role=SystemRole.DETECTIVE
            ).first()
        if not detective:
            self.stderr.write(self.style.ERROR(f"No existe detective {email}"))
            return

        jefe = (
            User.objects.filter(profile__role=SystemRole.DIRECTOR_ZONA, is_active=True).first()
            or User.objects.filter(
                profile__role=SystemRole.SUPERVISOR_UNIDAD, is_active=True
            ).first()
        )

        if options["reset"]:
            qs = ExpedienteCaso.objects.filter(
                detective_asignado=detective, observaciones__contains=TAG
            )
            n = qs.count()
            qs.delete()
            self.stdout.write(f"Eliminados {n} expedientes previos {TAG}.")

        created = 0
        for item in CASES:
            titulo = item["titulo"]
            exp = ExpedienteCaso.objects.filter(
                detective_asignado=detective, titulo=titulo
            ).first()
            if exp:
                continue

            delito = _pick_delito(*item["delitos"])
            creado = _aware(item["creado_hace"], 9)
            actividad = _aware(item["actividad_hace"], 16)
            cerrado = None
            if item["estado"] == ExpedienteCaso.Estado.CERRADO:
                cerrado = _aware(item.get("cerrado_hace", item["actividad_hace"]), 17)

            exp = ExpedienteCaso(
                titulo=titulo,
                descripcion=item["descripcion"],
                estado=item["estado"],
                prioridad=item["prioridad"],
                detective_asignado=detective,
                jefe_asignador=jefe,
                tipo_delito=delito,
                fecha_hechos=(timezone.localdate() - timedelta(days=item["creado_hace"] + 2)),
                lugar=item["lugar"],
                unidad=item["unidad"],
                origen_documento=ExpedienteCaso.OrigenDocumento.DENUNCIA_CIUDADANA,
                documento_base=(
                    f"DENUNCIA / PARTE BASE · {titulo}\n"
                    f"Fiscalía / Unidad remite caso a Policía Judicial. "
                    f"Investigador asignado: {detective.get_full_name() or detective.username}."
                ),
                observaciones=f"{TAG}:{item['key']}",
                cerrado_en=cerrado,
                bloqueado=item["estado"] == ExpedienteCaso.Estado.CERRADO,
            )
            exp.ensure_numero()
            exp.ensure_codigo_caso()
            exp.save()

            ExpedienteCaso.objects.filter(pk=exp.pk).update(
                creado_en=creado,
                actualizado_en=actividad,
                cerrado_en=cerrado,
            )

            for tipo, nom, ape, ci in item["involucrados"]:
                InvolucradoExpediente.objects.create(
                    expediente=exp,
                    tipo=tipo,
                    nombres=nom,
                    apellidos=ape,
                    cedula=ci,
                    nacionalidad="Ecuatoriana",
                )

            for days_ago, btipo, relato in item["bitacoras"]:
                BitacoraInvestigacion.objects.create(
                    expediente=exp,
                    tipo=btipo,
                    relato=relato,
                    lugar=item["lugar"],
                    fecha_hora=_aware(days_ago, 11),
                    registrado_por=detective,
                )

            for ev in item["evidencias"]:
                if ev[0] == "DIGITAL":
                    obj = EvidenciaCaso(
                        expediente=exp,
                        tipo=EvidenciaCaso.Tipo.DIGITAL,
                        descripcion=ev[1],
                        nombre_archivo=f"{item['key']}.pdf",
                        content_type="application/pdf",
                        tamanio_bytes=240_000,
                        custodio_actual=detective.get_full_name() or detective.username,
                        ubicacion_actual="Repositorio digital PJ",
                        registrado_por=detective,
                        estado_custodia=EvidenciaCaso.EstadoCustodia.EN_CUSTODIA,
                    )
                else:
                    obj = EvidenciaCaso(
                        expediente=exp,
                        tipo=EvidenciaCaso.Tipo.FISICA,
                        descripcion=ev[2],
                        categoria_fisica=ev[1],
                        numero_serie=f"SN-{item['key'][:8].upper()}",
                        peso="—",
                        caracteristicas="Registro demo coherente Joan",
                        custodio_actual=detective.get_full_name() or detective.username,
                        ubicacion_actual="Bodega evidencias PJ Guayaquil",
                        registrado_por=detective,
                        estado_custodia=EvidenciaCaso.EstadoCustodia.EN_CUSTODIA,
                    )
                obj.ensure_codigo()
                obj.save()
                EvidenciaCaso.objects.filter(pk=obj.pk).update(
                    creado_en=_aware(item["actividad_hace"], 14),
                    actualizado_en=_aware(item["actividad_hace"], 14),
                )
                if obj.tipo == EvidenciaCaso.Tipo.FISICA:
                    MovimientoCustodia.objects.create(
                        evidencia=obj,
                        entregado_por=detective.get_full_name() or detective.username,
                        recibido_por="Lab. Criminalística Guayaquil",
                        destino="Peritaje",
                        motivo="Cadena de custodia inicial",
                        registrado_por=detective,
                    )

            if item.get("bien"):
                tipo_bien, ident, desc = item["bien"]
                BienInvestigado.objects.create(
                    expediente=exp,
                    tipo=tipo_bien,
                    identificador=ident,
                    descripcion=desc,
                    registrado_por=detective,
                )

            created += 1

        notify_user(
            user=detective,
            tipo=Notificacion.Tipo.EXPEDIENTE_ASIGNADO,
            titulo="Portafolio investigativo actualizado",
            mensaje=(
                f"Se cargaron {created} expedientes de demostración en tu bandeja. "
                "Revisa el dashboard: activos, efectividad, estancados y tipología."
            ),
            enlace="/app/detective",
        )

        # Resumen
        total = ExpedienteCaso.objects.filter(detective_asignado=detective).count()
        activos = (
            ExpedienteCaso.objects.filter(detective_asignado=detective)
            .exclude(estado=ExpedienteCaso.Estado.CERRADO)
            .count()
        )
        evid = EvidenciaCaso.objects.filter(
            expediente__detective_asignado=detective
        ).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Detective {detective.email}: +{created} nuevos · "
                f"total casos={total} · activos={activos} · evidencias={evid}"
            )
        )
