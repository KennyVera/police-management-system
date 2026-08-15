import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { agenteApi, unwrapPage } from "../../api";
import NovedadesLista from "./componentes/NovedadesLista";
import NovedadFormulario from "./componentes/NovedadFormulario";
import "../../../../shared/styles/ModuloPage.css";
import "./RegistroOperativo.css";

const PAGE_SIZE = 10;

export default function NovedadesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ tipos_novedad: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  async function load({ search = q, tipoFilter = tipo, pageNum = page } = {}) {
    setLoading(true);
    setError("");
    try {
      const [raw, m] = await Promise.all([
        agenteApi.listNovedades({
          q: search,
          tipo: tipoFilter,
          page: pageNum,
          page_size: PAGE_SIZE,
        }),
        agenteApi.meta(),
      ]);
      const pageData = unwrapPage(raw);
      setItems(pageData.results);
      setCount(pageData.count);
      setTotalPages(pageData.total_pages);
      setPage(pageData.page);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ pageNum: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e) {
    e?.preventDefault?.();
    setPage(1);
    load({ pageNum: 1 });
  }

  function clearFilters() {
    setQ("");
    setTipo("");
    setPage(1);
    load({ search: "", tipoFilter: "", pageNum: 1 });
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Registro Operativo</p>
          <h2>Novedades e Incidentes</h2>
          <p className="mod-desc">
            Documenta eventos que no terminan en detención: choque leve, riña pacificada,
            auxilio médico u otros.
          </p>
        </div>
        <button
          type="button"
          className="btn-accent"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <MaterialIcon name="add" />
          Nueva novedad
        </button>
      </header>

      <form className="panel-card filters-bar" onSubmit={applyFilters}>
        <label>
          Buscar
          <input
            placeholder="Lugar o descripción..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {(meta.tipos_novedad || []).map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div />
        <div className="filters-actions">
          <button type="submit" className="btn-ghost">
            <MaterialIcon name="search" />
            Buscar
          </button>
          <button type="button" className="btn-ghost" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </form>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <>
          <NovedadesLista
            items={items}
            onEdit={(row) => {
              setEditing(row);
              setShowForm(true);
            }}
          />
          <PaginationBar
            page={page}
            totalPages={totalPages}
            count={count}
            pageSize={PAGE_SIZE}
            disabled={loading}
            onPageChange={(n) => {
              setPage(n);
              load({ pageNum: n });
            }}
          />
        </>
      )}

      {showForm && (
        <NovedadFormulario
          tipos={meta.tipos_novedad || []}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
