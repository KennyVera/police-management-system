import { apiFetch, getToken, API_URL } from "../../auth/api";
import { cleanParams, unwrapPage } from "../../shared/utils/pagination";

const ID = "/api/roles/administrador/identidad_accesos";
const EO = "/api/roles/administrador/estructura_organizacional";
const PC = "/api/roles/administrador/parametros_catalogos";

export { unwrapPage };

async function fetchBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "No se pudo descargar el archivo");
  }
  return response.blob();
}

export const identidadApi = {
  listUsuarios: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${ID}/usuarios/${q ? `?${q}` : ""}`);
  },
  createUsuario: (body) =>
    apiFetch(`${ID}/usuarios/`, { method: "POST", body: JSON.stringify(body) }),
  updateUsuario: (id, body) =>
    apiFetch(`${ID}/usuarios/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  setEstado: (id, estado) =>
    apiFetch(`${ID}/usuarios/${id}/estado/`, {
      method: "POST",
      body: JSON.stringify({ estado }),
    }),
  resetPassword: (id, new_password) =>
    apiFetch(`${ID}/usuarios/${id}/reset-password/`, {
      method: "POST",
      body: JSON.stringify({ new_password }),
    }),
  toggle2fa: (id, enabled) =>
    apiFetch(`${ID}/usuarios/${id}/2fa/`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  listSesiones: () => apiFetch(`${ID}/sesiones/`),
  cerrarSesion: (sessionId) =>
    apiFetch(`${ID}/sesiones/${sessionId}/cerrar/`, { method: "POST", body: "{}" }),
  rolesAsignables: () => apiFetch(`${ID}/roles-asignables/`),
  generarIdentificadores: () => apiFetch(`${ID}/generar-identificadores/`),
};

export const estructuraApi = {
  catalogos: () => apiFetch(`${EO}/catalogos/`),
  listJurisdicciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${EO}/jurisdicciones/${q ? `?${q}` : ""}`);
  },
  listJurisdiccionesMapa: () =>
    apiFetch(`${EO}/jurisdicciones/?scope=mapa`),
  createJurisdiccion: (body) =>
    apiFetch(`${EO}/jurisdicciones/`, { method: "POST", body: JSON.stringify(body) }),
  updateJurisdiccion: (id, body) =>
    apiFetch(`${EO}/jurisdicciones/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  inactivarJurisdiccion: (id) =>
    apiFetch(`${EO}/jurisdicciones/${id}/inactivar/`, { method: "POST", body: "{}" }),
  jurisdiccionPersonal: (id) => apiFetch(`${EO}/jurisdicciones/${id}/personal/`),
  jurisdiccionPersonalPdf: (id) =>
    fetchBlob(`${EO}/jurisdicciones/${id}/personal/pdf/`),
  restablecerAsignaciones: (id) =>
    apiFetch(`${EO}/jurisdicciones/${id}/restablecer-asignaciones/`, {
      method: "POST",
      body: "{}",
    }),
  listPlazas: (params = {}) => {
    const q = new URLSearchParams(cleanParams(params)).toString();
    return apiFetch(`${EO}/plazas/${q ? `?${q}` : ""}`);
  },
  assignPlaza: (body) =>
    apiFetch(`${EO}/plazas/`, { method: "POST", body: JSON.stringify(body) }),
  assignPlazasBatch: (body) =>
    apiFetch(`${EO}/plazas/`, { method: "POST", body: JSON.stringify(body) }),
};

export const catalogosApi = {
  meta: () => apiFetch(`${PC}/meta/`),
  listDelitos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${PC}/tipos-delito/${q ? `?${q}` : ""}`);
  },
  createDelito: (body) =>
    apiFetch(`${PC}/tipos-delito/`, { method: "POST", body: JSON.stringify(body) }),
  updateDelito: (id, body) =>
    apiFetch(`${PC}/tipos-delito/${id}/`, { method: "PATCH", body: JSON.stringify(body) }),
  inactivarDelito: (id) =>
    apiFetch(`${PC}/tipos-delito/${id}/inactivar/`, { method: "POST", body: "{}" }),
  listOperativos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${PC}/catalogos-operativos/${q ? `?${q}` : ""}`);
  },
  createOperativo: (body) =>
    apiFetch(`${PC}/catalogos-operativos/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateOperativo: (id, body) =>
    apiFetch(`${PC}/catalogos-operativos/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  inactivarOperativo: (id) =>
    apiFetch(`${PC}/catalogos-operativos/${id}/inactivar/`, {
      method: "POST",
      body: "{}",
    }),
  listVariables: () => apiFetch(`${PC}/variables-globales/`),
  updateVariable: (id, body) =>
    apiFetch(`${PC}/variables-globales/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
