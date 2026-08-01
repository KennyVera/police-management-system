import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { catalogosApi } from "../../../api";

export default function VariablesGlobalesPanel({ items, onChanged }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(items.map((v) => [v.id, v.valor]))
  );
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function setDraft(id, value) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function save(item) {
    setMsg("");
    setError("");
    try {
      await catalogosApi.updateVariable(item.id, { valor: drafts[item.id] });
      setMsg(`Variable «${item.nombre}» actualizada.`);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel-card" style={{ display: "grid", gap: "1rem" }}>
      {msg && <p style={{ color: "#1f7a45", margin: 0 }}>{msg}</p>}
      {error && <p className="mod-error">{error}</p>}
      {items.map((v) => (
        <div
          key={v.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.8fr auto",
            gap: "0.75rem",
            alignItems: "end",
            paddingBottom: "0.85rem",
            borderBottom: "1px solid #eef1f6",
          }}
        >
          <div>
            <strong>{v.nombre}</strong>
            <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
              {v.clave} · {v.descripcion}
            </div>
          </div>
          <label style={{ display: "grid", gap: "0.3rem" }}>
            Valor {v.unidad ? `(${v.unidad})` : ""}
            <input
              value={drafts[v.id] ?? v.valor}
              onChange={(e) => setDraft(v.id, e.target.value)}
            />
          </label>
          <button type="button" className="btn-accent" onClick={() => save(v)}>
            <MaterialIcon name="save" />
            Guardar
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="mod-muted">No hay variables configuradas. Reinicia el backend para sembrarlas.</p>
      )}
    </div>
  );
}
