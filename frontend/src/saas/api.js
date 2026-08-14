import { API_URL, apiFetch, getToken, persistSession } from "../auth/api";

function qs(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (!entries.length) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

export const saasApi = {
  planes: () => apiFetch("/api/saas/planes/"),
  registrar: (body) =>
    apiFetch("/api/saas/registrar/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  estadisticas: () => apiFetch("/api/saas/estadisticas/"),
  tenantDetalle: (id) => apiFetch(`/api/saas/tenants/${id}/`),

  // SuperAdmin — Planes
  adminPlanes: (archivados = false) =>
    apiFetch(`/api/saas/admin/planes/${archivados ? "?archivados=1" : ""}`),
  adminPlanDetalle: (id) => apiFetch(`/api/saas/admin/planes/${id}/`),
  adminPlanCrear: (body) =>
    apiFetch("/api/saas/admin/planes/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminPlanEditar: (id, body) =>
    apiFetch(`/api/saas/admin/planes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminPlanDuplicar: (id) =>
    apiFetch(`/api/saas/admin/planes/${id}/duplicar/`, { method: "POST", body: "{}" }),
  adminPlanActivar: (id, activo) =>
    apiFetch(`/api/saas/admin/planes/${id}/activar/`, {
      method: "POST",
      body: JSON.stringify({ activo }),
    }),
  adminPlanArchivar: (id, archivado = true) =>
    apiFetch(`/api/saas/admin/planes/${id}/archivar/`, {
      method: "POST",
      body: JSON.stringify({ archivado }),
    }),
  adminPlanInstituciones: (id) =>
    apiFetch(`/api/saas/admin/planes/${id}/instituciones/`),

  // SuperAdmin — Suscripciones
  adminSuscripciones: (estado) =>
    apiFetch(
      `/api/saas/admin/suscripciones/${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`
    ),
  adminSuscripcionAsignar: (body) =>
    apiFetch("/api/saas/admin/suscripciones/asignar/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSuscripcionCambiar: (body) =>
    apiFetch("/api/saas/admin/suscripciones/cambiar/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSuscripcionRenovar: (body) =>
    apiFetch("/api/saas/admin/suscripciones/renovar/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSuscripcionSuspender: (body) =>
    apiFetch("/api/saas/admin/suscripciones/suspender/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSuscripcionCancelar: (body) =>
    apiFetch("/api/saas/admin/suscripciones/cancelar/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSuscripcionHistorial: (institucionId) =>
    apiFetch(`/api/saas/admin/suscripciones/${institucionId}/historial/`),

  // SuperAdmin — Usuarios de plataforma
  adminAdmins: (params = {}) => apiFetch(`/api/saas/admin/admins/${qs(params)}`),
  adminAdminEditar: (id, body) =>
    apiFetch(`/api/saas/admin/admins/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminAdminEstado: (id, body) =>
    apiFetch(`/api/saas/admin/admins/${id}/estado/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminAdminRestablecer: (id, body) =>
    apiFetch(`/api/saas/admin/admins/${id}/restablecer/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminAdminRevocar: (id, body = {}) =>
    apiFetch(`/api/saas/admin/admins/${id}/revocar/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminAdminPermisos: (id) => apiFetch(`/api/saas/admin/admins/${id}/permisos/`),
  adminAdminGuardarPermisos: (id, body) =>
    apiFetch(`/api/saas/admin/admins/${id}/permisos/`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  adminAdminActividad: (id) => apiFetch(`/api/saas/admin/admins/${id}/actividad/`),
  adminAccesoSesiones: () => apiFetch("/api/saas/admin/acceso/sesiones/"),
  adminAccesoCerrarSesion: (sessionId) =>
    apiFetch(`/api/saas/admin/acceso/sesiones/${sessionId}/cerrar/`, {
      method: "POST",
      body: "{}",
    }),
  adminAccesoHistorial: (params = {}) =>
    apiFetch(`/api/saas/admin/acceso/historial/${qs(params)}`),
};

export async function registrarYPersistir(body) {
  const data = await saasApi.registrar(body);
  if (data.token && data.user) {
    persistSession(data.token, data.user);
  }
  return data;
}

export { API_URL, getToken };
