import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "./MaterialIcon";
import ProfileModal from "./ProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";
import { useAuth } from "../../auth/AuthContext";
import { resolveMediaUrl } from "../../auth/api";
import "./UserMenu.css";

function initials(user) {
  const a = (user?.first_name || "?").charAt(0);
  const b = (user?.last_name || "").charAt(0);
  return `${a}${b}`.toUpperCase();
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const avatarSrc = resolveMediaUrl(user?.avatar_url);
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Usuario";

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className={`user-menu${open ? " is-open" : ""}`} ref={rootRef}>
        <button
          type="button"
          className="user-chip user-chip-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="avatar avatar-img" />
          ) : (
            <span className="avatar">{initials(user)}</span>
          )}
          <div className="user-meta">
            <strong>{fullName}</strong>
            <span>{user?.email}</span>
          </div>
          <MaterialIcon name={open ? "expand_less" : "expand_more"} className="user-chip-chevron" />
        </button>

        {open && (
          <div className="user-menu-panel" role="menu">
            <div className="user-menu-header">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="user-menu-avatar" />
              ) : (
                <span className="user-menu-avatar initials">{initials(user)}</span>
              )}
              <div>
                <strong>{fullName}</strong>
                <span>{user?.email}</span>
              </div>
            </div>

            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setProfileOpen(true);
              }}
            >
              <MaterialIcon name="person" />
              <span>Perfil</span>
            </button>
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setPasswordOpen(true);
              }}
            >
              <MaterialIcon name="lock" />
              <span>Cambio de clave</span>
            </button>

            <div className="user-menu-divider" />

            <button
              type="button"
              className="user-menu-item is-danger"
              role="menuitem"
              onClick={handleLogout}
            >
              <MaterialIcon name="logout" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {passwordOpen && (
        <ChangePasswordModal onClose={() => setPasswordOpen(false)} />
      )}
    </>
  );
}
