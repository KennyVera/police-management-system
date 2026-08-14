import { useState } from "react";
import ModalShell from "./ModalShell";

export function RegistrarPagoModal({ instituciones, onClose, onSubmit }) {
  const [form, setForm] = useState({
    institucion_id: "",
    monto: "",
    metodo: "transferencia",
    referencia: "",
    nota: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell title="Registrar pago" onClose={onClose}>
      <div className="form-grid">
        <label className="full">
          Institución
          <select required value={form.institucion_id} onChange={(e) => set("institucion_id", e.target.value)}>
            <option value="">Seleccionar…</option>
            {instituciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre_comercial}</option>
            ))}
          </select>
        </label>
        <label>
          Monto
          <input type="number" min={0} step="0.01" required value={form.monto} onChange={(e) => set("monto", e.target.value)} />
        </label>
        <label>
          Método
          <select value={form.metodo} onChange={(e) => set("metodo", e.target.value)}>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="orden_compra">Orden de compra</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="full">
          Referencia
          <input value={form.referencia} onChange={(e) => set("referencia", e.target.value)} />
        </label>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button
          type="button"
          className="btn-accent"
          onClick={() =>
            onSubmit({
              ...form,
              institucion_id: Number(form.institucion_id),
              monto: Number(form.monto),
            })
          }
        >
          Registrar
        </button>
      </div>
    </ModalShell>
  );
}

export function ReembolsoModal({ row, onClose, onSubmit }) {
  const [monto, setMonto] = useState(row.monto);
  const [nota, setNota] = useState("");
  return (
    <ModalShell title="Reembolso / ajuste" subtitle={row.institucion_nombre} onClose={onClose}>
      <label style={{ display: "grid", gap: 6, marginBottom: 8 }}>
        Monto
        <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
        Nota
        <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-danger" onClick={() => onSubmit({ monto: Number(monto), nota })}>
          Confirmar reembolso
        </button>
      </div>
    </ModalShell>
  );
}
