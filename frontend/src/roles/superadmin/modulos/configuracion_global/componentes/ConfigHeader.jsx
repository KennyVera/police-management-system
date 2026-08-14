export default function ConfigHeader({ title, desc, children }) {
  return (
    <header className="mod-header">
      <div>
        <p className="mod-kicker">Configuración global</p>
        <h2>{title}</h2>
        {desc && <p className="mod-desc">{desc}</p>}
      </div>
      {children && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{children}</div>
      )}
    </header>
  );
}
