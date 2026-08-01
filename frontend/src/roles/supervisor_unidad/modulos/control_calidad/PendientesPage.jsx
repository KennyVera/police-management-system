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

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await supervisorApi.listPendientes();
      setItems(list);
      if (selected && !list.some((p) => p.id === selected.id)) setSelected(null);
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
      await load();
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

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Control de Calidad</p>
          <h2>Bandeja de Partes Pendientes</h2>
          <p className="mod-desc">
            Revisa reportes de agentes. Aprueba (bloquea + PDF) o rechaza con comentario de
            corrección. Nada mal redactado debe salir a Fiscalía.
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
            />
          </aside>
        </div>
      )}
    </div>
  );
}
