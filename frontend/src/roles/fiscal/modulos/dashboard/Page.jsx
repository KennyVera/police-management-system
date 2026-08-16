import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { fiscalApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

export default function Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fiscalApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis || {};

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Fiscalía de Turno</p>
          <h2>Dashboard</h2>
          <p className="mod-desc">
            Partes aprobados por el supervisor llegan aquí para decisión jurídica:
            despacho administrativo o indagación previa con detective.
          </p>
        </div>
        <Link to="/app/fiscal/bandeja" className="btn-accent">
          <MaterialIcon name="inbox" />
          Ir a bandeja
        </Link>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando…</p>
      ) : (
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Pendientes", value: k.pendientes, tone: "#f59e0b" },
            { label: "Despacho admin", value: k.despacho_admin, tone: "#22c55e" },
            { label: "En investigación", value: k.en_investigacion, tone: "#8b5cf6" },
            { label: "Mis decisiones", value: k.mios, tone: "#3b82f6" },
          ].map((c) => (
            <article key={c.label} className="panel-card" style={{ padding: "1rem" }}>
              <p className="mod-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                {c.label}
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.8rem", fontWeight: 800, color: c.tone }}>
                {c.value ?? 0}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
