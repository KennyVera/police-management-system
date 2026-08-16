import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
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
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function generarCedulaPlaca() {
    setGenerating(true);
    setError("");
    try {
      const data = await identidadApi.generarIdentificadores();
      setForm((prev) => ({
        ...prev,
        cedula: data.cedula || prev.cedula,
        placa: data.placa || prev.placa,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
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
              autoComplete="off"
              name="funcionario_email"
            />
          </label>
          {!isEdit && (
            <>
              <label>
                Cédula
                <input
                  required
                  value={form.cedula}
                  onChange={(e) => setField("cedula", e.target.value)}
                  autoComplete="off"
                  name="cedula"
                />
              </label>
              <label>
                Placa / Credencial
                <input
                  required
                  value={form.placa}
                  onChange={(e) => setField("placa", e.target.value)}
                  autoComplete="off"
                  name="placa"
                />
              </label>
              <div className="full id-gen-row">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={generating}
                  onClick={generarCedulaPlaca}
                >
                  <MaterialIcon name="auto_awesome" />
                  {generating ? "Generando…" : "Generar cédula y placa"}
                </button>
                <span className="mod-muted">
                  Únicas: no se repiten con las ya registradas.
                </span>
              </div>
            </>
          )}
          {isEdit && (
            <label>
              Placa / Credencial
              <input
                value={form.placa}
                onChange={(e) => setField("placa", e.target.value)}
                autoComplete="off"
                name="placa"
              />
            </label>
          )}
          <label>
            Rango policial
            <input
              value={form.rango_policial}
              onChange={(e) => setField("rango_policial", e.target.value)}
              placeholder="Ej. Cabo, Teniente..."
              autoComplete="off"
              name="rango_policial"
            />
          </label>
          <label>
            Rol en el sistema
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              required
              autoComplete="off"
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
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="new-password"
                  name="password_inicial"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} />
                </button>
              </div>
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
