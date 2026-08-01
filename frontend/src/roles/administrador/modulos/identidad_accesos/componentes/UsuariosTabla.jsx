import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { identidadApi } from "../../../api";

export default function UsuariosTabla({ usuarios, onEdit, onCredenciales, onChanged }) {
  async function setEstado(user, estado) {
    const ok = window.confirm(
      `¿Confirmas marcar a ${user.first_name} ${user.last_name} como ${estado}?`
    );
    if (!ok) return;
    await identidadApi.setEstado(user.id, estado);
    onChanged();
  }

  return (
    <div className="panel-card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Funcionario</th>
            <th>Cédula</th>
            <th>Placa</th>
            <th>Rango</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={7}>No hay usuarios policiales registrados.</td>
            </tr>
          )}
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>
                <strong>
                  {u.first_name} {u.last_name}
                </strong>
                <div className="mod-muted">{u.email}</div>
              </td>
              <td>{u.cedula || "—"}</td>
              <td>{u.placa || "—"}</td>
              <td>{u.rango_policial || "—"}</td>
              <td>{u.role_label}</td>
              <td>
                <span className={`badge-estado ${u.estado}`}>{u.estado}</span>
              </td>
              <td>
                <div className="row-actions">
                  <button type="button" title="Editar" onClick={() => onEdit(u)}>
                    <MaterialIcon name="edit" />
                  </button>
                  <button
                    type="button"
                    title="Credenciales"
                    onClick={() => onCredenciales(u)}
                  >
                    <MaterialIcon name="key" />
                  </button>
                  {u.estado === "ACTIVO" ? (
                    <>
                      <button type="button" onClick={() => setEstado(u, "SUSPENDIDO")}>
                        Suspender
                      </button>
                      <button type="button" onClick={() => setEstado(u, "BAJA")}>
                        Baja
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setEstado(u, "ACTIVO")}>
                      Reactivar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
