import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./auth/LoginPage";
import { useAuth } from "./auth/AuthContext";
import CommercialSuite from "./saas/CommercialSuite";

import AdministradorLayout from "./roles/administrador/Layout";
import AdminDashboard from "./roles/administrador/modulos/dashboard/Page";
import AdminIdentidadUsuarios from "./roles/administrador/modulos/identidad_accesos/UsuariosPage";
import AdminIdentidadCredenciales from "./roles/administrador/modulos/identidad_accesos/CredencialesPage";
import AdminIdentidadSesiones from "./roles/administrador/modulos/identidad_accesos/SesionesPage";
import AdminEstructuraJurisdicciones from "./roles/administrador/modulos/estructura_organizacional/JurisdiccionesPage";
import AdminEstructuraPlazas from "./roles/administrador/modulos/estructura_organizacional/PlazasPage";
import AdminCatalogosDelitos from "./roles/administrador/modulos/parametros_catalogos/TiposDelitosPage";
import AdminCatalogosOperativos from "./roles/administrador/modulos/parametros_catalogos/CatalogosOperativosPage";
import AdminCatalogosVariables from "./roles/administrador/modulos/parametros_catalogos/VariablesGlobalesPage";
import AdminSuscripcionUso from "./roles/administrador/modulos/suscripcion_uso/Page";

import SuperAdminLayout from "./roles/superadmin/Layout";
import SuperAdminDashboard from "./roles/superadmin/modulos/dashboard/Page";
import SuperAdminPlanes from "./roles/superadmin/modulos/planes_suscripciones/PlanesPage";
import SuperAdminSuscripciones from "./roles/superadmin/modulos/planes_suscripciones/SuscripcionesPage";
import SuperAdminAdmins from "./roles/superadmin/modulos/usuarios_plataforma/AdministradoresPage";
import SuperAdminGestionAcceso from "./roles/superadmin/modulos/usuarios_plataforma/GestionAccesoPage";
import FactSuscripciones from "./roles/superadmin/modulos/facturacion/SuscripcionesPage";
import FactPagos from "./roles/superadmin/modulos/facturacion/PagosPage";
import FactFacturas from "./roles/superadmin/modulos/facturacion/FacturasPage";
import FactVencimientos from "./roles/superadmin/modulos/facturacion/VencimientosPage";
import FactReportes from "./roles/superadmin/modulos/facturacion/ReportesPage";
import FactAuditoria from "./roles/superadmin/modulos/facturacion/AuditoriaPage";
import CfgIdentidad from "./roles/superadmin/modulos/configuracion_global/IdentidadPage";
import CfgApariencia from "./roles/superadmin/modulos/configuracion_global/AparienciaPage";
import CfgRegional from "./roles/superadmin/modulos/configuracion_global/RegionalPage";
import CfgComunicaciones from "./roles/superadmin/modulos/configuracion_global/ComunicacionesPage";
import CfgPlataforma from "./roles/superadmin/modulos/configuracion_global/PlataformaPage";
import CfgAuditoria from "./roles/superadmin/modulos/configuracion_global/AuditoriaConfigPage";

import VisorLayout from "./roles/visor_ejecutivo/Layout";
import VisorDashboard from "./roles/visor_ejecutivo/modulos/dashboard/Page";
import VisorIndicadores from "./roles/visor_ejecutivo/modulos/indicadores/Page";
import VisorReportes from "./roles/visor_ejecutivo/modulos/reportes_estrategicos/Page";

import DirectorLayout from "./roles/director_zona/Layout";
import DirectorInteligencia from "./roles/director_zona/modulos/inteligencia/Page";
import DirectorSupervision from "./roles/director_zona/modulos/supervision/Page";
import DirectorPersonal from "./roles/director_zona/modulos/personal/Page";
import DirectorReportes from "./roles/director_zona/modulos/reportes/Page";
import DirectorComunicacion from "./roles/director_zona/modulos/comunicacion/Page";

