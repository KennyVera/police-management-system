import { useEffect, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { estructuraApi } from "../../../api";

export default function AsignacionPlazasPanel({ departamentos, jurisdicciones }) {
  const [plazas, setPlazas] = useState([]);
  const [form, setForm] = useState({
    user_id: "",
    departamento_id: "",
    jurisdiccion_id: "",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setPlazas(await estructuraApi.listPlazas());
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function assign(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await estructuraApi.assignPlaza({
        user_id: Number(form.user_id),
        departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
        jurisdiccion_id: form.jurisdiccion_id ? Number(form.jurisdiccion_id) : null,
      });
      setMsg("Plaza actualizada.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <form className="panel-card form-grid" onSubmit={assign}>
        <h3 className="full" style={{ margin: 0 }}>
          Vincular policía a departamento y jurisdicción
        </h3>
        {error && <p className="mod-error full">{error}</p>}
        {msg && (
          <p className="full" style={{ color: "#1f7a45", margin: 0 }}>
            {msg}
          </p>
        )}
        <label className="full">
          Usuario
          <select
            required
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          >
            <option value="">Seleccione...</option>
            {plazas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} ({u.cedula || u.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Departamento
          <select
            value={form.departamento_id}
            onChange={(e) => setForm({ ...form, departamento_id: e.target.value })}
          >
            <option value="">— Sin departamento —</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Jurisdicción
          <select
            value={form.jurisdiccion_id}
            onChange={(e) => setForm({ ...form, jurisdiccion_id: e.target.value })}
          >
            <option value="">— Sin jurisdicción —</option>
            {jurisdicciones.map((j) => (
              <option key={j.id} value={j.id}>
                {j.tipo_label}: {j.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="full">
          <button type="submit" className="btn-accent">
            <MaterialIcon name="link" />
            Asignar plaza
          </button>
        </div>
      </form>

      <div className="panel-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Funcionario</th>
              <th>Departamento</th>
              <th>Jurisdicción</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {plazas.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.first_name} {u.last_name}
                </td>
                <td>{u.departamento_nombre || "—"}</td>
                <td>{u.jurisdiccion_nombre || "—"}</td>
                <td>{u.role_label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
