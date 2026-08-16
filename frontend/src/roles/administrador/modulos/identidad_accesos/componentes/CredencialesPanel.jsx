import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { identidadApi } from "../../../api";

export default function CredencialesPanel({ usuarios, selectedUser, onSelect, onChanged }) {
  const user = selectedUser || usuarios[0] || null;
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  if (!user) {
    return <p className="mod-muted">No hay usuarios para gestionar credenciales.</p>;
  }

  async function resetPassword(e) {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      const res = await identidadApi.resetPassword(user.id, password);
      setMsg(res.detail);
      setPassword("");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggle2fa() {
    setMsg("");
    setError("");
    try {
      await identidadApi.toggle2fa(user.id, !user.two_factor_enabled);
      setMsg(
        !user.two_factor_enabled
          ? "2FA habilitado (flag registrado)."
          : "2FA deshabilitado."
      );
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel-card stack-form" style={{ display: "grid", gap: "1rem" }}>
      <label>
        Funcionario
        <select
          value={user.id}
          onChange={(e) =>
            onSelect(usuarios.find((u) => u.id === Number(e.target.value)))
          }
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name} {u.last_name} — {u.cedula || u.email}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p>
          2FA:{" "}
          <strong>{user.two_factor_enabled ? "Habilitado" : "Deshabilitado"}</strong>
        </p>
        <button type="button" className="btn-ghost" onClick={toggle2fa}>
          <MaterialIcon name="security" />
          {user.two_factor_enabled ? "Deshabilitar 2FA" : "Habilitar 2FA"}
        </button>
      </div>

      <form onSubmit={resetPassword} style={{ display: "grid", gap: "0.75rem" }}>
        <label>
          Nueva contraseña
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
        <button type="submit" className="btn-accent">
          <MaterialIcon name="lock_reset" />
          Restablecer contraseña
        </button>
      </form>

      {msg && <p style={{ color: "#1f7a45", margin: 0 }}>{msg}</p>}
      {error && <p className="mod-error">{error}</p>}
    </div>
  );
}