import SupervisorLayout from "./roles/supervisor_unidad/Layout";
import SupervisorDashboard from "./roles/supervisor_unidad/modulos/dashboard/Page";
import SupervisorEscuadras from "./roles/supervisor_unidad/modulos/logistica_turnos/EscuadrasPage";
import SupervisorVehiculos from "./roles/supervisor_unidad/modulos/logistica_turnos/VehiculosPage";
import SupervisorSectores from "./roles/supervisor_unidad/modulos/logistica_turnos/SectoresPage";
import SupervisorHorarios from "./roles/supervisor_unidad/modulos/logistica_turnos/HorariosPage";
import SupervisorAuxilios from "./roles/supervisor_unidad/modulos/despacho_operativo/AuxiliosPage";
import SupervisorOrdenes from "./roles/supervisor_unidad/modulos/despacho_operativo/OrdenesPage";
import SupervisorRastreoGps from "./roles/supervisor_unidad/modulos/monitoreo_tactico/RastreoGpsPage";
import SupervisorEstadisticas from "./roles/supervisor_unidad/modulos/monitoreo_tactico/EstadisticasPage";
import SupervisorPendientes from "./roles/supervisor_unidad/modulos/control_calidad/PendientesPage";
import SupervisorHistorial from "./roles/supervisor_unidad/modulos/control_calidad/HistorialPage";

import DetectiveLayout from "./roles/detective/Layout";
import DetectiveDashboard from "./roles/detective/modulos/dashboard/Page";
import DetectiveCasos from "./roles/detective/modulos/casos/Page";
import DetectiveActividades from "./roles/detective/modulos/actividades/Page";

import FiscalLayout from "./roles/fiscal/Layout";
import FiscalDashboard from "./roles/fiscal/modulos/dashboard/Page";
import FiscalBandeja from "./roles/fiscal/modulos/bandeja/BandejaPage";

import AgenteLayout from "./roles/agente_operativo/Layout";
import AgenteDashboard from "./roles/agente_operativo/modulos/dashboard/Page";
import AgentePartes from "./roles/agente_operativo/modulos/registro_operativo/PartesAprehensionPage";
import AgenteNovedades from "./roles/agente_operativo/modulos/registro_operativo/NovedadesPage";
import AgenteMultimedia from "./roles/agente_operativo/modulos/registro_operativo/MultimediaPage";
import AgenteAlertas from "./roles/agente_operativo/modulos/despacho_tareas/AlertasPage";
import AgenteMiTurno from "./roles/agente_operativo/modulos/despacho_tareas/MiTurnoPage";

