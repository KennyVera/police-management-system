export default function FacturacionHeader({ kicker, title, desc, children }) {
  return (
    <header className="mod-header">
      <div>
        <p className="mod-kicker">{kicker || "Facturación"}</p>
        <h2>{title}</h2>
        {desc && <p className="mod-desc">{desc}</p>}
      </div>
      {children && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {children}
        </div>
      )}
    </header>
  );
}
