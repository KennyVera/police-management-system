import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { agenteApi, unwrapPage } from "../../api";
import MultimediaLista from "./componentes/MultimediaLista";
import MultimediaUploader from "./componentes/MultimediaUploader";
import "../../../../shared/styles/ModuloPage.css";

const PAGE_SIZE = 10;

const ORIGENES = [
  { value: "", label: "Todos los orígenes" },
  { value: "RAPIDA", label: "Captura rápida" },
  { value: "PARTE", label: "Parte" },
  { value: "NOVEDAD", label: "Novedad" },
];

export default function MultimediaPage() {
  const [items, setItems] = useState([]);
  const [partes, setPartes] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  async function loadOptions() {
    const [pRaw, nRaw] = await Promise.all([
      agenteApi.listPartes({ page: 1, page_size: 50 }),
      agenteApi.listNovedades({ page: 1, page_size: 50 }),
    ]);
    setPartes(unwrapPage(pRaw).results);
    setNovedades(unwrapPage(nRaw).results);
  }

  async function load({ search = q, origenFilter = origen, pageNum = page } = {}) {
    setLoading(true);
    setError("");
    try {
      const raw = await agenteApi.listMultimedia({
        q: search,
        origen: origenFilter,
        page: pageNum,
        page_size: PAGE_SIZE,
      });
      const pageData = unwrapPage(raw);
      setItems(pageData.results);
      setCount(pageData.count);
      setTotalPages(pageData.total_pages);
      setPage(pageData.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([load({ pageNum: 1 }), loadOptions()]);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(e) {
    e?.preventDefault?.();
    setPage(1);
    load({ pageNum: 1 });
  }

  function clearFilters() {
    setQ("");
    setOrigen("");
    setPage(1);
    load({ search: "", origenFilter: "", pageNum: 1 });
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Registro Operativo</p>
          <h2>Captura Rápida de Multimedia</h2>
          <p className="mod-desc">
            Adjunta imágenes u evidencias del lugar, sospechoso o indicios. Se almacenan
            en MinIO (servidor institucional), no en la galería del teléfono.
          </p>
        </div>
        <button type="button" className="btn-accent" onClick={() => setShowUpload(true)}>
          <MaterialIcon name="upload" />
          Subir evidencia
        </button>
      </header>

      <form className="panel-card filters-bar" onSubmit={applyFilters}>
        <label>
          Buscar
          <input
            placeholder="Descripción, archivo o Nº caso..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Origen
          <select value={origen} onChange={(e) => setOrigen(e.target.value)}>
            {ORIGENES.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
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
          <MultimediaLista items={items} />
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

      {showUpload && (
        <MultimediaUploader
          partes={partes}
          novedades={novedades}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            load();
            loadOptions();
          }}
        />
      )}
    </div>
  );
}
