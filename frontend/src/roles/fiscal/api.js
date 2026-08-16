import { API_URL, apiFetch, getToken } from "../../auth/api";

const DASH = "/api/roles/fiscal/dashboard";
const BAN = "/api/roles/fiscal/bandeja";

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

export const fiscalApi = {
  dashboard: () => apiFetch(`${DASH}/`),
  meta: () => apiFetch(`${BAN}/meta/`),
  listCasos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`${BAN}/${q ? `?${q}` : ""}`);
  },
  getCaso: (id) => apiFetch(`${BAN}/${id}/`),
  fetchPartePdf: (casoId) => fetchPdfBlob(`${BAN}/${casoId}/pdf/`),
  despachoAdmin: (id, body = {}) =>
    apiFetch(`${BAN}/${id}/despacho-admin/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  abrirInvestigacion: (id, body) =>
    apiFetch(`${BAN}/${id}/abrir-investigacion/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
