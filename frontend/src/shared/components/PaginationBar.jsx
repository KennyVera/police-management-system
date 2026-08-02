import MaterialIcon from "./MaterialIcon";
import "./PaginationBar.css";

/**
 * Paginador reutilizable para listados paginados del backend.
 * Props: page, totalPages, count, pageSize, onPageChange, disabled?
 */
export default function PaginationBar({
  page = 1,
  totalPages = 1,
  count = 0,
  pageSize = 10,
  onPageChange,
  disabled = false,
}) {
  if (count <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);

  // Ventana de números (máx 7 botones) alrededor de la página actual
  const windowSize = 7;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = [];
  for (let n = start; n <= end; n += 1) pages.push(n);

  return (
    <div className="pager-bar">
      <span className="pager-range">
        Mostrando {from}–{to} de {count}
      </span>
      <div className="pager-controls">
        <button
          type="button"
          className="pager-btn"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <MaterialIcon name="chevron_left" />
        </button>
        {start > 1 && (
          <>
            <button
              type="button"
              className={`pager-btn ${page === 1 ? "active" : ""}`}
              disabled={disabled}
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {start > 2 && <span className="pager-ellipsis">…</span>}
          </>
        )}
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            className={`pager-btn ${n === page ? "active" : ""}`}
            disabled={disabled}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pager-ellipsis">…</span>}
            <button
              type="button"
              className={`pager-btn ${page === totalPages ? "active" : ""}`}
              disabled={disabled}
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          type="button"
          className="pager-btn"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <MaterialIcon name="chevron_right" />
        </button>
      </div>
    </div>
  );
}
