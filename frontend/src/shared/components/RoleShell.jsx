import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import MaterialIcon from "./MaterialIcon";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../../auth/AuthContext";
import "./RoleShell.css";

const COLLAPSE_KEY = "sgp_sidebar_collapsed";

function initials(user) {
  const a = (user?.first_name || "?").charAt(0);
  const b = (user?.last_name || "").charAt(0);
  return `${a}${b}`.toUpperCase();
}

function NavGroup({ role, mod, sidebarCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const base = `/app/${role.slug}/`;
  const childActive = mod.children.some((c) =>
    location.pathname.startsWith(`${base}${c.path}`)
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  function toggleGroup() {
    if (sidebarCollapsed) {
      navigate(`${base}${mod.children[0].path}`);
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div className={`nav-group${open || sidebarCollapsed ? " is-open" : ""}${childActive ? " has-active" : ""}`}>
      <button
        type="button"
        className={`nav-item nav-parent${childActive ? " active" : ""}`}
        onClick={toggleGroup}
        title={mod.label}
      >
        <MaterialIcon name={mod.icon} />
        <span className="nav-label">{mod.label}</span>
        <MaterialIcon
          name={open ? "expand_less" : "expand_more"}
          className="nav-chevron"
        />
      </button>

      {(open || sidebarCollapsed) && (
        <div className="nav-children">
          {mod.children.map((child) => (
            <NavLink
              key={child.slug}
              to={`${base}${child.path}`}
              className={({ isActive }) =>
                isActive ? "nav-item nav-child active" : "nav-item nav-child"
              }
              title={child.label}
            >
              <MaterialIcon name={child.icon} />
              <span className="nav-label">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RoleShell({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className={`role-shell${collapsed ? " is-collapsed" : ""}`}
      style={{ "--role-accent": role.accent }}
    >
      <aside className="role-sidebar">
        <div className="role-brand">
          <div className="brand-icon" aria-hidden="true">
            <MaterialIcon name="shield" filled />
            <MaterialIcon name="schedule" className="brand-icon-clock" />
          </div>
          <div className="brand-text">
            <strong>CrimeTrack</strong>
            <span>{role.title}</span>
          </div>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            <MaterialIcon
              name={collapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            />
          </button>
        </div>

        <nav className="role-nav">
          {role.modules.map((mod) =>
            mod.children?.length ? (
              <NavGroup
                key={mod.slug}
                role={role}
                mod={mod}
                sidebarCollapsed={collapsed}
              />
            ) : (
              <NavLink
                key={mod.slug}
                to={`/app/${role.slug}/${mod.path}`}
                className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
                title={mod.label}
              >
                <MaterialIcon name={mod.icon} />
                <span className="nav-label">{mod.label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <MaterialIcon name="logout" />
            <span className="logout-label">Cerrar sesión</span>
          </button>
          <p className="sidebar-copy">
            © 2026 CrimeTrack Analytics Corp.
            <br />
            Todos los derechos reservados.
          </p>
        </div>
      </aside>

      <div className="role-main">
        <header className="role-topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="collapse-btn mobile-toggle"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <MaterialIcon name="menu" />
            </button>
            <div>
              <p className="eyebrow">{role.subtitle}</p>
              <h1>{role.title}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <NotificationBell />
            <button type="button" className="icon-chip" aria-label="Tema">
              <MaterialIcon name="dark_mode" />
            </button>
            <div className="user-chip">
              <span className="avatar">{initials(user)}</span>
              <div className="user-meta">
                <strong>
                  {user?.first_name} {user?.last_name}
                </strong>
                <span>{user?.email}</span>
              </div>
            </div>
          </div>
        </header>
        <section className="role-content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