function Protected({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return <div className="boot-screen">Cargando sesión...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CommercialSuite initialView="landing" />} />
      <Route path="/onboarding" element={<CommercialSuite initialView="onboarding" />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/app/superadmin"
        element={
          <Protected>
            <SuperAdminLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboard />} />
        <Route
          path="planes_suscripciones"
          element={<Navigate to="planes" replace />}
        />
        <Route path="planes_suscripciones/planes" element={<SuperAdminPlanes />} />
        <Route
          path="planes_suscripciones/suscripciones"
          element={<SuperAdminSuscripciones />}
        />
        <Route
          path="usuarios_plataforma"
          element={<Navigate to="administradores" replace />}
        />
        <Route
          path="usuarios_plataforma/administradores"
          element={<SuperAdminAdmins />}
        />
        <Route
          path="usuarios_plataforma/gestion_acceso"
          element={<SuperAdminGestionAcceso />}
        />
        <Route path="facturacion" element={<Navigate to="suscripciones" replace />} />
        <Route path="facturacion/suscripciones" element={<FactSuscripciones />} />
        <Route path="facturacion/pagos" element={<FactPagos />} />
        <Route path="facturacion/facturas" element={<FactFacturas />} />
        <Route path="facturacion/vencimientos" element={<FactVencimientos />} />
        <Route path="facturacion/reportes" element={<FactReportes />} />
        <Route path="facturacion/auditoria" element={<FactAuditoria />} />
        <Route
          path="configuracion_global"
          element={<Navigate to="identidad" replace />}
        />
        <Route path="configuracion_global/identidad" element={<CfgIdentidad />} />
        <Route path="configuracion_global/apariencia" element={<CfgApariencia />} />
        <Route path="configuracion_global/regional" element={<CfgRegional />} />
        <Route
          path="configuracion_global/comunicaciones"
          element={<CfgComunicaciones />}
        />
        <Route path="configuracion_global/plataforma" element={<CfgPlataforma />} />
        <Route path="configuracion_global/auditoria" element={<CfgAuditoria />} />
      </Route>

      <Route
        path="/app/administrador"
        element={
          <Protected>
            <AdministradorLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route
          path="identidad_accesos"
          element={<Navigate to="usuarios" replace />}
        />
        <Route path="identidad_accesos/usuarios" element={<AdminIdentidadUsuarios />} />
        <Route
          path="identidad_accesos/credenciales"
          element={<AdminIdentidadCredenciales />}
        />
        <Route path="identidad_accesos/sesiones" element={<AdminIdentidadSesiones />} />
        <Route
          path="estructura_organizacional"
          element={<Navigate to="jurisdicciones" replace />}
        />
        <Route
          path="estructura_organizacional/jurisdicciones"
          element={<AdminEstructuraJurisdicciones />}
        />
        <Route
          path="estructura_organizacional/departamentos"
          element={<Navigate to="/app/administrador/estructura_organizacional/jurisdicciones" replace />}
        />
        <Route
          path="estructura_organizacional/plazas"
          element={<AdminEstructuraPlazas />}
        />
        <Route
          path="parametros_catalogos"
          element={<Navigate to="tipos_delito" replace />}
        />
        <Route
          path="parametros_catalogos/tipos_delito"
          element={<AdminCatalogosDelitos />}
        />
        <Route
          path="parametros_catalogos/catalogos_operativos"
          element={<AdminCatalogosOperativos />}
        />
        <Route
          path="parametros_catalogos/variables_globales"
          element={<AdminCatalogosVariables />}
        />
        <Route path="suscripcion_uso" element={<AdminSuscripcionUso />} />
      </Route>

      <Route
        path="/app/visor_ejecutivo"
        element={
          <Protected>
            <VisorLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<VisorDashboard />} />
        <Route path="indicadores" element={<VisorIndicadores />} />
        <Route path="reportes_estrategicos" element={<VisorReportes />} />
      </Route>

      <Route
        path="/app/director_zona"
        element={
          <Protected>
            <DirectorLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="inteligencia" replace />} />
        <Route path="inteligencia" element={<DirectorInteligencia />} />
        <Route path="supervision" element={<DirectorSupervision />} />
        <Route path="personal" element={<DirectorPersonal />} />
        <Route path="reportes" element={<DirectorReportes />} />
        <Route path="comunicacion" element={<DirectorComunicacion />} />
        <Route path="dashboard" element={<Navigate to="/app/director_zona/inteligencia" replace />} />
        <Route path="zonas" element={<Navigate to="/app/director_zona/inteligencia" replace />} />
        <Route path="operaciones" element={<Navigate to="/app/director_zona/inteligencia" replace />} />
      </Route>

      <Route
        path="/app/supervisor_unidad"
        element={
          <Protected>
            <SupervisorLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupervisorDashboard />} />
        <Route path="logistica_turnos/escuadras" element={<SupervisorEscuadras />} />
        <Route path="logistica_turnos/vehiculos" element={<SupervisorVehiculos />} />
        <Route path="logistica_turnos/sectores" element={<SupervisorSectores />} />
        <Route path="logistica_turnos/horarios" element={<SupervisorHorarios />} />
        <Route path="despacho_operativo/auxilios" element={<SupervisorAuxilios />} />
        <Route path="despacho_operativo/ordenes" element={<SupervisorOrdenes />} />
        <Route path="monitoreo_tactico/rastreo_gps" element={<SupervisorRastreoGps />} />
        <Route path="monitoreo_tactico/estadisticas" element={<SupervisorEstadisticas />} />
        <Route path="control_calidad/pendientes" element={<SupervisorPendientes />} />
        <Route path="control_calidad/historial" element={<SupervisorHistorial />} />
      </Route>

      <Route
        path="/app/detective"
        element={
          <Protected>
            <DetectiveLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DetectiveDashboard />} />
        <Route path="casos" element={<DetectiveCasos />} />
        <Route path="actividades" element={<DetectiveActividades />} />
      </Route>

      <Route
        path="/app/fiscal"
        element={
          <Protected>
            <FiscalLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<FiscalDashboard />} />
        <Route path="bandeja" element={<FiscalBandeja />} />
        <Route path="historial" element={<FiscalBandeja historial />} />
      </Route>

      <Route
        path="/app/agente_operativo"
        element={
          <Protected>
            <AgenteLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AgenteDashboard />} />
        <Route path="registro_operativo/partes_aprehension" element={<AgentePartes />} />
        <Route path="registro_operativo/novedades" element={<AgenteNovedades />} />
        <Route path="registro_operativo/multimedia" element={<AgenteMultimedia />} />
        <Route path="despacho_tareas/alertas" element={<AgenteAlertas />} />
        <Route path="despacho_tareas/mi_turno" element={<AgenteMiTurno />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
