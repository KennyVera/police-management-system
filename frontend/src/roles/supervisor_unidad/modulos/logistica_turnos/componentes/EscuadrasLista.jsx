import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import "./EscuadrasPage.css";

function estadoEscuadra(e) {
  return e.vehiculo ? "ASIGNADA" : "PENDIENTE";
}

export default function EscuadrasLista({ items, fecha, onEditar, onEliminar }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">
          No hay escuadras activas para la fecha <strong>{fecha || "seleccionada"}</strong>.
        </p>
        <p className="mod-muted" style={{ marginTop: "0.35rem" }}>
          Prueba otra fecha o crea una con <strong>+ Nueva escuadra</strong>. Las escuadras
          son diarias: solo aparecen el día en que fueron registradas.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-card escuadras-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Escuadra</th>
            <th>Líder</th>
            <th>Compañeros</th>
            <th>Vehículo</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const estado = estadoEscuadra(e);
            return (
              <tr key={e.id}>
                <td>{e.nombre}</td>
                <td>{e.agente_lider_info?.nombre || "—"}</td>
                <td>
                  {(e.companeros_info || []).length
                    ? e.companeros_info.map((c) => c.nombre).join(", ")
                    : "—"}
                </td>
                <td>
                  {e.vehiculo_info ? (
                    `${e.vehiculo_info.placa} · ${e.vehiculo_info.tipo_label}`
                  ) : (
                    <span className="escuadras-sin-asignar">Sin asignar</span>
                  )}
                </td>
                <td>{e.fecha}</td>
                <td>
                  <span className={`badge-estado ${estado}`}>
                    <MaterialIcon name={estado === "PENDIENTE" ? "schedule" : "check_circle"} />
                    {estado === "PENDIENTE" ? "Pendiente" : "Asignada"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="escuadras-icon-btn edit"
                      title="Editar escuadra"
                      onClick={() => onEditar(e)}
                    >
                      <MaterialIcon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="escuadras-icon-btn delete"
                      title="Inactivar escuadra"
                      onClick={() => onEliminar(e)}
                    >
                      <MaterialIcon name="delete" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
