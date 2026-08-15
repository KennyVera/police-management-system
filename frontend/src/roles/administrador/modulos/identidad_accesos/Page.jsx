import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import "../../../../shared/components/PaginationBar.css";
import { identidadApi, unwrapPage } from "../../api";
import UsuariosTabla from "./componentes/UsuariosTabla";
import UsuarioFormulario from "./componentes/UsuarioFormulario";
import CredencialesPanel from "./componentes/CredencialesPanel";
import SesionesPanel from "./componentes/SesionesPanel";
import "./IdentidadAccesos.css";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 350;

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

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "ACTIVO", label: "Activo" },
  { value: "SUSPENDIDO", label: "Suspendido" },
  { value: "BAJA", label: "Baja" },
];

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

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [estado, setEstado] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      setQDebounced((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    identidadApi.rolesAsignables().then(setRoles).catch(() => setRoles([]));
  }, []);

  async function loadUsuarios(opts = {}) {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError("");
    try {
      const raw = await identidadApi.listUsuarios({
        q: qDebounced,
        estado,
        role,
        page: opts.page ?? page,
        page_size: opts.page_size ?? PAGE_SIZE,
      });
      if (reqId !== reqIdRef.current) return;
      const pageData = unwrapPage(raw);
      setUsuarios(pageData.results);
      setCount(pageData.count);
      setTotalPages(pageData.total_pages);
      if (pageData.page !== page) setPage(pageData.page);
      setSelectedUser((prev) => {
        if (!prev) return pageData.results[0] || null;
        const found = pageData.results.find((u) => u.id === prev.id);
        return found || pageData.results[0] || prev;
      });
    } catch (err) {
      if (reqId === reqIdRef.current) setError(err.message);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (section === "sesiones") {
      setLoading(false);
      return;
    }
    if (section === "credenciales") {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      setError("");
      identidadApi
        .listUsuarios({ page: 1, page_size: 100, q: qDebounced, estado, role })
        .then((raw) => {
          if (reqId !== reqIdRef.current) return;
          const pageData = unwrapPage(raw);
          setUsuarios(pageData.results);
          setCount(pageData.count);
          if (!selectedUser && pageData.results[0]) setSelectedUser(pageData.results[0]);
        })
        .catch((err) => {
          if (reqId === reqIdRef.current) setError(err.message);
        })
        .finally(() => {
          if (reqId === reqIdRef.current) setLoading(false);
        });
      return;
    }
    loadUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, qDebounced, estado, role, page]);

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

      {(section === "usuarios" || section === "credenciales") && (
        <div className="panel-card filters-bar">
          <label>
            Buscar
            <input
              placeholder="Nombre, correo, cédula o placa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Estado
            <select
              value={estado}
              onChange={(e) => {
                setEstado(e.target.value);
                setPage(1);
              }}
            >
              {ESTADOS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rol
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <p className="mod-error">{error}</p>}
      {loading && !usuarios.length && section !== "sesiones" ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <>
          {section === "usuarios" && (
            <>
              {loading && (
                <p className="mod-muted" style={{ margin: 0 }}>
                  Actualizando…
                </p>
              )}
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
                onChanged={() => loadUsuarios()}
              />
              <PaginationBar
                page={page}
                totalPages={totalPages}
                count={count}
                pageSize={PAGE_SIZE}
                disabled={loading}
                onPageChange={setPage}
              />
            </>
          )}
          {section === "credenciales" && (
            <CredencialesPanel
              usuarios={usuarios}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onChanged={() => {
                identidadApi
                  .listUsuarios({
                    page: 1,
                    page_size: 100,
                    q: qDebounced,
                    estado,
                    role,
                  })
                  .then((raw) => {
                    const pageData = unwrapPage(raw);
                    setUsuarios(pageData.results);
                    setCount(pageData.count);
                  })
                  .catch((err) => setError(err.message));
              }}
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
            loadUsuarios();
          }}
        />
      )}
    </div>
  );
}
