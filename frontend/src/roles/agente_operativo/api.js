import { apiFetch, API_URL, getToken } from "../../auth/api";

const RO = "/api/roles/agente_operativo/registro_operativo";
const DT = "/api/roles/agente_operativo/despacho_tareas";
const DASH = "/api/roles/agente_operativo/dashboard";

export const agenteApi = {
  dashboard: () => apiFetch(`${DASH}/`),
  meta: () => apiFetch(`${RO}/meta/`),

  listPartes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${RO}/partes/${q ? `?${q}` : ""}`);
  },
  createParte: (body) =>
    apiFetch(`${RO}/partes/`, { method: "POST", body: JSON.stringify(body) }),
  updateParte: (id, body) =>
    apiFetch(`${RO}/partes/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  enviarParteRevision: (id) =>
    apiFetch(`${RO}/partes/${id}/enviar-revision/`, { method: "POST", body: "{}" }),

  listNovedades: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${RO}/novedades/${q ? `?${q}` : ""}`);
  },
  createNovedad: (body) =>
    apiFetch(`${RO}/novedades/`, { method: "POST", body: JSON.stringify(body) }),
  updateNovedad: (id, body) =>
    apiFetch(`${RO}/novedades/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  listMultimedia: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${RO}/multimedia/${q ? `?${q}` : ""}`);
  },
  uploadMultimedia: async (formData) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const response = await fetch(`${API_URL}${RO}/multimedia/`, {
      method: "POST",
      headers,
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        data.detail ||
        data.non_field_errors?.[0] ||
        (typeof data === "object" ? Object.values(data).flat()?.[0] : null) ||
        "Error al subir archivo";
      throw new Error(detail);
    }
    return data;
  },

  despachoResumen: () => apiFetch(`${DT}/resumen/`),
  miTurno: () => apiFetch(`${DT}/mi-turno/`),
  listAlertas: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${DT}/alertas/${q ? `?${q}` : ""}`);
  },
  alertaEnCamino: (id) =>
    apiFetch(`${DT}/alertas/${id}/en-camino/`, { method: "POST", body: "{}" }),
  alertaLlegada: (id) =>
    apiFetch(`${DT}/alertas/${id}/llegada/`, { method: "POST", body: "{}" }),
  alertaCerrar: (id) =>
    apiFetch(`${DT}/alertas/${id}/cerrar/`, { method: "POST", body: "{}" }),
};
