import { useEffect, useRef, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../../api";

function fmtSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFecha(dt) {
  if (!dt) return { fecha: "—", hora: "" };
  try {
    const d = new Date(dt);
    return {
      fecha: d.toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      hora: d.toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    return { fecha: String(dt), hora: "" };
  }
}

function isImageRow(row) {
  const ct = (row.content_type || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  const name = (row.nombre_archivo || "").toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

function vinculoInfo(row) {
  if (row.vinculado_a) return row.vinculado_a;
  if (row.parte_numero || row.parte) {
    return {
      tipo: "PARTE",
      label: "Parte",
      referencia: row.parte_numero || `Parte #${row.parte}`,
      detalle: row.parte_titulo || null,
    };
  }
  if (row.novedad || row.novedad_resumen) {
    return {
      tipo: "NOVEDAD",
      label: "Novedad",
      referencia: row.novedad_resumen || `Novedad #${row.novedad}`,
      detalle: null,
    };
  }
  return {
    tipo: "RAPIDA",
    label: "Captura rápida",
    referencia: "Sin parte vinculado",
    detalle: null,
  };
}

function ThumbCell({ row }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const urlRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    if (!isImageRow(row)) return undefined;

    (async () => {
      try {
        const blob = await agenteApi.fetchMultimediaBlob(row.id);
        if (cancelled) return;
        const objUrl = URL.createObjectURL(blob);
        urlRef.current = objUrl;
        setSrc(objUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = "";
      }
    };
  }, [row.id]);

  if (!isImageRow(row)) {
    return (
      <span className="mm-file-icon" title="Archivo">
        <MaterialIcon name="draft" />
      </span>
    );
  }

  if (failed) {
    return (
      <span className="mm-file-icon is-error" title="No se pudo cargar">
        <MaterialIcon name="broken_image" />
      </span>
    );
  }

  if (!src) {
    return <span className="mm-thumb-skeleton" aria-hidden />;
  }

  return <img className="mm-thumb" src={src} alt={row.nombre_archivo || "Evidencia"} />;
}

export default function MultimediaLista({ items }) {
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewUrlRef = useRef("");

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
  }

  async function openPreview(row) {
    setPreview(row);
    setPreviewError("");
    setPreviewLoading(true);
    revokePreview();
    try {
      const blob = await agenteApi.fetchMultimediaBlob(row.id);
      const objUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objUrl;
      setPreviewUrl(objUrl);
    } catch (err) {
      setPreviewError(err.message || "No se pudo abrir el archivo");
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(false);
    revokePreview();
  }

  useEffect(() => () => revokePreview(), []);

  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">
          No hay evidencias subidas. Usa “Subir evidencia” para enviar fotos a MinIO.
        </p>
      </div>
    );
  }

  const previewIsImage = preview ? isImageRow(preview) : false;
  const previewVinculo = preview ? vinculoInfo(preview) : null;
  const previewFecha = preview ? fmtFecha(preview.creado_en) : null;

  return (
    <>
      <div className="panel-card" style={{ overflowX: "auto" }}>
        <table className="data-table mm-table">
          <thead>
            <tr>
              <th>Vista</th>
              <th>Archivo</th>
              <th>Vinculado a</th>
              <th>Fecha de subida</th>
              <th>Tamaño</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const v = vinculoInfo(row);
              const { fecha, hora } = fmtFecha(row.creado_en);
              return (
                <tr key={row.id}>
                  <td>
                    <ThumbCell row={row} />
                  </td>
                  <td>
                    <div className="mm-file-name">{row.nombre_archivo}</div>
                    {row.descripcion ? (
                      <div className="mm-file-desc">{row.descripcion}</div>
                    ) : null}
                  </td>
                  <td>
                    <div className={`mm-vinculo mm-vinculo--${(v.tipo || "").toLowerCase()}`}>
                      <span className="mm-vinculo-label">{v.label}</span>
                      <strong className="mm-vinculo-ref">{v.referencia}</strong>
                      {v.detalle ? (
                        <span className="mm-vinculo-detalle">{v.detalle}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="mm-fecha">
                      <strong>{fecha}</strong>
                      {hora ? <span>{hora}</span> : null}
                    </div>
                  </td>
                  <td>{fmtSize(row.tamanio_bytes)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="mm-btn-abrir"
                        onClick={() => openPreview(row)}
                      >
                        <MaterialIcon name="visibility" />
                        Abrir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {preview && (
        <div
          className="modal-backdrop mm-preview-backdrop"
          role="presentation"
          onClick={closePreview}
        >
          <div
            className="mm-preview-card"
            role="dialog"
            aria-modal="true"
            aria-label={preview.nombre_archivo || "Vista previa"}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mm-preview-head">
              <div>
                <h3>{preview.nombre_archivo || "Evidencia"}</h3>
                {preview.descripcion ? (
                  <p className="mod-muted">{preview.descripcion}</p>
                ) : null}
                <div className="mm-preview-meta">
                  <span>
                    <MaterialIcon name="folder_open" />
                    {previewVinculo.label}: {previewVinculo.referencia}
                  </span>
                  <span>
                    <MaterialIcon name="schedule" />
                    Subida: {previewFecha.fecha}
                    {previewFecha.hora ? ` · ${previewFecha.hora}` : ""}
                  </span>
                  {preview.agente ? (
                    <span>
                      <MaterialIcon name="badge" />
                      {preview.agente}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="mm-preview-close"
                onClick={closePreview}
                aria-label="Cerrar"
              >
                <MaterialIcon name="close" />
              </button>
            </header>

            <div className="mm-preview-body">
              {previewLoading && <p className="mod-muted">Cargando...</p>}
              {!previewLoading && previewError && (
                <p className="mod-error">{previewError}</p>
              )}
              {!previewLoading && !previewError && previewUrl && previewIsImage && (
                <img src={previewUrl} alt={preview.nombre_archivo || "Evidencia"} />
              )}
              {!previewLoading && !previewError && previewUrl && !previewIsImage && (
                <div className="mm-preview-file">
                  <MaterialIcon name="draft" />
                  <p>Vista previa no disponible para este tipo de archivo.</p>
                  <a href={previewUrl} download={preview.nombre_archivo || "archivo"}>
                    Descargar
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
