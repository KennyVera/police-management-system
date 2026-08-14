import { useState } from "react";
import ModalShell from "./ModalShell";

export function RenovarModal({ row, onClose, onSubmit }) {
  const [meses, setMeses] = useState(1);
  return (
    <ModalShell title="Renovar suscripción" subtitle={row.nombre_comercial} onClose={onClose}>
      <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        Meses
        <input type="number" min={1} max={36} value={meses} onChange={(e) => setMeses(e.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-accent" onClick={() => onSubmit(Number(meses) || 1)}>Confirmar</button>
      </div>
    </ModalShell>
  );
}

export function PeriodoModal({ row, onClose, onSubmit }) {
  const [periodo, setPeriodo] = useState(row.periodo_facturacion || "MENSUAL");
  return (
    <ModalShell title="Cambiar periodo" subtitle={row.nombre_comercial} onClose={onClose}>
      <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        Periodo de facturación
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          <option value="MENSUAL">Mensual</option>
          <option value="ANUAL">Anual</option>
        </select>
      </label>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-accent" onClick={() => onSubmit(periodo)}>Guardar</button>
      </div>
    </ModalShell>
  );
}
