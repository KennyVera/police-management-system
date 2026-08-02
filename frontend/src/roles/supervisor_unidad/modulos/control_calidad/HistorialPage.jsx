import { useEffect, useRef, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { supervisorApi, unwrapPage } from "../../api";
import PartesHistorialLista from "./componentes/PartesHistorialLista";
import "../../../../shared/styles/ModuloPage.css";
import "../../../../shared/components/PaginationBar.css";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

const ESTADOS = [
  { value: "", label: "Todos (aprobados / rechazados)" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "OBSERVADO", label: "Rechazado" },
];

export default function HistorialPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
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

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const raw = await supervisorApi.listHistorial({
          q: qDebounced,
          estado,
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled || reqId !== reqIdRef.current) return;
        const pageData = unwrapPage(raw);
        setItems(pageData.results);
        setCount(pageData.count);
        setTotalPages(pageData.total_pages);
        if (pageData.page !== page) setPage(pageData.page);
      } catch (err) {
        if (!cancelled && reqId === reqIdRef.current) setError(err.message);
      } finally {
        if (!cancelled && reqId === reqIdRef.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [qDebounced, estado, page]);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Control de Calidad</p>
          <h2>Historial de Partes</h2>
          <p className="mod-desc">
            Partes ya aprobados (inmutables) o rechazados con observación al agente.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setLoading(true);
            supervisorApi
              .listHistorial({
                q: qDebounced,
                estado,
                page,
                page_size: PAGE_SIZE,
              })
              .then((raw) => {
                const pageData = unwrapPage(raw);
                setItems(pageData.results);
                setCount(pageData.count);
                setTotalPages(pageData.total_pages);
              })
              .catch((err) => setError(err.message))
              .finally(() => setLoading(false));
          }}
        >
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      <div
        className="panel-card filters-bar"
        style={{ gridTemplateColumns: "minmax(0, 1.8fr) minmax(180px, 0.7fr)" }}
      >
        <label>
          Buscar
          <input
            placeholder="Nº caso, agente, título o lugar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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

      {error && <p className="mod-error">{error}</p>}
      {loading && !items.length ? (
        <p className="mod-muted">Cargando historial...</p>
      ) : (
        <>
          <div className="panel-card" style={{ overflowX: "auto" }}>
            {loading && (
              <p className="mod-muted" style={{ marginTop: 0 }}>
                Actualizando...
              </p>
            )}
            <PartesHistorialLista items={items} />
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            count={count}
            pageSize={PAGE_SIZE}
            disabled={loading}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
