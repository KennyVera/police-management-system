import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../api";
import NovedadesLista from "./componentes/NovedadesLista";
import NovedadFormulario from "./componentes/NovedadFormulario";
import "../../../../shared/styles/ModuloPage.css";

export default function NovedadesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ tipos_novedad: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");

  async function load(search = q) {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        agenteApi.listNovedades(search ? { q: search } : {}),
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

      <div className="panel-card" style={{ display: "flex", gap: "0.5rem" }}>
        <input
          style={{ flex: 1, border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem 0.7rem" }}
          placeholder="Buscar por lugar o descripción..."
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
        <NovedadesLista
          items={items}
          onEdit={(row) => {
            setEditing(row);
            setShowForm(true);
          }}
        />
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
