import { apiFetch } from "../../auth/api";

const LOG = "/api/roles/supervisor_unidad/logistica_turnos";
const CQ = "/api/roles/supervisor_unidad/control_calidad";
const DES = "/api/roles/supervisor_unidad/despacho_operativo";

export const supervisorApi = {
  dashboard: () => apiFetch("/api/roles/supervisor_unidad/dashboard/"),
  meta: () => apiFetch(`${LOG}/meta/`),

  listEscuadras: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${LOG}/escuadras/${q ? `?${q}` : ""}`);
  },
  createEscuadra: (body) =>
    apiFetch(`${LOG}/escuadras/`, { method: "POST", body: JSON.stringify(body) }),
  inactivarEscuadra: (id) =>
    apiFetch(`${LOG}/escuadras/${id}/inactivar/`, { method: "POST", body: "{}" }),
  asignarVehiculoEscuadra: (id, body) =>
    apiFetch(`${LOG}/escuadras/${id}/asignar_vehiculo/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listVehiculos: () => apiFetch(`${LOG}/vehiculos/`),
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

  listPendientes: () => apiFetch(`${CQ}/pendientes/`),
  listHistorial: () => apiFetch(`${CQ}/historial/`),
  getParte: (id) => apiFetch(`${CQ}/${id}/`),
  rechazar: (id, motivo) =>
    apiFetch(`${CQ}/${id}/rechazar/`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }),
  aprobar: (id) => apiFetch(`${CQ}/${id}/aprobar/`, { method: "POST", body: "{}" }),
};
