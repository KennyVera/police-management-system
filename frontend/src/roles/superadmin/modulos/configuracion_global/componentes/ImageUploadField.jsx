import { useRef, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { API_URL } from "../../../../../auth/api";
import { configApi } from "../api";

function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  return `${API_URL}${url}`;
}

export default function ImageUploadField({ label, campo, value, onUploaded, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    onError?.("");
    try {
      const data = await configApi.uploadBranding(campo, file);
      onUploaded(data.url);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="full cfg-upload">
      {label}
      <div className="cfg-upload-box">
        <div className="cfg-upload-preview">
          {value ? (
            <img src={resolveUrl(value)} alt={label} />
          ) : (
            <span className="mod-muted">Sin imagen</span>
          )}
        </div>
        <div className="cfg-upload-actions">
          <button
            type="button"
            className="btn-accent"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <MaterialIcon name="upload" />
            {busy ? "Subiendo…" : "Subir imagen"}
          </button>
          {value && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => onUploaded("")}
            >
              Quitar
            </button>
          )}
          <p className="mod-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            PNG, JPG, WEBP o SVG · máx. 3 MB · se guarda en MinIO
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico"
          hidden
          onChange={onPick}
        />
      </div>
    </label>
  );
}
