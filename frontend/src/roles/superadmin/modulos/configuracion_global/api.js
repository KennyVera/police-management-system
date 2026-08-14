import { API_URL, apiFetch, getToken } from "../../../../auth/api";

const B = "/api/saas/admin/configuracion";

export const configApi = {
  resumen: () => apiFetch(`${B}/resumen/`),
  get: (seccion) => apiFetch(`${B}/${seccion}/`),
  save: (seccion, body) =>
    apiFetch(`${B}/${seccion}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  auditoria: (seccion) =>
    apiFetch(
      `${B}/auditoria/${seccion ? `?seccion=${encodeURIComponent(seccion)}` : ""}`
    ),
  uploadBranding: async (campo, file) => {
    const fd = new FormData();
    fd.append("campo", campo);
    fd.append("file", file);
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const response = await fetch(`${API_URL}${B}/upload/`, {
      method: "POST",
      headers,
      body: fd,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || "No se pudo subir la imagen");
    }
    return data;
  },
};
