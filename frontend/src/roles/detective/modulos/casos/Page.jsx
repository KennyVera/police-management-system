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
  tipo_delito: "",
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
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selected?.id ?? null;

  async function load(activeFilters = filters, { restoreSelected = true } = {}) {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (activeFilters.q?.trim()) params.q = activeFilters.q.trim();
      if (activeFilters.estado) params.estado = activeFilters.estado;
      if (activeFilters.prioridad) params.prioridad = activeFilters.prioridad;
      if (activeFilters.tipo_delito) params.tipo_delito = activeFilters.tipo_delito;

      const [m, list] = await Promise.all([
        detectiveApi.casosMeta(),
        detectiveApi.listExpedientes(params),
      ]);
      setMeta(m);
      setItems(list);
      setPage(1);
      if (restoreSelected && selectedIdRef.current) {
        const still = list.find((x) => x.id === selectedIdRef.current);
        if (still) setSelected(await detectiveApi.getExpediente(still.id));
        else setSelected(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filtro automático (debounce en palabra clave)
  useEffect(() => {
    const t = setTimeout(() => {
      load(filters, { restoreSelected: true });
    }, filters.q ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.estado, filters.prioridad, filters.tipo_delito]);

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
    try {
      setHighlightId(item.id);
      setSelected(await detectiveApi.getExpediente(item.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function patchFilter(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function handleLimpiar() {
    setFilters(emptyFilters);
  }

  function notify(msg, isError = false) {
    if (isError) setError(msg);
    else {
      setOk(msg);
      setError("");
    }
  }

  const highlighted = items.find((c) => c.id === highlightId) || null;
  const hasActiveFilters = Boolean(
    filters.q?.trim() || filters.estado || filters.prioridad || filters.tipo_delito
  );

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
          disabled={busy || !highlighted}
          title={
            highlighted
              ? `Abrir ${highlighted.codigo_caso || highlighted.numero_expediente}`
              : "Selecciona un expediente en la tabla"
          }
          onClick={() => openExpediente(highlighted)}
        >
          <MaterialIcon name="folder_open" />
          Abrir Mesa de Trabajo
        </button>
      </header>

      <div className="panel-card casos-filters">
        <p className="casos-filters-head">
          <MaterialIcon name="filter_alt" />
          Criterios de búsqueda
        </p>
        <div className="casos-filters-grid casos-filters-grid--compact">
          <label>
            Buscar por palabra clave
            <input
              placeholder="Ej: robo, agresión, placa, nombre..."
              value={filters.q}
              onChange={(e) => patchFilter({ q: e.target.value })}
            />
          </label>
          <label>
            Estado
            <select
              value={filters.estado}
              onChange={(e) => patchFilter({ estado: e.target.value })}
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
              value={filters.prioridad}
              onChange={(e) => patchFilter({ prioridad: e.target.value })}
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
            Tipo de delito
            <select
              value={filters.tipo_delito}
              onChange={(e) => patchFilter({ tipo_delito: e.target.value })}
            >
              <option value="">Todos los tipos</option>
              {(meta.tipos_delito || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </label>
          {hasActiveFilters && (
            <div className="casos-filters-actions">
              <button type="button" className="btn-ghost" onClick={handleLimpiar}>
                <MaterialIcon name="refresh" />
                Limpiar
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {ok && <p className="mod-ok">{ok}</p>}

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
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr
                      key={c.id}
                      className={highlightId === c.id ? "casos-row-hl" : undefined}
                      onClick={() => setHighlightId(c.id)}
                      onDoubleClick={() => openExpediente(c)}
                      style={{ cursor: "pointer" }}
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
                    </tr>
                  ))}
                  {!pageItems.length && (
                    <tr>
                      <td colSpan={7} className="mod-muted">
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
            load(filters, { restoreSelected: false });
          }}
          onUpdated={(fresh) => {
            // Solo refrescar la fila en la tabla; no reabrir el modal si ya se cerró.
            setItems((prev) =>
              prev.map((x) => (x.id === fresh.id ? { ...x, ...fresh } : x))
            );
            setSelected((cur) => (cur?.id === fresh?.id ? fresh : cur));
          }}
          onNotify={notify}
        />
      )}
    </div>
  );
}
