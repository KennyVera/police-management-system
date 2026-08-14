export default function ModalShell({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{
          maxWidth: wide ? 720 : 480,
          maxHeight: "85vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {subtitle && <p className="mod-muted" style={{ marginTop: 0 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
