import { CATALOGO_FLOTA } from "./catalogoFlota";
import "./FlotaRegistro.css";

export default function FlotaCatalogo({ selectedId, onSelect }) {
  return (
    <div className="flota-catalogo">
      <div className="flota-catalogo-head">
        <h3>Catálogo de unidades</h3>
        <p>Selecciona un tipo para prellenar el registro</p>
      </div>
      <div className="flota-catalogo-grid">
        {CATALOGO_FLOTA.map((item) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`flota-unit ${active ? "is-active" : ""}`}
              onClick={() => onSelect(item)}
            >
              <span className="flota-unit-media">
                <img src={item.src} alt={item.nombre} />
              </span>
              <span className="flota-unit-meta">
                <strong>{item.nombre}</strong>
                <small>{item.descripcion}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
