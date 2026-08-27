import { apiFetch, API_URL, getToken } from "../../auth/api";

const RO = "/api/roles/agente_operativo/registro_operativo";
const DT = "/api/roles/agente_operativo/despacho_tareas";
const DASH = "/api/roles/agente_operativo/dashboard";

/** Normaliza respuesta paginada `{ results, count, ... }` o array legado. */
export function unwrapPage(data) {
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      page: 1,
      page_size: data.length || 10,
      total_pages: 1,
    };
  }
  return {
    results: data?.results || [],
    count: data?.count ?? 0,
    page: data?.page ?? 1,
    page_size: data?.page_size ?? 10,
    total_pages: data?.total_pages ?? 1,
  };
}

function cleanParams(params = {}) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  });
  return out;
}

export const agenteApi = {
  dashboard: () => apiFetch(`${DASH}/`),
  meta: () => apiFetch(`${RO}/meta/`),

  listPartes: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${RO}/partes/${q ? `?${q}` : ""}`);
  },
  getParte: (id) => apiFetch(`${RO}/partes/${id}/`),
  createParte: (body) =>
    apiFetch(`${RO}/partes/`, { method: "POST", body: JSON.stringify(body) }),
  updateParte: (id, body) =>
    apiFetch(`${RO}/partes/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  enviarParteRevision: (id) =>
    apiFetch(`${RO}/partes/${id}/enviar-revision/`, { method: "POST", body: "{}" }),

  fetchPartePdf: async (id, { download = false } = {}) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const q = download ? "?download=1" : "";
    const response = await fetch(`${API_URL}${RO}/partes/${id}/pdf/${q}`, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "No se pudo obtener el PDF");
    }
    return response.blob();
  },

  listNovedades: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${RO}/novedades/${q ? `?${q}` : ""}`);
  },
  createNovedad: (body) =>
    apiFetch(`${RO}/novedades/`, { method: "POST", body: JSON.stringify(body) }),
  updateNovedad: (id, body) =>
    apiFetch(`${RO}/novedades/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),

  listMultimedia: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
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
  fetchMultimediaBlob: async (id, { download = false } = {}) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const q = download ? "?download=1" : "";
    const response = await fetch(`${API_URL}${RO}/multimedia/${id}/archivo/${q}`, {
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "No se pudo cargar el archivo");
    }
    return response.blob();
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
