import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./CasosBandeja.css";
import ExpedienteDetalle from "./ExpedienteDetalle";

const emptyFilters = {
  q: "",
  estado: "",
  prioridad: "",
  fecha_desde: "",
  fecha_hasta: "",
  tipo_delito: "",
  unidad: "",
};

const PAGE_SIZE = 6;

function formatAsignacion(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CasosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mesaOpenedRef = useRef(null);
  const [meta, setMeta] = useState({
    estados: [],
    prioridades: [],
    tipos_involucrado: [],
    tipos_delito: [],
    origenes_documento: [],
    unidades: [],
  });
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const unidades = meta.unidades || [];

  async function load(activeFilters = filters, { restoreSelected = true } = {}) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (activeFilters.q?.trim()) params.q = activeFilters.q.trim();
      if (activeFilters.estado) params.estado = activeFilters.estado;
      if (activeFilters.prioridad) params.prioridad = activeFilters.prioridad;
      if (activeFilters.tipo_delito) params.tipo_delito = activeFilters.tipo_delito;
      if (activeFilters.unidad) params.unidad = activeFilters.unidad;
      if (activeFilters.fecha_desde) params.fecha_desde = activeFilters.fecha_desde;
      if (activeFilters.fecha_hasta) params.fecha_hasta = activeFilters.fecha_hasta;

      const [m, list] = await Promise.all([
        detectiveApi.casosMeta(),
        detectiveApi.listExpedientes(params),
      ]);
      setMeta(m);
      setItems(list);
      setPage(1);
      if (restoreSelected && selected) {
        const still = list.find((x) => x.id === selected.id);
        if (still) setSelected(await detectiveApi.getExpediente(still.id));
        else setSelected(null);
      }
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

  // Abrir Mesa de Trabajo desde el Dashboard (?mesa=<id>)
  useEffect(() => {
    const mesaId = searchParams.get("mesa");
    if (!mesaId || loading) return;
    if (mesaOpenedRef.current === mesaId) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const exp = await detectiveApi.getExpediente(mesaId);
        if (cancelled) return;
        mesaOpenedRef.current = mesaId;
        setHighlightId(exp.id);
        setSelected(exp);
        setOk(`Mesa de trabajo abierta: ${exp.numero_expediente || exp.titulo}`);
        const next = new URLSearchParams(searchParams);
        next.delete("mesa");
        setSearchParams(next, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "No se pudo abrir la mesa de trabajo.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  const rangeLabel = useMemo(() => {
    if (!items.length) return "Mostrando 0 casos";
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, items.length);
    return `Mostrando ${from} a ${to} de ${items.length} casos`;
  }, [items.length, page]);

  async function openExpediente(item) {
    if (!item) {
      setError("Selecciona un caso de la tabla para abrir el expediente.");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    setMenuOpenId(null);
    try {
      setHighlightId(item.id);
      setSelected(await detectiveApi.getExpediente(item.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleBuscar(e) {
    e.preventDefault();
    setFilters(draft);
    load(draft);
  }

  function handleLimpiar() {
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    load(emptyFilters);
  }

  function notify(msg, isError = false) {
    if (isError) setError(msg);
    else {
      setOk(msg);
      setError("");
    }
  }

  const highlighted = items.find((c) => c.id === highlightId) || null;

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Mis casos</p>
          <h2>Mis Casos Asignados</h2>
          <p className="mod-desc">
            Consulta y gestiona los casos que Fiscalía te ha asignado (demo con ejemplos del sistema).
          </p>
        </div>
        <button
          type="button"
          className="btn-accent"
          disabled={busy}
          onClick={() => openExpediente(highlighted || pageItems[0])}
        >
          <MaterialIcon name="folder_open" />
          Abrir Mesa de Trabajo
        </button>
      </header>

      <form className="panel-card casos-filters" onSubmit={handleBuscar}>
        <p className="casos-filters-head">
          <MaterialIcon name="filter_alt" />
          Criterios de búsqueda
        </p>
        <div className="casos-filters-grid">
          <label>
            Buscar por palabra clave
            <input
              placeholder="Ej: robo, agresión, placa, nombre..."
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            />
          </label>
          <label>
            Estado
            <select
              value={draft.estado}
              onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
            >
              <option value="">Todos los estados</option>
              {(meta.estados || []).map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridad
            <select
              value={draft.prioridad}
              onChange={(e) => setDraft({ ...draft, prioridad: e.target.value })}
            >
              <option value="">Todas las prioridades</option>
              {(meta.prioridades || []).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha desde
            <input
              type="date"
              value={draft.fecha_desde}
              onChange={(e) => setDraft({ ...draft, fecha_desde: e.target.value })}
            />
          </label>
          <label>
            Fecha hasta
            <input
              type="date"
              value={draft.fecha_hasta}
              onChange={(e) => setDraft({ ...draft, fecha_hasta: e.target.value })}
            />
          </label>
        </div>
        <div className="casos-filters-grid-2">
          <label>
            Tipo de delito
            <select
              value={draft.tipo_delito}
              onChange={(e) => setDraft({ ...draft, tipo_delito: e.target.value })}
            >
              <option value="">Todos los tipos</option>
              {(meta.tipos_delito || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unidad / Dependencia
            <select
              value={draft.unidad}
              onChange={(e) => setDraft({ ...draft, unidad: e.target.value })}
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <div className="casos-filters-actions">
            <button type="submit" className="btn-accent">
              <MaterialIcon name="search" />
              Buscar
            </button>
            <button type="button" className="btn-ghost" onClick={handleLimpiar}>
              <MaterialIcon name="refresh" />
              Limpiar
            </button>
          </div>
        </div>
      </form>

      {error && <p className="mod-error">{error}</p>}
      {ok && (
        <p
          className="mod-muted"
          style={{
            background: "#eaf8ef",
            padding: "0.7rem 0.9rem",
            borderRadius: 10,
            color: "#1f7a45",
          }}
        >
          {ok}
        </p>
      )}

      <div className="panel-card">
        {loading ? (
          <p className="mod-muted">Cargando casos asignados...</p>
        ) : (
          <>
            <div className="casos-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código del caso</th>
                    <th>Delito</th>
                    <th>Víctima / Afectado</th>
                    <th>Fecha asignación</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                    <th>Unidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setHighlightId(c.id)}
                      onDoubleClick={() => openExpediente(c)}
                      style={{
                        cursor: "pointer",
                        background: highlightId === c.id ? "#f1ebff" : undefined,
                      }}
                    >
                      <td className="casos-codigo">
                        <strong>{c.codigo_caso || "—"}</strong>
                        <span>{c.numero_expediente}</span>
                      </td>
                      <td className="casos-delito">
                        <strong>{c.tipo_delito_nombre || c.titulo}</strong>
                        <span>
                          {c.tipo_delito_articulo
                            ? c.tipo_delito_articulo
                            : c.titulo !== c.tipo_delito_nombre
                              ? c.titulo
                              : "—"}
                        </span>
                      </td>
                      <td className="casos-persona">
                        <strong>{c.victima?.nombre || "Sin registrar"}</strong>
                        <span>
                          {c.victima?.cedula
                            ? `C.I. ${c.victima.cedula}`
                            : c.victima?.tipo_label || "—"}
                        </span>
                      </td>
                      <td>{formatAsignacion(c.creado_en)}</td>
                      <td>
                        <span className={`badge-prioridad ${c.prioridad}`}>
                          {c.prioridad_label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-estado ${c.estado}`}>
                          <span className="badge-dot" />
                          {c.estado_label}
                        </span>
                      </td>
                      <td>{c.unidad || "—"}</td>
                      <td>
                        <div className="row-actions" style={{ position: "relative" }}>
                          <button
                            type="button"
                            title="Ver expediente"
                            onClick={(e) => {
                              e.stopPropagation();
                              openExpediente(c);
                            }}
                          >
                            <MaterialIcon name="visibility" />
                          </button>
                          <button
                            type="button"
                            title="Más acciones"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === c.id ? null : c.id);
                            }}
                          >
                            <MaterialIcon name="more_vert" />
                          </button>
                          {menuOpenId === c.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                top: "110%",
                                zIndex: 5,
                                background: "#fff",
                                border: "1px solid #e5e9f2",
                                borderRadius: 10,
                                boxShadow: "0 8px 20px rgba(30,42,74,0.12)",
                                minWidth: 160,
                                padding: "0.35rem",
                              }}
                            >
                              <button
                                type="button"
                                className="btn-ghost"
                                style={{ width: "100%", justifyContent: "flex-start" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openExpediente(c);
                                }}
                              >
                                Abrir Mesa de Trabajo
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!pageItems.length && (
                    <tr>
                      <td colSpan={8} className="mod-muted">
                        No hay casos asignados con esos criterios.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="casos-footer">
              <span>{rangeLabel}</span>
              <div className="casos-pager">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === page ? "active" : ""}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <ExpedienteDetalle
          expediente={selected}
          meta={meta}
          onClose={() => {
            setSelected(null);
            setHighlightId(null);
            setMenuOpenId(null);
            load(filters, { restoreSelected: false });
          }}
          onUpdated={(fresh) => {
            setSelected(fresh);
            setItems((prev) =>
              prev.map((x) => (x.id === fresh.id ? { ...x, ...fresh } : x))
            );
          }}
          onNotify={notify}
        />
      )}
    </div>
  );
}
