import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { identidadApi } from "../../api";
import UsuariosTabla from "./componentes/UsuariosTabla";
import UsuarioFormulario from "./componentes/UsuarioFormulario";
import CredencialesPanel from "./componentes/CredencialesPanel";
import SesionesPanel from "./componentes/SesionesPanel";
import "./IdentidadAccesos.css";

const META = {
  usuarios: {
    title: "Usuarios",
    desc: "Registrar funcionarios, asignar roles y suspender o dar de baja cuentas.",
  },
  credenciales: {
    title: "Credenciales",
    desc: "Restablecer contraseñas y habilitar o deshabilitar el doble factor (2FA).",
  },
  sesiones: {
    title: "Sesiones",
    desc: "Ver usuarios conectados y forzar el cierre de sesión por seguridad.",
  },
};

export default function IdentidadAccesosPage({ section = "usuarios" }) {
  const navigate = useNavigate();
  const meta = META[section] || META.usuarios;
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [users, roleList] = await Promise.all([
        identidadApi.listUsuarios(),
        identidadApi.rolesAsignables(),
      ]);
      setUsuarios(users);
      setRoles(roleList);
      if (!selectedUser && users[0]) setSelectedUser(users[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Identidad y Accesos</p>
          <h2>{meta.title}</h2>
          <p className="mod-desc">{meta.desc}</p>
        </div>
        {section === "usuarios" && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <MaterialIcon name="person_add" />
            Nuevo usuario
          </button>
        )}
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <>
          {section === "usuarios" && (
            <UsuariosTabla
              usuarios={usuarios}
              onEdit={(u) => {
                setEditing(u);
                setShowForm(true);
              }}
              onCredenciales={(u) => {
                setSelectedUser(u);
                navigate("/app/administrador/identidad_accesos/credenciales");
              }}
              onChanged={load}
            />
          )}
          {section === "credenciales" && (
            <CredencialesPanel
              usuarios={usuarios}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onChanged={load}
            />
          )}
          {section === "sesiones" && <SesionesPanel />}
        </>
      )}

      {showForm && (
        <UsuarioFormulario
          roles={roles}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
