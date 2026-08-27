import { API_URL, apiFetch, getToken } from "../../auth/api";
import { cleanParams, unwrapPage } from "../../shared/utils/pagination";

export { unwrapPage };

const LOG = "/api/roles/supervisor_unidad/logistica_turnos";
const CQ = "/api/roles/supervisor_unidad/control_calidad";
const DES = "/api/roles/supervisor_unidad/despacho_operativo";
const MON = "/api/roles/supervisor_unidad/monitoreo_tactico";

async function fetchPdfBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "No se pudo obtener el PDF");
  }
  return response.blob();
}

export const supervisorApi = {
  dashboard: () => apiFetch("/api/roles/supervisor_unidad/dashboard/"),
  meta: () => apiFetch(`${LOG}/meta/`),

  listEscuadras: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${LOG}/escuadras/${q ? `?${q}` : ""}`);
  },
  createEscuadra: (body) =>
    apiFetch(`${LOG}/escuadras/`, { method: "POST", body: JSON.stringify(body) }),
  updateEscuadra: (id, body) =>
    apiFetch(`${LOG}/escuadras/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  inactivarEscuadra: (id) =>
    apiFetch(`${LOG}/escuadras/${id}/inactivar/`, { method: "POST", body: "{}" }),
  asignarVehiculoEscuadra: (id, body) =>
    apiFetch(`${LOG}/escuadras/${id}/asignar_vehiculo/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listVehiculos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${LOG}/vehiculos/${q ? `?${q}` : ""}`);
  },
  createVehiculo: (body) =>
    apiFetch(`${LOG}/vehiculos/`, { method: "POST", body: JSON.stringify(body) }),
  updateVehiculo: (id, body) =>
    apiFetch(`${LOG}/vehiculos/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  listAsignaciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${LOG}/asignaciones/${q ? `?${q}` : ""}`);
  },
  createAsignacion: (body) =>
    apiFetch(`${LOG}/asignaciones/`, { method: "POST", body: JSON.stringify(body) }),
  updateAsignacion: (id, body) =>
    apiFetch(`${LOG}/asignaciones/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAsignacion: (id) =>
    apiFetch(`${LOG}/asignaciones/${id}/`, { method: "DELETE" }),
  cuadrantesMapa: () => apiFetch(`${LOG}/cuadrantes-mapa/`),

  listHorarios: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${LOG}/horarios/${q ? `?${q}` : ""}`);
  },
  createHorario: (body) =>
    apiFetch(`${LOG}/horarios/`, { method: "POST", body: JSON.stringify(body) }),
  decidirHorario: (id, body) =>
    apiFetch(`${LOG}/horarios/${id}/decidir/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  despachoMeta: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${DES}/meta/${q ? `?${q}` : ""}`);
  },
  listAlertas: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${DES}/alertas/${q ? `?${q}` : ""}`);
  },
  createAlerta: (body) =>
    apiFetch(`${DES}/alertas/`, { method: "POST", body: JSON.stringify(body) }),
  sugerenciasAlerta: (id) => apiFetch(`${DES}/alertas/${id}/sugerencias/`),
  asignarAlerta: (id, body) =>
    apiFetch(`${DES}/alertas/${id}/asignar/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listOrdenes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${DES}/ordenes/${q ? `?${q}` : ""}`);
  },
  createOrden: (body) =>
    apiFetch(`${DES}/ordenes/`, { method: "POST", body: JSON.stringify(body) }),
  decidirOrden: (id, body) =>
    apiFetch(`${DES}/ordenes/${id}/decidir/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  monitoreoUnidades: () => apiFetch(`${MON}/unidades/`),
  monitoreoStats: () => apiFetch(`${MON}/estadisticas/`),

  listPendientes: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${CQ}/pendientes/${q ? `?${q}` : ""}`);
  },
  listHistorial: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${CQ}/historial/${q ? `?${q}` : ""}`);
  },
  getParte: (id) => apiFetch(`${CQ}/${id}/`),
  rechazar: (id, motivo) =>
    apiFetch(`${CQ}/${id}/rechazar/`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }),
  aprobar: (id) => apiFetch(`${CQ}/${id}/aprobar/`, { method: "POST", body: "{}" }),
  fetchPartePdf: (id, { download = false } = {}) =>
    fetchPdfBlob(`${CQ}/${id}/pdf/${download ? "?download=1" : ""}`),
};
