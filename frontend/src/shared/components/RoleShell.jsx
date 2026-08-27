import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import MaterialIcon from "./MaterialIcon";
import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";
import { useAuth } from "../../auth/AuthContext";
import { useBranding } from "../branding/BrandingContext";
import { useTheme } from "../theme/ThemeContext";
import "./RoleShell.css";

const COLLAPSE_KEY = "sgp_sidebar_collapsed";

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
  const { logout } = useAuth();
  const { branding, assetUrl } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!logoOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setLogoOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logoOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const brandName = branding?.nombre_sistema || "CrimeTrack";
  const logoSrc = assetUrl(branding?.logo_url);
  const accent = branding?.color_principal || role.accent;

  return (
    <div
      className={`role-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
      style={{ "--role-accent": accent }}
    >
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="role-sidebar">
        <div className="role-brand">
          {logoSrc ? (
            <button
              type="button"
              className="brand-icon has-logo is-clickable"
              onClick={() => setLogoOpen(true)}
              title="Ver logotipo"
              aria-label={`Ver logotipo de ${brandName}`}
            >
              <img src={logoSrc} alt="" className="brand-logo-img" />
            </button>
          ) : (
            <div className="brand-icon" aria-hidden="true">
              <MaterialIcon name="shield" filled />
              <MaterialIcon name="schedule" className="brand-icon-clock" />
            </div>
          )}
          <div className="brand-text">
            <strong>{brandName}</strong>
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
              className="collapse-btn mobile-toggle transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
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
            <button
              type="button"
              className={`icon-chip${isDark ? " is-dark-active" : ""}`}
              aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              title={isDark ? "Modo claro" : "Modo oscuro"}
              onClick={toggleTheme}
            >
              <MaterialIcon name={isDark ? "light_mode" : "dark_mode"} />
            </button>
            <UserMenu />
          </div>
        </header>
        <section className="role-content">
          <Outlet />
        </section>
      </div>

      {logoOpen && logoSrc && (
        <div
          className="logo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Logotipo de ${brandName}`}
          onClick={() => setLogoOpen(false)}
        >
          <button
            type="button"
            className="logo-lightbox-close"
            aria-label="Cerrar"
            onClick={() => setLogoOpen(false)}
          >
            <MaterialIcon name="close" />
          </button>
          <img
            src={logoSrc}
            alt={brandName}
            className="logo-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
