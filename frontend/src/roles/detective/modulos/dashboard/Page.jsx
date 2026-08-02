import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

export default function DetectiveDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    detectiveApi
      .dashboard()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  const cards = [
    { label: "Casos asignados", value: stats?.casos_asignados, icon: "folder_open" },
    { label: "En indagación", value: stats?.en_indagacion, icon: "manage_search" },
    { label: "Instrucción fiscal", value: stats?.en_instruccion, icon: "gavel" },
    { label: "Evidencias", value: stats?.evidencias, icon: "inventory_2" },
    { label: "Digitales", value: stats?.digitales, icon: "photo_library" },
    { label: "Físicas", value: stats?.fisicas, icon: "science" },
  ];

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Detective / Investigador</p>
          <h2>Dashboard</h2>
          <p className="mod-desc">
            Resumen de expedientes asignados y evidencias bajo tu custodia investigativa.
          </p>
        </div>
      </header>
      {error && <p className="mod-error">{error}</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {cards.map((c) => (
          <div key={c.label} className="panel-card" style={{ display: "grid", gap: "0.35rem" }}>
            <MaterialIcon name={c.icon} />
            <strong style={{ fontSize: "1.4rem" }}>{c.value ?? "—"}</strong>
            <span className="mod-muted">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
