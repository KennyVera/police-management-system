import { apiFetch, API_URL, getToken } from "../../auth/api";

const DASH = "/api/roles/detective/dashboard";
const CASOS = "/api/roles/detective/casos";
const EV = "/api/roles/detective/evidencias";
const ACT = "/api/roles/detective/actividades";

async function uploadForm(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const response = await fetch(`${API_URL}${path}`, {
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
}

export const detectiveApi = {
  dashboard: () => apiFetch(`${DASH}/`),

  casosMeta: () => apiFetch(`${CASOS}/meta/`),
  listExpedientes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${CASOS}/${q ? `?${q}` : ""}`);
  },
  getExpediente: (id) => apiFetch(`${CASOS}/${id}/`),
  createExpediente: (body) =>
    apiFetch(`${CASOS}/`, { method: "POST", body: JSON.stringify(body) }),
  updateExpediente: (id, body) =>
    apiFetch(`${CASOS}/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  cambiarEstado: (id, body) =>
    apiFetch(`${CASOS}/${id}/estado/`, { method: "POST", body: JSON.stringify(body) }),
  listInvolucrados: (id) => apiFetch(`${CASOS}/${id}/involucrados/`),
  createInvolucrado: async (id, body, fotoFile = null) => {
    if (fotoFile) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      fd.append("foto", fotoFile);
      return uploadForm(`${CASOS}/${id}/involucrados/`, fd);
    }
    return apiFetch(`${CASOS}/${id}/involucrados/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateInvolucrado: async (id, invId, body, fotoFile = null) => {
    if (fotoFile) {
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Token ${token}`;
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      fd.append("foto", fotoFile);
      const response = await fetch(`${API_URL}${CASOS}/${id}/involucrados/${invId}/`, {
        method: "PATCH",
        headers,
        body: fd,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Error al actualizar involucrado");
      }
      return data;
    }
    return apiFetch(`${CASOS}/${id}/involucrados/${invId}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  deleteInvolucrado: (id, invId) =>
    apiFetch(`${CASOS}/${id}/involucrados/${invId}/`, { method: "DELETE" }),
  getInvolucradoPerfil: (expId, invId) =>
    apiFetch(`${CASOS}/${expId}/involucrados/${invId}/perfil/`),
  fetchInvolucradoFotoBlob: async (expId, invId) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const response = await fetch(
      `${API_URL}${CASOS}/${expId}/involucrados/${invId}/foto/`,
      { headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "No se pudo cargar la foto");
    }
    return response.blob();
  },

  evidenciasMeta: () => apiFetch(`${EV}/meta/`),
  listEvidencias: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${EV}/${q ? `?${q}` : ""}`);
  },
  getEvidencia: (id) => apiFetch(`${EV}/${id}/`),
  deleteEvidencia: (id) =>
    apiFetch(`${EV}/${id}/`, { method: "DELETE" }),
  archivoUrl: (id, download = false) =>
    `${API_URL}${EV}/${id}/archivo/${download ? "?download=1" : ""}`,
  fetchArchivoBlob: async (id, download = false) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const response = await fetch(
      `${API_URL}${EV}/${id}/archivo/${download ? "?download=1" : ""}`,
      { headers }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "No se pudo cargar el archivo");
    }
    return response.blob();
  },
  uploadDigital: (formData) => uploadForm(`${EV}/digital/`, formData),
  createFisica: (body) =>
    apiFetch(`${EV}/fisica/`, { method: "POST", body: JSON.stringify(body) }),
  registrarCustodia: (id, body) =>
    apiFetch(`${EV}/${id}/custodia/`, { method: "POST", body: JSON.stringify(body) }),

  actividadesMeta: () => apiFetch(`${ACT}/meta/`),
  listBitacora: (expId) => apiFetch(`${ACT}/${expId}/bitacora/`),
  createBitacora: (expId, body) =>
    apiFetch(`${ACT}/${expId}/bitacora/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteBitacora: (expId, entryId) =>
    apiFetch(`${ACT}/${expId}/bitacora/${entryId}/`, { method: "DELETE" }),
  listBienes: (expId) => apiFetch(`${ACT}/${expId}/bienes/`),
  createBien: (expId, body) =>
    apiFetch(`${ACT}/${expId}/bienes/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteBien: (expId, bienId) =>
    apiFetch(`${ACT}/${expId}/bienes/${bienId}/`, { method: "DELETE" }),
  listSolicitudes: (expId) => apiFetch(`${ACT}/${expId}/solicitudes/`),
  createSolicitud: (expId, body) =>
    apiFetch(`${ACT}/${expId}/solicitudes/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  enviarSolicitud: (expId, solId) =>
    apiFetch(`${ACT}/${expId}/solicitudes/${solId}/enviar/`, { method: "POST" }),
  getInforme: (expId) => apiFetch(`${ACT}/${expId}/informe/`),
  cerrarConInforme: (expId, body) =>
    apiFetch(`${ACT}/${expId}/cerrar/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
