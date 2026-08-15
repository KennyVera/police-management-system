import { useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  resolveMediaUrl,
  updateMeRequest,
  uploadAvatarRequest,
} from "../../auth/api";
import "../styles/ModuloPage.css";
import "./UserMenu.css";

function initials(user) {
  const a = (user?.first_name || "?").charAt(0);
  const b = (user?.last_name || "").charAt(0);
  return `${a}${b}`.toUpperCase();
}

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    telefono: user?.telefono || "",
  });
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentAvatar = preview || resolveMediaUrl(user?.avatar_url);

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("La foto no puede superar 3 MB.");
      return;
    }
    setError("");
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let nextUser = user;
      if (pendingFile) {
        const uploaded = await uploadAvatarRequest(pendingFile);
        nextUser = uploaded.user;
      }
      nextUser = await updateMeRequest({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
      });
      updateUser(nextUser);
      onClose();
    } catch (err) {
      setError(err.message || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <form
        className="modal-card profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Perfil</h3>
        <p className="hint">Actualiza tu información personal y foto de perfil.</p>

        <div className="avatar-edit">
          {currentAvatar ? (
            <img src={currentAvatar} alt="" className="avatar-preview" />
          ) : (
            <span className="avatar-preview">{initials(user)}</span>
          )}
          <div className="avatar-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => fileRef.current?.click()}
            >
              Cambiar foto
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFileChange}
            />
            <p className="hint">PNG, JPG o WEBP · máx. 3 MB</p>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Nombre
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
          </label>
          <label>
            Apellido
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
          </label>
          <label className="full">
            Correo
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label className="full">
            Teléfono
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="Opcional"
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
