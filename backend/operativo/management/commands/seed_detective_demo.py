from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
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


DEMOS = [
    {
        "titulo": "Robo a domicilio — sector La Floresta",
        "descripcion": "Caso remitido por Fiscalía tras denuncia ciudadana. Ingreso ilegal a vivienda.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.ALTA,
        "lugar": "Calle Lugo y Madrid",
        "unidad": "Policía Judicial, Grupo 1",
        "origen_documento": ExpedienteCaso.OrigenDocumento.DENUNCIA_CIUDADANA,
        "documento_base": (
            "DENUNCIA CIUDADANA REMITIDA POR FISCALÍA\n"
            "Fiscalía Provincial (simulada) remite denuncia por robo a domicilio. "
            "Se solicita apertura de investigación policial judicial."
        ),
        "involucrados": [
            ("VICTIMA", "María", "Fernández", "1715566778"),
            ("SOSPECHOSO", "Carlos", "Mora", "0912233445"),
        ],
        "bitacora": (
            BitacoraInvestigacion.TipoAccion.ENTREVISTA,
            "Se entrevistó a la víctima. Relata ingreso por ventana trasera a las 02:10.",
        ),
        "bien": (
            BienInvestigado.TipoBien.VEHICULO,
            "PCB-3391",
            "Motocicleta vista cerca del domicilio la noche del hecho",
        ),
        "delito_nombre_ Prefer": ("robo", "hurto"),
    },
    {
        "titulo": "Narcotráfico — red logística norte",
        "descripcion": "Investigación de distribución de sustancias en sector industrial.",
        "estado": ExpedienteCaso.Estado.INDAGACION_PREVIA,
        "prioridad": ExpedienteCaso.Prioridad.MEDIA,
        "lugar": "Av. Galo Plaza Lasso",
        "unidad": "Antinarcóticos, Equipo 2",
        "origen_documento": ExpedienteCaso.OrigenDocumento.DENUNCIA_CIUDADANA,
        "documento_base": (
            "DENUNCIA CIUDADANA REMITIDA POR FISCALÍA\n"
            "Fiscalía Provincial (simulada) remite denuncia anónima sobre "
            "posible red de distribución en bodegas del sector norte. "
            "Se solicita apertura de investigación policial judicial."
        ),
        "involucrados": [
            ("SOSPECHOSO", "Marco", "Rivadeneira", "1712345678"),
            ("TESTIGO", "Lucía", "Mena", "0911223344"),
        ],
        "bitacora": (
            BitacoraInvestigacion.TipoAccion.VIGILANCIA,
            "Se realizó vigilancia en el domicilio de Av. Galo Plaza Lasso "
            "a las 20:00. Se observó ingreso de vehículo sin placas.",
        ),
        "bien": (
            BienInvestigado.TipoBien.VEHICULO,
            "PBC-4521",
            "Camioneta blanca vista en vigilancia nocturna",
        ),
        "delito_nombre_Prefer": ("narco", "drog"),
    },
    {
        "titulo": "Homicidio en flagrancia — sector La Carolina",
        "descripcion": "Seguimiento fiscal tras parte operativo inicial.",
        "estado": ExpedienteCaso.Estado.INSTRUCCION_FISCAL,
        "prioridad": ExpedienteCaso.Prioridad.CRITICA,
        "lugar": "Parque La Carolina",
        "unidad": "Policía Judicial, Grupo 2",
        "origen_documento": ExpedienteCaso.OrigenDocumento.PARTE_APREHENSION,
        "documento_base": (
            "PARTE DE APREHENSIÓN APROBADO POR SUPERVISOR\n"
            "Aprehensión en flagrancia en Parque La Carolina. "
            "Víctima con herida por arma blanca. Sospechoso detenido "
            "y puesto a órdenes. Se remite a Policía Judicial."
        ),
        "involucrados": [
            ("VICTIMA", "Andrés", "Cevallos", "1109988776"),
            ("DENUNCIANTE", "Paula", "Andrade", "0987654321"),
            ("SOSPECHOSO", "Jorge", "Salinas", "1711199988"),
        ],
        "bitacora": (
            BitacoraInvestigacion.TipoAccion.ENTREVISTA,
            "Se entrevistó a la testigo Paula Andrade. Relata haber "
            "escuchado una discusión previa al hecho a las 19:40.",
        ),
        "bien": (
            BienInvestigado.TipoBien.INMUEBLE,
            "Calle Los Shyris y República, apto. 4B",
            "Domicilio vinculado al sospechoso según testigo",
        ),
        "delito_nombre_Prefer": ("homicidio", "asesin"),
    },
]


def _pick_delito(prefer_keys, fallback):
    for key in prefer_keys:
        found = TipoDelito.objects.filter(activo=True, nombre__icontains=key).first()
        if found:
            return found
    return fallback


