import { apiFetch } from "../../auth/api";

const ID = "/api/roles/administrador/identidad_accesos";
const EO = "/api/roles/administrador/estructura_organizacional";
const PC = "/api/roles/administrador/parametros_catalogos";

export const identidadApi = {
  listUsuarios: (params = {}) => {
    const q = new URLSearchParams(params).toString();
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
};

export const estructuraApi = {
  catalogos: () => apiFetch(`${EO}/catalogos/`),
  listJurisdicciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${EO}/jurisdicciones/${q ? `?${q}` : ""}`);
  },
  createJurisdiccion: (body) =>
    apiFetch(`${EO}/jurisdicciones/`, { method: "POST", body: JSON.stringify(body) }),
  updateJurisdiccion: (id, body) =>
    apiFetch(`${EO}/jurisdicciones/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  inactivarJurisdiccion: (id) =>
    apiFetch(`${EO}/jurisdicciones/${id}/inactivar/`, { method: "POST", body: "{}" }),
  listDepartamentos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${EO}/departamentos/${q ? `?${q}` : ""}`);
  },
  createDepartamento: (body) =>
    apiFetch(`${EO}/departamentos/`, { method: "POST", body: JSON.stringify(body) }),
  updateDepartamento: (id, body) =>
    apiFetch(`${EO}/departamentos/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  inactivarDepartamento: (id) =>
    apiFetch(`${EO}/departamentos/${id}/inactivar/`, { method: "POST", body: "{}" }),
  listPlazas: () => apiFetch(`${EO}/plazas/`),
  assignPlaza: (body) =>
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
