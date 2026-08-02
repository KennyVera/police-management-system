import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { agenteApi, unwrapPage } from "../../api";
import PartesLista from "./componentes/PartesLista";
import ParteFormulario from "./componentes/ParteFormulario";
import "../../../../shared/styles/ModuloPage.css";

const PAGE_SIZE = 10;

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "BORRADOR", label: "Borrador" },
  { value: "EN_REVISION", label: "Pendiente de revisión" },
  { value: "OBSERVADO", label: "Rechazado" },
  { value: "APROBADO", label: "Aprobado" },
];

export default function PartesAprehensionPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ tipos_delito: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // consult | edit
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [tipoDelito, setTipoDelito] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState(null);

  async function load({
    search = q,
    estadoFilter = estado,
    delito = tipoDelito,
    pageNum = page,
  } = {}) {
    setLoading(true);
    setError("");
    try {
      const [raw, m] = await Promise.all([
        agenteApi.listPartes({
          q: search,
          estado: estadoFilter,
          tipo_delito: delito,
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
    setEstado("");
    setTipoDelito("");
    setPage(1);
    load({ search: "", estadoFilter: "", delito: "", pageNum: 1 });
  }

  async function handleEnviar(row) {
    if (!window.confirm("¿Enviar este parte al supervisor para revisión?")) return;
    setBusyId(row.id);
    setError("");
    try {
      await agenteApi.enviarParteRevision(row.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Registro Operativo</p>
          <h2>Partes de Aprehensión</h2>
          <p className="mod-desc">
            Consulta y edita borradores creados desde alertas. Usa “Enviar a Supervisor” para
            dejar el documento pendiente en el buzón del Capitán.
          </p>
        </div>
      </header>

      <form className="panel-card filters-bar" onSubmit={applyFilters}>
        <label>
          Buscar
          <input
            placeholder="Nº caso, título, cédula, lugar o delito..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de delito
          <select value={tipoDelito} onChange={(e) => setTipoDelito(e.target.value)}>
            <option value="">Todos</option>
            {(meta.tipos_delito || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
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
          <PartesLista
            items={items}
            busyId={busyId}
            onConsult={(row) => {
              setSelected(row);
              setMode("consult");
            }}
            onEdit={(row) => {
              setSelected(row);
              setMode("edit");
            }}
            onEnviar={handleEnviar}
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

      {mode && selected && (
        <ParteFormulario
          delitos={meta.tipos_delito || []}
          meta={meta}
          initial={selected}
          readOnly={mode === "consult"}
          onClose={() => {
            setMode(null);
            setSelected(null);
          }}
          onSaved={() => {
            setMode(null);
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}
