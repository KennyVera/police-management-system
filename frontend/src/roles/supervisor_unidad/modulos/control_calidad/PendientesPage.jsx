import { useEffect, useRef, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { supervisorApi, unwrapPage } from "../../api";
import PartesPendientesLista from "./componentes/PartesPendientesLista";
import ParteRevisionPanel from "./componentes/ParteRevisionPanel";
import "../../../../shared/styles/ModuloPage.css";
import "../../../../shared/components/PaginationBar.css";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

const PRIORIDADES = [
  { value: "", label: "Todas las prioridades" },
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
];

export default function PendientesPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  const selectedIdRef = useRef(null);
  const reqIdRef = useRef(0);
  selectedIdRef.current = selected?.id ?? null;

  // Búsqueda automática (sin botón Buscar)
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
        const raw = await supervisorApi.listPendientes({
          q: qDebounced,
          prioridad,
          page,
          page_size: PAGE_SIZE,
        });
        if (cancelled || reqId !== reqIdRef.current) return;

        const pageData = unwrapPage(raw);
        setItems(pageData.results);
        setCount(pageData.count);
        setTotalPages(pageData.total_pages);
        // Solo ajustar página si el backend la corrigió (ej. fuera de rango)
        if (pageData.page !== page) {
          setPage(pageData.page);
          return;
        }

        const sid = selectedIdRef.current;
        if (sid) {
          const refreshed = pageData.results.find((p) => p.id === sid);
          if (refreshed) {
            setSelected(refreshed);
          } else {
            try {
              const detail = await supervisorApi.getParte(sid);
              if (cancelled || reqId !== reqIdRef.current) return;
              if (detail?.estado_revision === "EN_REVISION") setSelected(detail);
              else setSelected(null);
            } catch {
              if (!cancelled) setSelected(null);
            }
          }
        }
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
  }, [qDebounced, prioridad, page]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function reload() {
    const raw = await supervisorApi.listPendientes({
      q: qDebounced,
      prioridad,
      page,
      page_size: PAGE_SIZE,
    });
    const pageData = unwrapPage(raw);
    setItems(pageData.results);
    setCount(pageData.count);
    setTotalPages(pageData.total_pages);
    if (pageData.page !== page) setPage(pageData.page);
  }

  async function handleRechazar() {
    if (!selected) return;
    if (!motivo.trim()) {
      setError("Indica el comentario de corrección para el agente.");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      await supervisorApi.rechazar(selected.id, motivo.trim());
      setOk("Parte rechazado. El agente lo recibe en su buzón con tu comentario.");
      setSelected(null);
      setMotivo("");
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAprobar() {
    if (!selected) return;
    if (!window.confirm("¿Aprobar y bloquear este parte? Quedará inmutable y se generará el PDF.")) {
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      await supervisorApi.aprobar(selected.id);
      setOk("Parte aprobado y bloqueado. Enviado a la base central con PDF definitivo.");
      setSelected(null);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerPdf() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const blob = await supervisorApi.fetchPartePdf(selected.id);
      const url = URL.createObjectURL(blob);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDescargarPdf() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const blob = await supervisorApi.fetchPartePdf(selected.id, { download: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected.numero_caso || `parte-${selected.id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function closePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  }

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Control de Calidad</p>
          <h2>Bandeja de Partes Pendientes</h2>
          <p className="mod-desc">
            Revisa reportes de agentes. Puedes ver o descargar el PDF con evidencias antes de
            aprobar (bloquea + PDF definitivo) o rechazar con comentario.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setLoading(true);
            reload()
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
        style={{ gridTemplateColumns: "minmax(0, 1.8fr) minmax(160px, 0.7fr)" }}
      >
        <label>
          Buscar
          <input
            placeholder="Nº caso, agente, título, lugar o delito..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
      </div>

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

      {loading && !items.length ? (
        <p className="mod-muted">Cargando bandeja...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "1rem" }}>
          <div>
            <div className="panel-card" style={{ overflowX: "auto" }}>
              {loading && (
                <p className="mod-muted" style={{ marginTop: 0 }}>
                  Actualizando...
                </p>
              )}
              <PartesPendientesLista
                items={items}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              count={count}
              pageSize={PAGE_SIZE}
              disabled={loading}
              onPageChange={setPage}
            />
          </div>
          <aside
            className="panel-card"
            style={{ display: "grid", gap: "0.75rem", alignContent: "start" }}
          >
            <ParteRevisionPanel
              parte={selected}
              motivo={motivo}
              onMotivoChange={setMotivo}
              busy={busy}
              onRechazar={handleRechazar}
              onAprobar={handleAprobar}
              onVerPdf={handleVerPdf}
              onDescargarPdf={handleDescargarPdf}
            />
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
              <strong>
                Vista previa PDF ·{" "}
                {selected?.titulo || selected?.numero_caso || `Parte #${selected?.id}`}
              </strong>
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
