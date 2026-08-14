import { useEffect, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { notifyBrandingUpdated } from "../../../../../shared/branding/BrandingContext";
import { configApi } from "../api";
import ConfigHeader from "./ConfigHeader";
import ImageUploadField from "./ImageUploadField";

export default function ConfigSectionForm({ seccion, title, desc, fields, extra }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setForm(await configApi.get(seccion));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [seccion]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      const body = {};
      fields.forEach((f) => {
        body[f.key] = form[f.key];
      });
      setForm(await configApi.save(seccion, body));
      setOk("Cambios guardados.");
      if (seccion === "identidad" || seccion === "apariencia") {
        notifyBrandingUpdated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mod-page">
      <ConfigHeader title={title} desc={desc}>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" /> Actualizar
        </button>
      </ConfigHeader>
      {error && <p className="mod-error">{error}</p>}
      {ok && (
        <p className="mod-muted" style={{ color: "#047857", fontWeight: 700 }}>
          {ok}
        </p>
      )}
      {loading || !form ? (
        <p className="mod-muted">Cargando…</p>
      ) : (
        <form className="cfg-form" onSubmit={save}>
          {extra?.(form)}
          {fields.map((f) => {
            if (f.type === "image") {
              return (
                <ImageUploadField
                  key={f.key}
                  label={f.label}
                  campo={f.key}
                  value={form[f.key]}
                  onUploaded={(url) => {
                    set(f.key, url);
                    setOk(url ? "Imagen subida a MinIO." : "Imagen quitada.");
                    notifyBrandingUpdated();
                  }}
                  onError={setError}
                />
              );
            }
            if (f.type === "checkbox") {
              return (
                <label key={f.key} className="cfg-check full">
                  <input
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              );
            }
            if (f.type === "color") {
              return (
                <label key={f.key}>
                  {f.label}
                  <div className="cfg-swatch">
                    <input
                      type="color"
                      value={form[f.key] || "#6d4aff"}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                    <input
                      type="text"
                      value={form[f.key] || ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </div>
                </label>
              );
            }
            if (f.type === "select") {
              return (
                <label key={f.key} className={f.full ? "full" : ""}>
                  {f.label}
                  <select
                    value={form[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  >
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (f.type === "textarea") {
              return (
                <label key={f.key} className="full">
                  {f.label}
                  <textarea
                    value={form[f.key] || ""}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </label>
              );
            }
            return (
              <label key={f.key} className={f.full ? "full" : ""}>
                {f.label}
                <input
                  type={f.type || "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            );
          })}
          <div className="cfg-actions">
            <button type="submit" className="btn-accent" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
