import { API_URL, apiFetch, getToken } from "../../auth/api";

const TACTICO = "/api/tactico";
const DIR = "/api/roles/director_zona";

function qs(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function downloadBlob(path, filenameFallback) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "No se pudo descargar el archivo");
  }
  const blob = await response.blob();
  const cd = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(cd);
  const filename = match?.[1] || filenameFallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const directorApi = {
  /* —— Inteligencia táctica (ClickHouse) —— */
  estadisticas: () => apiFetch(`${TACTICO}/estadisticas/`),
  panel: (params = {}) => apiFetch(`${TACTICO}/panel/${qs(params)}`),
  mapaCalor: (params = {}) => apiFetch(`${TACTICO}/mapa-calor/${qs(params)}`),
  rankingDistritos: (params = {}) => apiFetch(`${TACTICO}/ranking-distritos/${qs(params)}`),
  delitosDesglose: (params = {}) => apiFetch(`${TACTICO}/delitos-desglose/${qs(params)}`),
  partesAuditoria: (params = {}) => apiFetch(`${TACTICO}/partes/${qs(params)}`),

  /* —— Supervisión de casos —— */
  casosCriticos: () => apiFetch(`${DIR}/supervision/casos-criticos/`),
  casoCritico: (id) => apiFetch(`${DIR}/supervision/casos-criticos/${id}/`),

  /* —— Personal regional —— */
  estadoPersonal: () => apiFetch(`${DIR}/personal/estado/`),
  listSupervisores: () => apiFetch(`${DIR}/personal/supervisores/`),
  listEvaluaciones: () => apiFetch(`${DIR}/personal/evaluaciones/`),
  createEvaluacion: (body) =>
    apiFetch(`${DIR}/personal/evaluaciones/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteEvaluacion: (id) =>
    apiFetch(`${DIR}/personal/evaluaciones/${id}/`, { method: "DELETE" }),

  /* —— Reportes —— */
  reportePreview: (params = {}) => apiFetch(`${DIR}/reportes/preview/${qs(params)}`),
  descargarReporte: (params = {}) =>
    downloadBlob(
      `${DIR}/reportes/exportar/${qs(params)}`,
      params.formato === "excel" ? "informe_zona.xlsx" : "informe_zona.pdf"
    ),

  /* —— Comunicación vertical —— */
  listDisposiciones: () => apiFetch(`${DIR}/comunicacion/disposiciones/`),
  createDisposicion: (body) =>
    apiFetch(`${DIR}/comunicacion/disposiciones/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getDisposicion: (id) => apiFetch(`${DIR}/comunicacion/disposiciones/${id}/`),
};
