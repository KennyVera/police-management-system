/** Helpers UI compartidos de Facturación. */
export function money(v) {
  return Number(v || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("es-EC");
  } catch {
    return String(v);
  }
}

export function fmtDateTime(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("es-EC");
  } catch {
    return String(v);
  }
}

export function pillClass(estado) {
  const bad = ["ANULADA", "VENCIDA", "VENCIDO", "SUSPENDIDO", "CANCELADO", "PENDIENTE"];
  const ok = ["ACTIVO", "CONFIRMADO", "PAGADA", "EMITIDA"];
  if (ok.includes(estado)) return "ok";
  if (bad.includes(estado)) return "bad";
  return "";
}
