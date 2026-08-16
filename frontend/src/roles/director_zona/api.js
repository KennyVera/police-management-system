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

async function downloadBlob(path, filenameFallback, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const raw = await response.text();
    let detail = "";
    try {
      detail = JSON.parse(raw)?.detail || "";
    } catch {
      detail = "";
    }
    throw new Error(
      detail || `No se pudo descargar el archivo (HTTP ${response.status})`
    );
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
  fetchPartePdf: async (id, { download = false } = {}) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Token ${token}`;
    const q = download ? "?download=1" : "";
    const response = await fetch(`${API_URL}${DIR}/supervision/partes/${id}/pdf/${q}`, {
      headers,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "No se pudo obtener el PDF");
    }
    return response.blob();
  },

  /* —— Personal regional —— */
  estadoPersonal: () => apiFetch(`${DIR}/personal/estado/`),
  descargarPersonalPdf: () =>
    downloadBlob(`${DIR}/personal/informe-pdf/`, "personal_disponibilidad.pdf"),
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
  descargarDashboardPdf: (params = {}, panel = null, options = {}) => {
    const vista = options.vista || "delitos";
    let body;
    let filename = "dashboard_tactico.pdf";
    if (vista === "mapa") {
      body = {
        vista: "mapa",
        filtros: params,
        mapa: options.mapa || null,
        radar: options.radar || panel?.radar || null,
        panel: panel || null,
      };
      filename = "mapa_calor.pdf";
    } else if (vista === "ranking") {
      body = {
        vista: "ranking",
        filtros: params,
        ranking: options.ranking || panel?.ranking_eficiencia || [],
        panel: panel || null,
      };
      filename = "ranking_distritos.pdf";
    } else if (vista === "estado") {
      body = {
        vista: "estado",
        filtros: params,
        estado_partes: options.estado_partes || panel?.estado_partes || null,
        panel: panel || null,
      };
      filename = "estado_partes.pdf";
    } else {
      body = {
        vista: "delitos",
        filtros: params,
        panel,
      };
    }
    return downloadBlob(`${DIR}/reportes/dashboard-pdf/`, filename, {
      method: "POST",
      body,
    });
  },

  /* —— Comunicación vertical —— */
  listDisposiciones: () => apiFetch(`${DIR}/comunicacion/disposiciones/`),
  createDisposicion: (body) =>
    apiFetch(`${DIR}/comunicacion/disposiciones/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getDisposicion: (id) => apiFetch(`${DIR}/comunicacion/disposiciones/${id}/`),
};
