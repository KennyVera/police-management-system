import { useEffect, useMemo, useRef, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "./ExpedienteEvidencias.css";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-EC");
  } catch {
    return iso;
  }
}

function extOf(ev) {
  const name = (ev.nombre_archivo || ev.object_key || "").toLowerCase();
  const m = name.match(/\.([a-z0-9]+)(?:\?|$)/);
  return m ? m[1] : "";
}

function mediaKind(ev) {
  const ct = (ev.content_type || "").toLowerCase();
  const ext = extOf(ev);
  if (ct.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "image";
  }
  if (ct.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"].includes(ext)) {
    return "audio";
  }
  if (ct.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv", "m4v"].includes(ext)) {
    return "video";
  }
  if (ct.includes("pdf") || ext === "pdf") return "pdf";
  return "file";
}

export default function ExpedienteEvidencias({
  expedienteId,
  locked,
  onNotify,
}) {
  const [items, setItems] = useState([]);
  const [estados, setEstados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [draftEstado, setDraftEstado] = useState({});
  const [draftMotivo, setDraftMotivo] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef(null);
  const objectUrlRef = useRef("");

  const digitales = useMemo(
    () => items.filter((e) => e.tipo === "DIGITAL" || e.object_key),
    [items]
  );

  function revokePreviewUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
    setPreviewUrl("");
  }

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [list, meta] = await Promise.all([
        detectiveApi.listEvidencias({ expediente: expedienteId }),
        detectiveApi.evidenciasMeta(),
      ]);
      setItems(list);
      setEstados(meta.estados_custodia || []);
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expedienteId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (locked || !file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("expediente", String(expedienteId));
      fd.append("archivo", file);
      fd.append("descripcion", file.name);
      await detectiveApi.uploadDigital(fd);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onNotify?.("Evidencia subida. Hash SHA-256 calculado.");
      await load();
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(ev) {
    if (locked) return;
    if (!window.confirm(`¿Eliminar la evidencia «${ev.nombre_archivo || ev.codigo}»?`)) {
      return;
    }
    setBusy(true);
    try {
      await detectiveApi.deleteEvidencia(ev.id);
      if (preview?.id === ev.id) {
        setPreview(null);
        revokePreviewUrl();
      }
      onNotify?.("Evidencia eliminada.");
      await load();
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleCambiarEstado(ev) {
    if (locked) return;
    const estado = draftEstado[ev.id];
    if (!estado) {
      onNotify?.("Selecciona un nuevo estado.", true);
      return;
    }
    setBusy(true);
    try {
      await detectiveApi.registrarCustodia(ev.id, {
        estado_custodia: estado,
        motivo: draftMotivo[ev.id] || "",
      });
      setDraftEstado((d) => ({ ...d, [ev.id]: "" }));
      setDraftMotivo((d) => ({ ...d, [ev.id]: "" }));
      onNotify?.("Estado de custodia actualizado.");
      await load();
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(ev) {
    if (!ev.object_key && !ev.url) {
      onNotify?.("No hay archivo disponible.", true);
      return;
    }
    setPreview(ev);
    setPreviewLoading(true);
    revokePreviewUrl();
    try {
      const blob = await detectiveApi.fetchArchivoBlob(ev.id, false);
      const objUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objUrl;
      setPreviewUrl(objUrl);
    } catch (err) {
      setPreview(null);
      onNotify?.(err.message, true);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadFile(ev) {
    try {
      const blob = await detectiveApi.fetchArchivoBlob(ev.id, true);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = ev.nombre_archivo || `evidencia-${ev.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch (err) {
      onNotify?.(err.message, true);
    }
  }

  function closePreview() {
    setPreview(null);
    revokePreviewUrl();
  }

  const previewKind = preview ? mediaKind(preview) : null;

  return (
    <div className="ev-layout">
      <section className="ev-col-list">
        <h3 className="ev-section-title">
          <MaterialIcon name="fingerprint" />
          Cadena de custodia digital
        </h3>

        {loading ? (
          <p className="mod-muted">Cargando evidencias...</p>
        ) : !digitales.length ? (
          <div className="ev-empty">
            Aún no hay evidencias multimedia en este expediente.
          </div>
        ) : (
          <div className="ev-cards">
            {digitales.map((ev) => {
              const kind = mediaKind(ev);
              const hasFile = Boolean(ev.object_key);
              return (
                <article key={ev.id} className="ev-card">
                  <div className="ev-card-top">
                    <div>
                      <strong className="ev-file-name">
                        {ev.nombre_archivo || ev.codigo}
                      </strong>
                      <div className="ev-path">{ev.path_uri || "Sin ruta MinIO"}</div>
                    </div>
                    <span className="ev-badge-ok">
                      {ev.estado_custodia_label || "En custodia"}
                    </span>
                  </div>

                  <div className="ev-hash">
                    <span># SHA-256</span>
                    <code>{ev.sha256 || "No calculado (evidencia previa)"}</code>
                  </div>

                  <div className="ev-meta">
                    <span>{ev.tamanio_mb ?? 0} MB</span>
                    <span>{ev.categoria_media || "Multimedia"}</span>
                    <span>{formatWhen(ev.creado_en)}</span>
                  </div>

                  <div className="ev-actions">
                    {hasFile ? (
                      <button type="button" className="btn-ghost" onClick={() => downloadFile(ev)}>
                        <MaterialIcon name="download" />
                        Descargar
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost" disabled>
                        Sin archivo
                      </button>
                    )}

                    {hasFile && (kind === "image" || kind === "pdf") && (
                      <button type="button" className="btn-ghost" onClick={() => openPreview(ev)}>
                        <MaterialIcon name="visibility" />
                        Ver
                      </button>
                    )}

                    {hasFile && (kind === "audio" || kind === "video") && (
                      <button type="button" className="btn-ghost" onClick={() => openPreview(ev)}>
                        <MaterialIcon name="play_arrow" />
                        Reproducir
                      </button>
                    )}

                    {hasFile && kind === "file" && (
                      <button type="button" className="btn-ghost" onClick={() => openPreview(ev)}>
                        <MaterialIcon name="open_in_new" />
                        Abrir
                      </button>
                    )}

                    {!locked && (
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => handleDelete(ev)}
                      >
                        <MaterialIcon name="delete" />
                        Eliminar
                      </button>
                    )}
                  </div>

                  {!locked && (
                    <div className="ev-status-row">
                      <label>
                        Nuevo estado
                        <select
                          value={draftEstado[ev.id] || ""}
                          onChange={(e) =>
                            setDraftEstado((d) => ({ ...d, [ev.id]: e.target.value }))
                          }
                        >
                          <option value="">Seleccionar...</option>
                          {estados.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Motivo (opcional)
                        <input
                          placeholder="Ej. Enviada a laboratorio"
                          value={draftMotivo[ev.id] || ""}
                          onChange={(e) =>
                            setDraftMotivo((d) => ({ ...d, [ev.id]: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={busy}
                        onClick={() => handleCambiarEstado(ev)}
                      >
                        <MaterialIcon name="verified_user" />
                        Cambiar
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="ev-col-upload">
        <form className="ev-upload-card" onSubmit={handleUpload}>
          <h3 className="ev-section-title">
            <MaterialIcon name="upload" />
            Cargar evidencia
          </h3>
          <p className="ev-upload-label">Archivo multimedia</p>
          <div className="ev-drop">
            <button
              type="button"
              className="btn-accent"
              disabled={locked || busy}
              onClick={() => inputRef.current?.click()}
            >
              <MaterialIcon name="attach_file" />
              Seleccionar archivo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,audio/*,video/*,.pdf,.mp3,.wav,.ogg,.m4a,.mp4,.webm"
              hidden
              disabled={locked || busy}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="mod-muted">
              {file ? file.name : "Ningún archivo seleccionado"}
            </span>
          </div>
          <p className="ev-hint">
            Al subir se calcula automáticamente el hash SHA-256 para garantizar la integridad.
          </p>
          <button
            type="submit"
            className="btn-accent ev-upload-submit"
            disabled={locked || busy || !file}
          >
            <MaterialIcon name="cloud_upload" />
            Subir evidencia
          </button>
        </form>
      </aside>

      {preview && (
        <div className="ev-preview-backdrop" onClick={closePreview}>
          <div className="ev-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ev-preview-head">
              <div>
                <strong>{preview.nombre_archivo || preview.codigo}</strong>
                <p className="mod-muted" style={{ margin: "0.2rem 0 0" }}>
                  {preview.categoria_media} · {preview.tamanio_mb ?? 0} MB
                </p>
              </div>
              <div className="ev-preview-head-actions">
                <button type="button" className="btn-ghost" onClick={() => downloadFile(preview)}>
                  <MaterialIcon name="download" />
                  Descargar
                </button>
                <button type="button" className="btn-ghost" onClick={closePreview}>
                  <MaterialIcon name="close" />
                  Cerrar
                </button>
              </div>
            </div>

            <div className="ev-preview-body">
              {previewLoading && <p className="mod-muted">Cargando archivo...</p>}
              {!previewLoading && previewUrl && previewKind === "image" && (
                <img src={previewUrl} alt={preview.nombre_archivo || "Evidencia"} />
              )}
              {!previewLoading && previewUrl && previewKind === "audio" && (
                <div className="ev-audio-box">
                  <MaterialIcon name="audio_file" />
                  <p>Reproduciendo audio</p>
                  <audio controls autoPlay src={previewUrl}>
                    Tu navegador no soporta audio.
                  </audio>
                </div>
              )}
              {!previewLoading && previewUrl && previewKind === "video" && (
                <video controls autoPlay src={previewUrl}>
                  Tu navegador no soporta video.
                </video>
              )}
              {!previewLoading && previewUrl && previewKind === "pdf" && (
                <iframe title="PDF evidencia" src={previewUrl} />
              )}
              {!previewLoading && previewUrl && previewKind === "file" && (
                <div className="ev-audio-box">
                  <MaterialIcon name="draft" />
                  <p>Vista previa no disponible para este tipo. Descárgalo para abrirlo.</p>
                  <button type="button" className="btn-accent" onClick={() => downloadFile(preview)}>
                    Descargar archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
