import { useEffect, useRef, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../../shared/components/PaginationBar.css";
import "../DirectorZona.css";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

const PRIORIDADES = [
  { value: "", label: "Todas las prioridades" },
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
];

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "EN_REVISION", label: "Pendiente" },
  { value: "OBSERVADO", label: "Rechazado" },
];

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
  const [qDebounced, setQDebounced] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPartes, setLoadingPartes] = useState(false);
  const [error, setError] = useState("");
  const [zona, setZona] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      setQDebounced((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  async function loadCasos() {
    const data = await directorApi.casosCriticos();
    setCasos(data.casos || []);
    setZona(data.jurisdiccion?.nombre || zona);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        await loadCasos();
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== "partes") return undefined;
    const reqId = ++reqIdRef.current;
    let cancelled = false;

    async function loadPartes() {
      setLoadingPartes(true);
      setError("");
      try {
        const data = await directorApi.partesAuditoria({
          q: qDebounced,
          prioridad,
          estado,
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled || reqId !== reqIdRef.current) return;

        const countVal = data.count ?? data.total ?? 0;
        const size = data.page_size ?? PAGE_SIZE;
        const pages =
          data.total_pages ?? Math.max(1, Math.ceil(countVal / size) || 1);
        setPartes(data.partes || data.results || []);
        setCount(countVal);
        setTotalPages(pages);
        if (data.page && data.page !== page) setPage(data.page);
        if (data.jurisdiccion?.nombre) setZona(data.jurisdiccion.nombre);
      } catch (err) {
        if (!cancelled && reqId === reqIdRef.current) setError(err.message);
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setLoadingPartes(false);
      }
    }

    loadPartes();
    return () => {
      cancelled = true;
    };
  }, [tab, qDebounced, prioridad, estado, page]);

  async function openCaso(id) {
    try {
      setDetalle(await directorApi.casoCritico(id));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function verPdf(row) {
    const id = row.parte_id;
    if (!id) return;
    const win = window.open("about:blank", "_blank");
    setPdfBusyId(id);
    setError("");
    try {
      const blob = await directorApi.fetchPartePdf(id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (win) {
        win.location.href = url;
      } else {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfTitle(row.numero_caso || row.titulo || `Parte #${id}`);
        setPdfUrl(url);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) {
      if (win && !win.closed) win.close();
      setError(err.message);
    } finally {
      setPdfBusyId(null);
    }
  }

  async function descargarPdf(row) {
    const id = row.parte_id;
    if (!id) return;
    setPdfBusyId(id);
    setError("");
    try {
      const blob = await directorApi.fetchPartePdf(id, { download: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.numero_caso || `parte-${id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfBusyId(null);
    }
  }

  function closePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfTitle("");
  }

  async function refreshAll() {
    setError("");
    setLoadingPartes(true);
    try {
      await loadCasos();
      const data = await directorApi.partesAuditoria({
        q: qDebounced,
        prioridad,
        estado,
        page,
        page_size: PAGE_SIZE,
      });
      const countVal = data.count ?? data.total ?? 0;
      const size = data.page_size ?? PAGE_SIZE;
      setPartes(data.partes || data.results || []);
      setCount(countVal);
      setTotalPages(data.total_pages ?? Math.max(1, Math.ceil(countVal / size) || 1));
      if (data.jurisdiccion?.nombre) setZona(data.jurisdiccion.nombre);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPartes(false);
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
        <button type="button" className="btn-ghost" onClick={refreshAll}>
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
          <div
            className="filters-bar"
            style={{
              padding: 0,
              border: 0,
              boxShadow: "none",
              background: "transparent",
              gridTemplateColumns: "minmax(0, 1.5fr) repeat(2, minmax(140px, 0.7fr))",
            }}
          >
            <label>
              Buscar
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Número, delito, agente, sector…"
              />
            </label>
            <label>
              Prioridad
              <select
                value={prioridad}
                onChange={(e) => {
                  setPrioridad(e.target.value);
                  setPage(1);
                }}
              >
                {PRIORIDADES.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setPage(1);
                }}
              >
                {ESTADOS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loadingPartes && (
            <p className="mod-muted" style={{ marginTop: "0.75rem" }}>
              Actualizando…
            </p>
          )}

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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {partes.map((p) => (
                <tr key={`${p.parte_id}-${p.numero_caso}`}>
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
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn-icon-action"
                        title="Ver PDF en el navegador"
                        disabled={pdfBusyId === p.parte_id}
                        onClick={() => verPdf(p)}
                      >
                        <MaterialIcon name="visibility" />
                        Ver
                      </button>
                      <button
                        type="button"
                        className="btn-icon-action"
                        title="Descargar PDF"
                        disabled={pdfBusyId === p.parte_id}
                        onClick={() => descargarPdf(p)}
                      >
                        <MaterialIcon name="download" />
                        Descargar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!partes.length && (
                <tr>
                  <td colSpan={8} className="mod-muted">
                    Sin partes en ClickHouse para su zona con esos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            count={count}
            pageSize={PAGE_SIZE}
            disabled={loadingPartes}
            onPageChange={setPage}
          />
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

      {pdfUrl && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 18, 32, 0.55)",
            zIndex: 80,
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
          }}
          onClick={closePdf}
        >
          <div
            className="panel-card"
            style={{
              width: "min(960px, 100%)",
              height: "min(88vh, 900px)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              gap: "0.65rem",
              margin: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Vista previa PDF · {pdfTitle}</strong>
              <button type="button" className="btn-ghost" onClick={closePdf}>
                <MaterialIcon name="close" />
                Cerrar
              </button>
            </div>
            <iframe
              title="Vista previa PDF del parte"
              src={pdfUrl}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: 10 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
