import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../api";
import PartesLista from "./componentes/PartesLista";
import ParteFormulario from "./componentes/ParteFormulario";
import "../../../../shared/styles/ModuloPage.css";

export default function PartesAprehensionPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ tipos_delito: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null); // consult | edit
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load(search = q) {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        agenteApi.listPartes(search ? { q: search } : {}),
        agenteApi.meta(),
      ]);
      setItems(list);
      setMeta(m);
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

      <div className="panel-card" style={{ display: "flex", gap: "0.5rem" }}>
        <input
          style={{
            flex: 1,
            border: "1px solid #e5e9f2",
            borderRadius: 10,
            padding: "0.6rem 0.7rem",
          }}
          placeholder="Buscar por nombre, cédula o lugar..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
        <button type="button" className="btn-ghost" onClick={() => load(q)}>
          <MaterialIcon name="search" />
          Buscar
        </button>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
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