class Command(BaseCommand):
    help = "Crea expedientes y evidencias demo para el rol Detective"

    def handle(self, *args, **options):
        detective = User.objects.filter(
            profile__role=SystemRole.DETECTIVE, is_active=True
        ).first()
        jefe = User.objects.filter(
            profile__role=SystemRole.SUPERVISOR_UNIDAD, is_active=True
        ).first()
        if not detective:
            self.stderr.write("No hay usuario detective. Ejecuta seed_demo_users.")
            return

        delito_fallback = TipoDelito.objects.filter(activo=True).first()
        created = 0
        enriched = 0

        for item in DEMOS:
            delito = _pick_delito(item.get("delito_nombre_Prefer") or (), delito_fallback)
            exp = ExpedienteCaso.objects.filter(
                detective_asignado=detective, titulo=item["titulo"]
            ).first()
            if not exp:
                exp = ExpedienteCaso(
                    titulo=item["titulo"],
                    descripcion=item["descripcion"],
                    estado=item["estado"],
                    prioridad=item["prioridad"],
                    detective_asignado=detective,
                    jefe_asignador=jefe,
                    tipo_delito=delito,
                    fecha_hechos=timezone.localdate(),
                    lugar=item["lugar"],
                    unidad=item["unidad"],
                    origen_documento=item["origen_documento"],
                    documento_base=item["documento_base"],
                )
                exp.ensure_numero()
                exp.ensure_codigo_caso()
                exp.save()
                for tipo, nom, ape, ci in item["involucrados"]:
                    InvolucradoExpediente.objects.create(
                        expediente=exp,
                        tipo=tipo,
                        nombres=nom,
                        apellidos=ape,
                        cedula=ci,
                    )
                fis = EvidenciaCaso(
                    expediente=exp,
                    tipo=EvidenciaCaso.Tipo.FISICA,
                    descripcion="Evidencia física de diligencia inicial",
                    categoria_fisica=EvidenciaCaso.CategoriaFisica.ARMA
                    if "Homicidio" in item["titulo"]
                    else EvidenciaCaso.CategoriaFisica.OTRO,
                    numero_serie=f"SN-{exp.id:04d}-A",
                    peso="0.85 kg",
                    caracteristicas="Registro demo de custodia",
                    custodio_actual=detective.get_full_name() or detective.username,
                    ubicacion_actual="Bodega de evidencias PJ",
                    registrado_por=detective,
                )
                fis.ensure_codigo()
                fis.save()
                MovimientoCustodia.objects.create(
                    evidencia=fis,
                    entregado_por=detective.get_full_name() or detective.username,
                    recibido_por="Lab. Criminalística",
                    destino="Peritaje",
                    motivo="Análisis inicial",
                    registrado_por=detective,
                )
                fis.custodio_actual = "Lab. Criminalística"
                fis.ubicacion_actual = "Peritaje"
                fis.save(
                    update_fields=["custodio_actual", "ubicacion_actual", "actualizado_en"]
                )
                created += 1
            else:
                changed_fields = []
                if not exp.documento_base:
                    exp.documento_base = item["documento_base"]
                    changed_fields.append("documento_base")
                if exp.origen_documento != item["origen_documento"]:
                    exp.origen_documento = item["origen_documento"]
                    changed_fields.append("origen_documento")
                if not exp.unidad or exp.unidad == "Policía Judicial":
                    exp.unidad = item["unidad"]
                    changed_fields.append("unidad")
                if not exp.codigo_caso:
                    exp.ensure_codigo_caso()
                    changed_fields.append("codigo_caso")
                if delito and not exp.tipo_delito_id:
                    exp.tipo_delito = delito
                    changed_fields.append("tipo_delito")
                if changed_fields:
                    exp.save()
                    enriched += 1

            if not exp.bitacora.exists():
                btipo, relato = item["bitacora"]
                BitacoraInvestigacion.objects.create(
                    expediente=exp,
                    tipo=btipo,
                    relato=relato,
                    lugar=item["lugar"],
                    registrado_por=detective,
                )
                enriched += 1
            if not exp.bienes.exists():
                tipo_bien, ident, desc = item["bien"]
                BienInvestigado.objects.create(
                    expediente=exp,
                    tipo=tipo_bien,
                    identificador=ident,
                    descripcion=desc,
                    registrado_por=detective,
                )
                enriched += 1

            already = Notificacion.objects.filter(
                destinatario=detective,
                tipo=Notificacion.Tipo.EXPEDIENTE_ASIGNADO,
                mensaje__icontains=exp.titulo,
            ).exists()
            if not already:
                notify_user(
                    user=detective,
                    tipo=Notificacion.Tipo.EXPEDIENTE_ASIGNADO,
                    titulo=f"Nuevo caso asignado: {exp.codigo_caso or exp.numero_expediente}",
                    mensaje=(
                        f"Tienes un nuevo expediente: «{exp.titulo}». "
                        f"Documento base: {exp.get_origen_documento_display()}. "
                        "Ábrelo en Bandeja de Casos para el análisis inicial."
                    ),
                    enlace="/app/detective/casos",
                )
                enriched += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Expedientes demo creados: {created}; enriquecidos: {enriched}"
            )
        )
