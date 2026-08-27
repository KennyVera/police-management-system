import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { identidadApi } from "../../../api";
import {
  ROLES_ASIGNABLES,
  rangosDeRol,
} from "../rangosPoliciales";

const EMAIL_DOMAIN = "sgp.gob";

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

function slugEmailPart(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function buildEmailFromName(firstName, lastName) {
  const first = slugEmailPart(firstName).split(".")[0] || "";
  const last = slugEmailPart(lastName).split(".")[0] || "";
  if (!first && !last) return "";
  if (!first) return `${last}@${EMAIL_DOMAIN}`;
  if (!last) return `${first}@${EMAIL_DOMAIN}`;
  return `${first}.${last}@${EMAIL_DOMAIN}`;
}

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
  /** Si el admin edita el correo a mano, dejamos de regenerarlo. */
  const [emailManual, setEmailManual] = useState(isEdit);
  const roleOptions = ROLES_ASIGNABLES;
  const rangos = rangosDeRol(form.role);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onRoleChange(role) {
    const nextRangos = rangosDeRol(role);
    setForm((prev) => ({
      ...prev,
      role,
      rango_policial: nextRangos.includes(prev.rango_policial)
        ? prev.rango_policial
        : nextRangos[0] || "",
    }));
  }

  function onNameChange(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (!isEdit && !emailManual) {
        next.email = buildEmailFromName(
          key === "first_name" ? value : next.first_name,
          key === "last_name" ? value : next.last_name
        );
      }
      return next;
    });
  }

  function onEmailChange(value) {
    setEmailManual(true);
    setField("email", value);
  }

  function usarCorreoSugerido() {
    setEmailManual(false);
    setField("email", buildEmailFromName(form.first_name, form.last_name));
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
    <div className="modal-backdrop">
      <form
        className="modal-card"
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
              onChange={(e) => onNameChange("first_name", e.target.value)}
            />
          </label>
          <label>
            Apellidos
            <input
              required
              value={form.last_name}
              onChange={(e) => onNameChange("last_name", e.target.value)}
            />
          </label>
          <label className="full">
            Correo
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={isEdit}
              autoComplete="off"
              name="funcionario_email"
              placeholder={`ej. nombre.apellido@${EMAIL_DOMAIN}`}
            />
            {!isEdit && (
              <span className="mod-muted" style={{ display: "block", marginTop: 4 }}>
                {emailManual
                  ? "Editado manualmente. "
                  : "Se genera con el nombre y apellido. "}
                {emailManual && (
                  <button
                    type="button"
                    className="notif-link"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "inherit",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                    onClick={usarCorreoSugerido}
                  >
                    Usar sugerido
                  </button>
                )}
              </span>
            )}
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
            Rol en el sistema
            <select
              value={form.role}
              onChange={(e) => onRoleChange(e.target.value)}
              required
              autoComplete="off"
            >
              {roleOptions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rango policial
            <select
              required
              value={form.rango_policial}
              onChange={(e) => setField("rango_policial", e.target.value)}
              autoComplete="off"
              name="rango_policial"
            >
              <option value="">Seleccione un rango…</option>
              {rangos.map((rango) => (
                <option key={rango} value={rango}>
                  {rango}
                </option>
              ))}
              {form.rango_policial && !rangos.includes(form.rango_policial) && (
                <option value={form.rango_policial}>{form.rango_policial}</option>
              )}
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
