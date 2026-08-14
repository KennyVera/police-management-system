import { API_URL, apiFetch, getToken } from "../../../../auth/api";

const B = "/api/saas/admin/facturacion";

function qs(params = {}) {
  const e = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return e.length ? `?${new URLSearchParams(e).toString()}` : "";
}

async function downloadPdf(path, filenameFallback) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const raw = await response.text();
    let detail = "";
    try {
      detail = JSON.parse(raw)?.detail || "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `No se pudo descargar el PDF (HTTP ${response.status})`);
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

export const facturacionApi = {
  suscripciones: (p) => apiFetch(`${B}/suscripciones/${qs(p)}`),
  renovar: (id, body) =>
    apiFetch(`${B}/suscripciones/${id}/renovar/`, { method: "POST", body: JSON.stringify(body) }),
  periodo: (id, body) =>
    apiFetch(`${B}/suscripciones/${id}/periodo/`, { method: "POST", body: JSON.stringify(body) }),
  suscripcionHistorial: (id) => apiFetch(`${B}/suscripciones/${id}/historial/`),

  pagos: (p) => apiFetch(`${B}/pagos/${qs(p)}`),
  registrarPago: (body) =>
    apiFetch(`${B}/pagos/`, { method: "POST", body: JSON.stringify(body) }),
  confirmarPago: (id) =>
    apiFetch(`${B}/pagos/${id}/confirmar/`, { method: "POST", body: "{}" }),
  reembolso: (id, body) =>
    apiFetch(`${B}/pagos/${id}/reembolso/`, { method: "POST", body: JSON.stringify(body) }),
  transacciones: (p) => apiFetch(`${B}/pagos/transacciones/${qs(p)}`),

  facturas: (p) => apiFetch(`${B}/facturas/${qs(p)}`),
  generarFactura: (body) =>
    apiFetch(`${B}/facturas/generar/`, { method: "POST", body: JSON.stringify(body) }),
  anularFactura: (id, body) =>
    apiFetch(`${B}/facturas/${id}/anular/`, { method: "POST", body: JSON.stringify(body) }),
  exportarFactura: (id) => apiFetch(`${B}/facturas/${id}/exportar/`),
  facturaHistorial: (id) => apiFetch(`${B}/facturas/${id}/historial/`),

  vencProximos: () => apiFetch(`${B}/vencimientos/proximos/`),
  vencVencidas: () => apiFetch(`${B}/vencimientos/vencidas/`),
  vencAlertas: () => apiFetch(`${B}/vencimientos/alertas/`),
  setGracia: (instId, body) =>
    apiFetch(`${B}/vencimientos/${instId}/gracia/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  vencHistorial: () => apiFetch(`${B}/vencimientos/historial/`),

  reporteDiario: (p) => apiFetch(`${B}/reportes/diario/${qs(p)}`),
  reporteMensual: (p) => apiFetch(`${B}/reportes/mensual/${qs(p)}`),
  reporteAnual: (p) => apiFetch(`${B}/reportes/anual/${qs(p)}`),
  reportePdf: (p) =>
    downloadPdf(`${B}/reportes/pdf/${qs(p)}`, `reporte_financiero_${p.nivel || "diario"}.pdf`),

  auditoria: (p) => apiFetch(`${B}/auditoria/${qs(p)}`),
};
