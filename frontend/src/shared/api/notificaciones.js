import { apiFetch } from "../../auth/api";

export const notificacionesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/notificaciones/${q ? `?${q}` : ""}`);
  },
  markRead: (id) =>
    apiFetch(`/api/notificaciones/${id}/leer/`, { method: "POST", body: "{}" }),
  markAllRead: () =>
    apiFetch(`/api/notificaciones/leer-todas/`, { method: "POST", body: "{}" }),
};
