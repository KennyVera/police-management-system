import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import PartesPendientesLista from "./componentes/PartesPendientesLista";
import ParteRevisionPanel from "./componentes/ParteRevisionPanel";
import "../../../../shared/styles/ModuloPage.css";

export default function PendientesPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await supervisorApi.listPendientes();
      setItems(list);
      if (selected) {
        const refreshed = list.find((p) => p.id === selected.id);
        setSelected(refreshed || null);
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

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
      await load();
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
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

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

      {loading ? (
        <p className="mod-muted">Cargando bandeja...</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "1rem" }}>
          <div className="panel-card" style={{ overflowX: "auto" }}>
            <PartesPendientesLista
              items={items}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          </div>
          <aside className="panel-card" style={{ display: "grid", gap: "0.75rem", alignContent: "start" }}>
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
              <strong>Vista previa PDF · {selected?.titulo || selected?.numero_caso || `Parte #${selected?.id}`}</strong>
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
