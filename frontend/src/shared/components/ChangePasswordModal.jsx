import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { changePasswordRequest } from "../../auth/api";
import "../styles/ModuloPage.css";
import "./UserMenu.css";

export default function ChangePasswordModal({ onClose }) {
  const { applySession } = useAuth();
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.new_password.length < 8) {
      setError("La nueva clave debe tener al menos 8 caracteres.");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    setSaving(true);
    try {
      const data = await changePasswordRequest({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      applySession(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo cambiar la clave.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal-card change-password-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Cambio de clave</h3>
        <p className="hint">Ingresa tu clave actual y define una nueva.</p>

        <div className="stack-form" style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            Clave actual
            <input
              type="password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(e) =>
                setForm({ ...form, current_password: e.target.value })
              }
              required
            />
          </label>
          <label>
            Nueva clave
            <input
              type="password"
              autoComplete="new-password"
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              required
              minLength={8}
            />
          </label>
          <label>
            Confirmar nueva clave
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={(e) =>
                setForm({ ...form, confirm_password: e.target.value })
              }
              required
              minLength={8}
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando…" : "Actualizar clave"}
          </button>
        </div>
      </form>
    </div>
  );
}
