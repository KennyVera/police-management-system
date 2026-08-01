import { useState } from "react";
import { identidadApi } from "../../../api";

const EMPTY = {
  email: "",
  first_name: "",
  last_name: "",
  cedula: "",
  placa: "",
  rango_policial: "",
  role: "AGENTE_OPERATIVO",
  password: "",
};

export default function UsuarioFormulario({ roles, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? {
          email: initial.email,
          first_name: initial.first_name,
          last_name: initial.last_name,
          placa: initial.placa || "",
          rango_policial: initial.rango_policial || "",
          role: initial.role,
        }
      : EMPTY
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await identidadApi.updateUsuario(initial.id, form);
      } else {
        await identidadApi.createUsuario(form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{isEdit ? "Editar usuario" : "Registrar funcionario"}</h3>
        {error && <p className="mod-error">{error}</p>}
        <div className="form-grid">
          <label>
            Nombres
            <input
              required
              value={form.first_name}
              onChange={(e) => setField("first_name", e.target.value)}
            />
          </label>
          <label>
            Apellidos
            <input
              required
              value={form.last_name}
              onChange={(e) => setField("last_name", e.target.value)}
            />
          </label>
          <label className="full">
            Correo
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              disabled={isEdit}
            />
          </label>
          {!isEdit && (
            <label>
              Cédula
              <input
                required
                value={form.cedula}
                onChange={(e) => setField("cedula", e.target.value)}
              />
            </label>
          )}
          <label>
            Placa / Credencial
            <input
              value={form.placa}
              onChange={(e) => setField("placa", e.target.value)}
            />
          </label>
          <label>
            Rango policial
            <input
              value={form.rango_policial}
              onChange={(e) => setField("rango_policial", e.target.value)}
              placeholder="Ej. Cabo, Teniente..."
            />
          </label>
          <label>
            Rol en el sistema
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              required
            >
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {!isEdit && (
            <label className="full">
              Contraseña inicial
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
              />
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
