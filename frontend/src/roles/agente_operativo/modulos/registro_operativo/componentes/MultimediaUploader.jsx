import { useState } from "react";
import { agenteApi } from "../../../api";

export default function MultimediaUploader({ partes, novedades, onClose, onSaved }) {
  const [archivo, setArchivo] = useState(null);
  const [descripcion, setDescripcion] = useState("");
  const [vinculo, setVinculo] = useState("rapida");
  const [parteId, setParteId] = useState("");
  const [novedadId, setNovedadId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!archivo) {
      setError("Selecciona un archivo de imagen o evidencia.");
      return;
    }
    setSaving(true);
    setError("");
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("descripcion", descripcion);
    fd.append("origen", "RAPIDA");
    if (vinculo === "parte" && parteId) fd.append("parte", parteId);
    if (vinculo === "novedad" && novedadId) fd.append("novedad", novedadId);
    try {
      await agenteApi.uploadMultimedia(fd);
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
        <h3>Subir evidencia a MinIO</h3>
        <p className="mod-muted" style={{ margin: 0 }}>
          El archivo se guarda en el bucket institucional de evidencias.
        </p>
        {error && <p className="mod-error">{error}</p>}

        <div className="stack-form" style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            Archivo
            <input
              type="file"
              accept="image/*,video/*,.pdf"
              required
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Indicio en la vía, rostro del sospechoso..."
            />
          </label>
          <label>
            Vincular a
            <select value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
              <option value="rapida">Captura rápida (sin vínculo)</option>
              <option value="parte">Parte de aprehensión</option>
              <option value="novedad">Novedad / incidente</option>
            </select>
          </label>
          {vinculo === "parte" && (
            <label>
              Parte
              <select
                required
                value={parteId}
                onChange={(e) => setParteId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {partes.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.detenido_nombres} {p.detenido_apellidos}
                  </option>
                ))}
              </select>
            </label>
          )}
          {vinculo === "novedad" && (
            <label>
              Novedad
              <select
                required
                value={novedadId}
                onChange={(e) => setNovedadId(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {novedades.map((n) => (
                  <option key={n.id} value={n.id}>
                    #{n.id} — {n.tipo_label} @ {n.lugar}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Subiendo..." : "Subir a MinIO"}
          </button>
        </div>
      </form>
    </div>
  );
}
