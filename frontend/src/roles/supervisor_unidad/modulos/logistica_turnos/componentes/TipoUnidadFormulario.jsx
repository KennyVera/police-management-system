import { useState } from "react";
import { newCatalogId, resolveItemSrc, tipoParaRegistro } from "./catalogoFlota";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

export default function TipoUnidadFormulario({ item = null, onClose, onSaved }) {
  const editing = Boolean(item);
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [alias, setAlias] = useState(item?.alias || item?.descripcion || "");
  const [preview, setPreview] = useState(item ? resolveItemSrc(item) : "");
  const [srcData, setSrcData] = useState(item?.srcData || null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen.");
      return;
    }
    try {
      const data = await readFileAsDataUrl(file);
      setSrcData(data);
      setPreview(data);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Indica el nombre del tipo de unidad.");
      return;
    }
    setSaving(true);
    const next = {
      id: editing ? item.id : newCatalogId(),
      nombre: nombre.trim(),
      alias: alias.trim(),
      descripcion: alias.trim(),
      tipo: editing ? item.tipo || tipoParaRegistro(item) : "OTRO",
      imageKey: null,
      srcData: null,
      src: "",
    };

    if (srcData) {
      next.srcData = srcData;
      next.src = srcData;
    } else if (editing) {
      next.imageKey = item.imageKey || null;
      next.srcData = item.srcData || null;
      next.src = resolveItemSrc(item);
    }

    onSaved(next);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card flota-tipo-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>{editing ? "Editar tipo de unidad" : "Nuevo tipo de unidad"}</h3>
        {error && <p className="mod-error">{error}</p>}

        <div className="flota-tipo-preview">
          {preview ? (
            <img src={preview} alt="Vista previa" />
          ) : (
            <span className="mod-muted">Sin foto</span>
          )}
        </div>

        <div className="form-grid">
          <label className="full">
            Foto
            <input type="file" accept="image/*" onChange={onFotoChange} />
          </label>
          <label className="full">
            Nombre
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Automóvil"
            />
          </label>
          <label className="full">
            Alias
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Patrullero sedán"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-accent" disabled={saving}>
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Agregar"}
          </button>
        </div>
      </form>
    </div>
  );
}
