import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MaterialIcon from "./MaterialIcon";
import { notificacionesApi } from "../api/notificaciones";
import "./NotificationBell.css";

function fmt(dt) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("es-EC", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await notificacionesApi.list();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      /* sesión u otros roles sin impacto */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function handleOpenItem(n) {
    try {
      if (!n.leida) await notificacionesApi.markRead(n.id);
    } catch {
      /* ignore */
    }
    setOpen(false);
    await load();
    if (n.enlace) navigate(n.enlace);
  }

  async function handleMarkAll() {
    await notificacionesApi.markAllRead();
    await load();
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="icon-chip"
        aria-label="Notificaciones"
        onClick={() => {
          setOpen((v) => !v);
          load();
        }}
      >
        <MaterialIcon name="notifications" />
        {unread > 0 && <span className="notif-dot" />}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notificaciones</strong>
            {unread > 0 && (
              <button type="button" className="notif-link" onClick={handleMarkAll}>
                Marcar todas
              </button>
            )}
          </div>
          {!items.length ? (
            <p className="notif-empty">No tienes notificaciones.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-item${n.leida ? "" : " unread"}`}
                    onClick={() => handleOpenItem(n)}
                  >
                    <span className={`notif-type ${n.tipo}`}>
                      <MaterialIcon
                        name={
                          n.tipo === "PARTE_RECHAZADO"
                            ? "cancel"
                            : n.tipo === "PARTE_APROBADO"
                              ? "check_circle"
                              : n.tipo === "DISPOSICION_ZONA"
                                ? "campaign"
                                : n.tipo === "EXPEDIENTE_ASIGNADO"
                                  ? "folder_open"
                                  : "notifications"
                        }
                      />
                    </span>
                    <span className="notif-body">
                      <strong>{n.titulo}</strong>
                      <span>{n.mensaje}</span>
                      <small>{fmt(n.creado_en)}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
