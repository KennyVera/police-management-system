export default function EscuadrasLista({ items, onInactivar, onAsignarVehiculo }) {
  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">No hay escuadras para esta fecha.</p>
      </div>
    );
  }
  return (
    <div className="panel-card" style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Líder</th>
            <th>Compañeros</th>
            <th>Vehículo</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.nombre}</td>
              <td>{e.agente_lider_info?.nombre || "—"}</td>
              <td>
                {(e.companeros_info || []).length
                  ? e.companeros_info.map((c) => c.nombre).join(", ")
                  : "Sin compañeros"}
              </td>
              <td>
                {e.vehiculo_info
                  ? `${e.vehiculo_info.placa} · ${e.vehiculo_info.tipo_label}`
                  : "Sin asignar"}
              </td>
              <td>{e.fecha}</td>
              <td>
                <div className="row-actions">
                  <button type="button" onClick={() => onAsignarVehiculo(e)}>
                    Asignar vehículo
                  </button>
                  <button type="button" onClick={() => onInactivar(e.id)}>
                    Inactivar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
