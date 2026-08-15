import MaterialIcon from "./MaterialIcon";
import "./ConfirmDialog.css";

/**
 * Modal de confirmación/advertencia (reemplazo de window.confirm).
 * Soporta modo claro y oscuro vía theme.css / variables --ct-*.
 */
export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  variant = "warn",
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const icon =
    variant === "danger" ? "warning" : variant === "info" ? "info" : "error";

  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        className={`modal-card confirm-dialog confirm-${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-icon" aria-hidden="true">
          <MaterialIcon name={icon} />
        </div>
        <div className="confirm-body">
          <h3 id="confirm-dialog-title">{title}</h3>
          {typeof message === "string" ? (
            <p id="confirm-dialog-desc" className="confirm-message">
              {message}
            </p>
          ) : (
            <div id="confirm-dialog-desc" className="confirm-message">
              {message}
            </div>
          )}
        </div>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === "danger" ? "btn-danger" : "btn-warn"}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
