import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { resolveItemSrc } from "./catalogoFlota";
import "./FlotaRegistro.css";

export default function FlotaCatalogo({
  items,
  selectedId,
  onSelect,
  onNuevo,
  onEditar,
  onEliminar,
}) {
  return (
    <div className="flota-catalogo">
      <div className="flota-catalogo-head-row">
        <div className="flota-catalogo-head">
          <h3>
            <MaterialIcon name="directions_car" />
            Catálogo de unidades
          </h3>
          <p>Selecciona un tipo para prellenar el registro</p>
        </div>
        <button type="button" className="btn-ghost flota-nuevo-tipo" onClick={onNuevo}>
          <MaterialIcon name="add" />
          Nuevo tipo de unidad
        </button>
      </div>

      <div className="flota-catalogo-grid">
        {items.map((item) => {
          const active = selectedId === item.id;
          const src = resolveItemSrc(item);
          return (
            <div
              key={item.id}
              className={`flota-unit ${active ? "is-active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(item);
                }
              }}
            >
              <div className="flota-unit-media">
                {src ? (
                  <img src={src} alt={item.nombre} />
                ) : (
                  <span className="flota-unit-placeholder">Sin foto</span>
                )}
              </div>
              <div className="flota-unit-meta">
                <strong>{item.nombre}</strong>
                <small>{item.alias || item.descripcion || "—"}</small>
              </div>
              <div className="flota-unit-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="flota-action edit"
                  title="Editar"
                  onClick={() => onEditar(item)}
                >
                  <MaterialIcon name="edit" />
                </button>
                <button
                  type="button"
                  className="flota-action delete"
                  title="Eliminar"
                  onClick={() => onEliminar(item)}
                >
                  <MaterialIcon name="delete" />
                </button>
              </div>
            </div>
          );
        })}
        {!items.length && (
          <p className="mod-muted flota-catalogo-empty">No hay tipos de unidad. Crea el primero.</p>
        )}
      </div>
    </div>
  );
}
