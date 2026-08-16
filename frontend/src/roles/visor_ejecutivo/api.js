import { API_URL, apiFetch, getToken } from "../../auth/api";

const IND = "/api/roles/visor_ejecutivo/indicadores";
const REP = "/api/roles/visor_ejecutivo/reportes_estrategicos";

export const visorIndicadoresApi = {
  home: () => apiFetch(`${IND}/`),
  zonas: () => apiFetch(`${IND}/zonas/`),
  ficha: (id) => apiFetch(`${IND}/zonas/${id}/`),
};

export const visorReportesApi = {
  home: () => apiFetch(`${REP}/`),
  catalogo: () => apiFetch(`${REP}/catalogo/`),
  /** Stub JSON: «Generando reporte desde ClickHouse…» */
  descargar: (endpoint) =>
    apiFetch(`${REP}/${endpoint.replace(/^\//, "").replace(/\/?$/, "/")}`),
};

/**
 * Descarga PDF del reporte (stub ReportLab válido).
 */
export async function descargarReporteArchivo(endpoint, filename = "reporte.pdf") {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const clean = endpoint.replace(/^\//, "").replace(/\/?$/, "/");
  const path = `${REP}/${clean}`;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail || "";
    } catch {
      try {
        detail = await response.text();
      } catch {
        detail = "";
      }
    }
    throw new Error(detail || `No se pudo descargar (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error("El servidor devolvió un PDF vacío.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
