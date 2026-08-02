import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../DirectorZona.css";

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-EC");
  } catch {
    return iso;
  }
}

export default function SupervisionPage() {
  const [tab, setTab] = useState("partes");
  const [partes, setPartes] = useState([]);
  const [casos, setCasos] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zona, setZona] = useState("");

  async function loadPartes(search = q) {
    const data = await directorApi.partesAuditoria({ q: search, limit: 80 });
    setPartes(data.partes || []);
    setZona(data.jurisdiccion?.nombre || "");
  }

  async function loadCasos() {
    const data = await directorApi.casosCriticos();
    setCasos(data.casos || []);
    setZona(data.jurisdiccion?.nombre || zona);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadPartes(), loadCasos()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCaso(id) {
    try {
      setDetalle(await directorApi.casoCritico(id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mod-page dir-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Supervisión de Casos Relevantes</p>
          <h2>Auditoría operativa — {zona || "su zona"}</h2>
          <p className="mod-desc">
            Lectura de partes policiales e investigaciones graves. Sin edición: solo supervisión.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      <div className="dir-tabs">
        {[
          { id: "partes", label: "Partes policiales", icon: "description" },
          { id: "criticos", label: "Casos críticos", icon: "priority_high" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <MaterialIcon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando supervisión…</p>
      ) : tab === "partes" ? (
        <section className="panel-card">
          <div className="dir-filters" style={{ padding: 0, border: 0, boxShadow: "none" }}>
            <label className="dir-grow">
              Buscar
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Número, delito, agente…"
              />
            </label>
            <button
              type="button"
              className="btn-accent"
              onClick={async () => {
                try {
                  await loadPartes(q);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Filtrar
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Delito</th>
                <th>Sector</th>
                <th>Prioridad</th>
                <th>Agente</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {partes.map((p) => (
                <tr key={p.parte_id}>
                  <td>
                    <strong>{p.numero_caso || `#${p.parte_id}`}</strong>
                    <div className="mod-muted">{p.titulo}</div>
                  </td>
                  <td>{p.tipo_delito}</td>
                  <td>{p.sector_zona}</td>
                  <td>{p.prioridad}</td>
                  <td>{p.agente}</td>
                  <td>{formatWhen(p.fecha_hora)}</td>
                  <td>{p.estado_revision}</td>
                </tr>
              ))}
              {!partes.length && (
                <tr>
                  <td colSpan={7} className="mod-muted">
                    Sin partes en ClickHouse para su zona.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ) : (
        <div className="dir-split">
          <section className="panel-card">
            <h3>Investigaciones Alta / Crítica</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Detective</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {casos.map((c) => (
                  <tr key={c.id} className={detalle?.id === c.id ? "is-selected" : ""}>
                    <td>{c.codigo_caso || c.numero_expediente || c.id}</td>
                    <td>
                      {c.titulo}
                      <div className="mod-muted">{c.tipo_delito}</div>
                    </td>
                    <td>
                      <span className={`dir-badge ${c.prioridad}`}>{c.prioridad_label}</span>
                    </td>
                    <td>{c.estado_label}</td>
                    <td>{c.detective}</td>
                    <td>
                      <button type="button" className="btn-ghost" onClick={() => openCaso(c.id)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
                {!casos.length && (
                  <tr>
                    <td colSpan={6} className="mod-muted">
                      No hay casos críticos de detectives de su zona.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <aside className="panel-card">
            <h3>Reporte del caso</h3>
            {!detalle ? (
              <p className="mod-muted">Seleccione un caso para leer bitácora e informe.</p>
            ) : (
              <div className="dir-caso-detail">
                <h4>{detalle.titulo}</h4>
                <p className="mod-muted">
                  {detalle.codigo_caso} · {detalle.prioridad_label} · {detalle.estado_label}
                </p>
                <p>{detalle.descripcion || "Sin descripción."}</p>
                {detalle.informe && (
                  <div className="dir-informe">
                    <strong>Informe investigativo</strong>
                    <p>{detalle.informe.conclusiones || "Sin conclusiones."}</p>
                    <small>
                      {detalle.informe.elaborado_por} · {formatWhen(detalle.informe.creado_en)}
                    </small>
                  </div>
                )}
                <strong>Bitácora reciente</strong>
                <ul className="dir-feed">
                  {(detalle.bitacora || []).map((b) => (
                    <li key={b.id}>
                      <strong>{b.tipo_label}</strong>
                      <small>{formatWhen(b.fecha_hora)}</small>
                      <p>{b.relato}</p>
                    </li>
                  ))}
                  {!detalle.bitacora?.length && <li className="mod-muted">Sin entradas.</li>}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
