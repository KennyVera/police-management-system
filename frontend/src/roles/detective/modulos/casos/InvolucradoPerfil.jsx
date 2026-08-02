import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "./InvolucradoPerfil.css";

function initials(nombre = "") {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function formatDate(iso) {
  if (!iso) return "No registrado";
  try {
    return new Date(iso).toLocaleDateString("es-EC");
  } catch {
    return String(iso);
  }
}

function val(v) {
  if (v === null || v === undefined || v === "" || v === "NO_REGISTRADO" || v === "NO_ESPECIFICADO") {
    return "No registrado";
  }
  return v;
}

export default function InvolucradoPerfil({
  expedienteId,
  involucradoId,
  locked,
  onClose,
  onEdit,
  onDelete,
  onNotify,
  onOpenExpediente,
}) {
  const [data, setData] = useState(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let objUrl = "";
    async function load() {
      setLoading(true);
      setError("");
      setData(null);
      setFotoUrl("");
      try {
        const perfil = await detectiveApi.getInvolucradoPerfil(expedienteId, involucradoId);
        if (!alive) return;
        setData(perfil);
        if (perfil.involucrado?.tiene_foto) {
          try {
            const blob = await detectiveApi.fetchInvolucradoFotoBlob(
              expedienteId,
              involucradoId
            );
            if (!alive) return;
            objUrl = URL.createObjectURL(blob);
            setFotoUrl(objUrl);
          } catch {
            /* perfil sigue visible sin foto */
          }
        }
      } catch (err) {
        if (!alive) return;
        const msg = err?.message || "No se pudo cargar el perfil.";
        setError(msg);
        onNotify?.(msg, true);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId, involucradoId]);

  const inv = data?.involucrado;
  const stats = data?.stats || {};
  const historial = data?.historial || [];
  const nombre = inv ? `${inv.nombres || ""} ${inv.apellidos || ""}`.trim() : "";

  const infoLeft = inv
    ? [
        { icon: "badge", label: "Identificación", value: val(inv.cedula) },
        { icon: "public", label: "Nacionalidad", value: val(inv.nacionalidad) },
        { icon: "call", label: "Teléfono", value: val(inv.telefono) },
        { icon: "work", label: "Ocupación", value: val(inv.ocupacion) },
      ]
    : [];
  const infoRight = inv
    ? [
        {
          icon: "calendar_month",
          label: "Fecha de nacimiento",
          value: inv.fecha_nacimiento || "No registrado",
        },
        { icon: "person", label: "Género", value: val(inv.genero_label) },
        {
          icon: "favorite",
          label: "Estado civil",
          value: val(inv.estado_civil_label),
        },
        { icon: "location_on", label: "Dirección", value: val(inv.direccion) },
      ]
    : [];

  const modal = (
    <div className="ip-backdrop" onClick={onClose}>
      <div className="ip-shell" onClick={(e) => e.stopPropagation()}>
        <header className="ip-top">
          <div className="ip-top-title">
            <MaterialIcon name="person" />
            <h2>Perfil del involucrado</h2>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} title="Cerrar">
            <MaterialIcon name="close" />
          </button>
        </header>

        {loading && (
          <p className="mod-muted" style={{ padding: "2rem", textAlign: "center" }}>
            Cargando perfil...
          </p>
        )}

        {!loading && error && (
          <div className="ip-card" style={{ textAlign: "center" }}>
            <p className="mod-muted">{error}</p>
            <button type="button" className="btn-accent" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}

        {!loading && !error && inv && (
          <>
            <section className="ip-card ip-hero">
              <div className="ip-hero-main">
                <div className="ip-photo-wrap">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={nombre} className="ip-photo" />
                  ) : (
                    <div className="ip-photo ip-photo-fallback">{initials(nombre)}</div>
                  )}
                  {!locked && (
                    <button
                      type="button"
                      className="ip-photo-edit"
                      title="Editar perfil"
                      onClick={() => onEdit?.(inv)}
                    >
                      <MaterialIcon name="photo_camera" />
                    </button>
                  )}
                </div>
                <div className="ip-hero-info">
                  <h3>{nombre || "Sin nombre"}</h3>
                  <p className="ip-alias">
                    alias «{inv.alias?.trim() ? inv.alias : "No tiene"}»
                  </p>
                  <div className="ip-badges">
                    <span className="ip-badge gray">ID #{inv.id}</span>
                    {inv.cedula ? <span className="ip-badge purple">{inv.cedula}</span> : null}
                    {inv.edad != null ? (
                      <span className="ip-badge gray">{inv.edad} años</span>
                    ) : null}
                    <span className="ip-badge orange">
                      {stats.total ?? historial.length} caso(s)
                    </span>
                  </div>
                </div>
              </div>
              {!locked && (
                <button type="button" className="btn-ghost" onClick={() => onEdit?.(inv)}>
                  <MaterialIcon name="edit" />
                  Editar
                </button>
              )}
            </section>

            <section className="ip-stats">
              <div className="ip-stat">
                <strong>{stats.total ?? 0}</strong>
                <span>Total casos</span>
              </div>
              <div className="ip-stat">
                <strong className="pink">{stats.victima ?? 0}</strong>
                <span>Como víctima</span>
              </div>
              <div className="ip-stat">
                <strong className="orange">{stats.sospechoso ?? 0}</strong>
                <span>Como sospechoso</span>
              </div>
              <div className="ip-stat">
                <strong className="blue">{stats.testigo ?? 0}</strong>
                <span>Como testigo</span>
              </div>
            </section>

            <section className="ip-card">
              <div className="ip-info-grid">
                <div className="ip-info-col">
                  {infoLeft.map((row) => (
                    <div key={row.label} className="ip-info-row">
                      <MaterialIcon name={row.icon} />
                      <div>
                        <span className="ip-info-label">{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ip-info-col">
                  {infoRight.map((row) => (
                    <div key={row.label} className="ip-info-row">
                      <MaterialIcon name={row.icon} />
                      <div>
                        <span className="ip-info-label">{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {inv.observaciones ? (
                <div className="ip-notes">
                  <span className="ip-info-label">Declaración / notas</span>
                  <p>{inv.observaciones}</p>
                </div>
              ) : null}
            </section>

            <section className="ip-historial">
              <h4>
                <MaterialIcon name="folder_open" />
                Historial criminal y expedientes relacionados
              </h4>
              <div className="ip-hist-list">
                {historial.map((h) => (
                  <article key={`${h.expediente_id}-${h.involucrado_id}`} className="ip-hist-card">
                    <div className="ip-hist-top">
                      <span className="ip-hist-tipo">{h.tipo_label}</span>
                      <button
                        type="button"
                        className="ip-hist-link"
                        onClick={() => onOpenExpediente?.(h.expediente_id)}
                      >
                        {h.codigo_caso || h.numero_expediente}
                        <MaterialIcon name="open_in_new" />
                      </button>
                      <span className="ip-hist-estado">{h.estado_label}</span>
                      <span className="ip-hist-fecha">{formatDate(h.fecha)}</span>
                    </div>
                    <p className="ip-hist-delito">Delito: {h.delito || "—"}</p>
                    <p className="ip-hist-nota">{h.nota}</p>
                  </article>
                ))}
                {!historial.length && (
                  <p className="mod-muted">Sin historial relacionado en tus expedientes.</p>
                )}
              </div>
            </section>

            {!locked && (
              <div className="ip-footer-actions">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => onDelete?.(inv)}
                >
                  <MaterialIcon name="delete" />
                  Eliminar del expediente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
