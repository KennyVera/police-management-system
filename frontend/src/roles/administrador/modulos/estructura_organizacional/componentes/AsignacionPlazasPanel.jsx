import { useEffect, useMemo, useRef, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../../shared/components/ConfirmContext";
import { estructuraApi } from "../../../api";
import "./AsignacionZonas.css";

const ROLE_ZONE = new Set([
  "DIRECTOR_ZONA",
  "SUPERVISOR_UNIDAD",
  "FISCAL",
  "DETECTIVE",
  "AGENTE_OPERATIVO",
]);

function initials(u) {
  const a = (u.first_name || "?").charAt(0);
  const b = (u.last_name || "").charAt(0);
  return `${a}${b}`.toUpperCase();
}

function fullName(u) {
  return `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email;
}

function matchQ(u, q) {
  if (!q) return true;
  const hay = [u.first_name, u.last_name, u.email, u.role_label, u.cedula, u.placa]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export default function AsignacionPlazasPanel({ zonas: zonasProp, onChanged }) {
  const [zonas, setZonas] = useState(zonasProp || []);
  const [usuarios, setUsuarios] = useState([]);
  const [enZona, setEnZona] = useState([]);
  const [zonaId, setZonaId] = useState("");
  const [selectedLeft, setSelectedLeft] = useState(() => new Set());
  const [staged, setStaged] = useState([]); // usuarios pendientes de confirmar
  const [qLeft, setQLeft] = useState("");
  const [qRight, setQRight] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingZona, setLoadingZona] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const transferRef = useRef(null);
  const zonaIdRef = useRef(zonaId);
  zonaIdRef.current = zonaId;
  const confirm = useConfirm();

  async function loadPersonalZona(id) {
    if (!id) {
      setEnZona([]);
      return;
    }
    setLoadingZona(true);
    try {
      const data = await estructuraApi.jurisdiccionPersonal(id);
      setEnZona(
        (data.personal || []).filter(
          (u) => ROLE_ZONE.has(u.role) && u.estado !== "BAJA"
        )
      );
    } catch (err) {
      setError(err.message);
      setEnZona([]);
    } finally {
      setLoadingZona(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [cat, list] = await Promise.all([
        estructuraApi.catalogos(),
        estructuraApi.listPlazas(),
      ]);
      setZonas(cat.zonas || []);
      setUsuarios(list.filter((u) => ROLE_ZONE.has(u.role)));
      if (zonaIdRef.current) await loadPersonalZona(zonaIdRef.current);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (zonasProp?.length) setZonas(zonasProp);
  }, [zonasProp]);

  useEffect(() => {
    loadPersonalZona(zonaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonaId]);

  const zonaSel = useMemo(
    () => zonas.find((z) => String(z.id) === String(zonaId)),
    [zonas, zonaId]
  );

  const enZonaIds = useMemo(() => new Set(enZona.map((u) => u.id)), [enZona]);

  const sinZona = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          !enZonaIds.has(u.id) &&
          !u.jurisdiccion_id &&
          !staged.some((s) => s.id === u.id)
      ),
    [usuarios, staged, enZonaIds]
  );

  const rightList = useMemo(() => {
    const map = new Map();
    enZona.forEach((u) => map.set(u.id, { ...u, _pending: false }));
    staged.forEach((u) => map.set(u.id, { ...u, _pending: true }));
    return Array.from(map.values()).sort((a, b) =>
      fullName(a).localeCompare(fullName(b), "es")
    );
  }, [enZona, staged]);

  const leftVisible = useMemo(
    () => sinZona.filter((u) => matchQ(u, qLeft)),
    [sinZona, qLeft]
  );
  const rightVisible = useMemo(
    () => rightList.filter((u) => matchQ(u, qRight)),
    [rightList, qRight]
  );

  function toggleLeft(id) {
    setSelectedLeft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pasarAZona() {
    setError("");
    setMsg("");
    if (!zonaId) {
      setError("Primero selecciona la zona de destino.");
      return;
    }
    if (selectedLeft.size === 0) {
      setError("Selecciona al menos un usuario sin zona.");
      return;
    }

    const moving = sinZona.filter((u) => selectedLeft.has(u.id));
    const jefes = moving.filter((u) => u.role === "DIRECTOR_ZONA");
    if (jefes.length > 1) {
      setError("Solo puedes asignar un Jefe de Zona a la vez.");
      return;
    }
    if (
      jefes.length === 1 &&
      zonaSel?.jefe_zona &&
      zonaSel.jefe_zona.id !== jefes[0].id
    ) {
      const ok = await confirm({
        title: "Reemplazar Jefe de Zona",
        message: `La zona ya tiene jefe (${zonaSel.jefe_zona.nombre}). ¿Deseas reemplazarlo por el seleccionado?`,
        confirmLabel: "Reemplazar",
        variant: "warn",
      });
      if (!ok) return;
    }

    setStaged((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const add = moving.filter((u) => !ids.has(u.id));
      return [...prev, ...add];
    });
    setSelectedLeft(new Set());
  }

  async function quitarDeDerecha(u) {
    setError("");
    setMsg("");
    if (u._pending) {
      setStaged((prev) => prev.filter((x) => x.id !== u.id));
      return;
    }
    const ok = await confirm({
      title: "Quitar de la zona",
      message: `¿Quitar a ${fullName(u)} de «${zonaSel?.nombre || "esta zona"}»?`,
      confirmLabel: "Quitar",
      variant: "warn",
    });
    if (!ok) return;
    try {
      await estructuraApi.assignPlazasBatch({
        user_ids: [u.id],
        unassign: true,
        jurisdiccion_id: null,
      });
      setMsg(`${fullName(u)} quedó sin zona.`);
      pushHist(`Se desasignó a ${fullName(u)} de ${zonaSel?.nombre || "zona"}`);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  function pushHist(text) {
    setHistorial((h) => [
      { id: Date.now(), text, at: new Date().toLocaleString() },
      ...h,
    ].slice(0, 40));
  }

  async function confirmar() {
    setError("");
    setMsg("");
    if (!zonaId) {
      setError("Selecciona la zona de destino.");
      return;
    }
    if (staged.length === 0) {
      setError("Pasa usuarios a la zona antes de confirmar.");
      return;
    }
    setSaving(true);
    try {
      const res = await estructuraApi.assignPlazasBatch({
        user_ids: staged.map((u) => u.id),
        jurisdiccion_id: Number(zonaId),
      });
      const n = res.results?.length || 0;
      const errs = res.errors || [];
      if (errs.length) {
        setError(errs.map((e) => e.detail).join(" · "));
      }
      if (n) {
        setMsg(
          `${n} usuario(s) asignado(s) a «${zonaSel?.nombre || "la zona"}».`
        );
        pushHist(
          `Asignados ${n} a ${zonaSel?.nombre}: ${staged
            .map((u) => fullName(u))
            .join(", ")}`
        );
      }
      setStaged([]);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function actualizarZona(z) {
    setZonaId(String(z.id));
    setStaged([]);
    setSelectedLeft(new Set());
    setError("");
    setMsg(`Actualizando asignaciones de «${z.nombre}». Usa el panel de arriba.`);
    pushHist(`Modo actualizar: ${z.nombre}`);
    requestAnimationFrame(() => {
      transferRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function verPdfZona(z) {
    setError("");
    const win = window.open("about:blank", "_blank");
    setBusyId(`pdf-${z.id}`);
    try {
      const blob = await estructuraApi.jurisdiccionPersonalPdf(z.id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (win) {
        win.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) {
      if (win && !win.closed) win.close();
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function restablecerZona(z) {
    const total =
      (z.conteos?.total ?? 0) ||
      (z.conteos?.supervisores || 0) +
        (z.conteos?.detectives || 0) +
        (z.conteos?.agentes || 0) +
        (z.jefe_zona ? 1 : 0);
    if (!total) {
      setMsg(`«${z.nombre}» no tiene usuarios asignados.`);
      return;
    }
    const ok = await confirm({
      title: `¿Restablecer asignaciones de «${z.nombre}»?`,
      message:
        "Se quitará a todos los usuarios de esta zona (jefe, supervisores, detectives y agentes). La zona NO se elimina.",
      confirmLabel: "Restablecer",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(`reset-${z.id}`);
    setError("");
    try {
      const res = await estructuraApi.restablecerAsignaciones(z.id);
      setMsg(res.detail || `Asignaciones de «${z.nombre}» restablecidas.`);
      pushHist(res.detail || `Restablecidas asignaciones de ${z.nombre}`);
      if (String(zonaId) === String(z.id)) {
        setStaged([]);
        setSelectedLeft(new Set());
      }
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="az-page">
      <div className="az-toolbar" ref={transferRef}>
        <label className="az-zona-select">
          <span>Zona de destino</span>
          <select
            value={zonaId}
            onChange={(e) => {
              setZonaId(e.target.value);
              setStaged([]);
              setSelectedLeft(new Set());
              setMsg("");
              setError("");
            }}
          >
            <option value="">— Selecciona una zona —</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.tipo_label}: {z.nombre}
                {z.jefe_zona ? ` · Jefe: ${z.jefe_zona.nombre}` : " · Sin jefe"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-ghost" onClick={() => setShowHist(true)}>
          <MaterialIcon name="history" />
          Ver histórico de asignaciones
        </button>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {msg && <p className="az-ok">{msg}</p>}

      <div className="az-transfer panel-card">
        <div className="az-col">
          <div className="az-col-head">
            <h3>Usuarios (sin zona asignada)</h3>
            <span className="az-count">{leftVisible.length} usuarios</span>
          </div>
          <div className="az-search">
            <MaterialIcon name="search" />
            <input
              placeholder="Buscar usuario..."
              value={qLeft}
              onChange={(e) => setQLeft(e.target.value)}
            />
          </div>
          <ul className="az-list">
            {loading && <li className="az-empty">Cargando…</li>}
            {!loading && leftVisible.length === 0 && (
              <li className="az-empty">No hay usuarios sin zona.</li>
            )}
            {leftVisible.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className={`az-person${selectedLeft.has(u.id) ? " is-selected" : ""}`}
                  onClick={() => toggleLeft(u.id)}
                >
                  <span className="az-avatar" aria-hidden>
                    {initials(u)}
                  </span>
                  <span className="az-person-text">
                    <strong>{fullName(u)}</strong>
                    <small>{u.role_label}</small>
                  </span>
                  {selectedLeft.has(u.id) && (
                    <MaterialIcon name="check_circle" className="az-check" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="az-mid">
          <button
            type="button"
            className="az-pass"
            onClick={pasarAZona}
            disabled={!zonaId || selectedLeft.size === 0}
            title="Pasar usuario a la zona seleccionada"
          >
            <MaterialIcon name="arrow_forward" />
          </button>
          <p>Pasar usuario a la zona seleccionada</p>
        </div>

        <div className="az-col">
          <div className="az-col-head">
            <h3>
              {zonaSel
                ? `Usuarios en «${zonaSel.nombre}»`
                : "Usuarios en la zona asignada"}
            </h3>
            <span className="az-count">{loadingZona ? "Cargando…" : `${rightVisible.length} usuarios`}</span>
          </div>
          {!zonaId && (
            <p className="az-hint">Selecciona una zona arriba para ver y asignar personal.</p>
          )}
          <div className="az-search">
            <MaterialIcon name="search" />
            <input
              placeholder="Buscar usuario..."
              value={qRight}
              onChange={(e) => setQRight(e.target.value)}
              disabled={!zonaId}
            />
          </div>
          <ul className="az-list az-list-tall">
            {zonaId && loadingZona && (
              <li className="az-empty">Cargando personal de la zona…</li>
            )}
            {zonaId && !loadingZona && rightVisible.length === 0 && (
              <li className="az-empty">Zona vacía. Pasa usuarios desde la izquierda.</li>
            )}
            {rightVisible.map((u) => (
              <li key={u.id}>
                <div className={`az-person az-person-static${u._pending ? " is-pending" : ""}`}>
                  <span className="az-avatar" aria-hidden>
                    {initials(u)}
                  </span>
                  <span className="az-person-text">
                    <strong>{fullName(u)}</strong>
                    <small>
                      {u.role_label}
                      {u.jurisdiccion_nombre ? ` · ${u.jurisdiccion_nombre}` : ""}
                      {u._pending ? " · pendiente" : ""}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="az-remove"
                    title="Quitar"
                    onClick={() => quitarDeDerecha(u)}
                  >
                    <MaterialIcon name="close" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="az-actions">
        <button
          type="button"
          className="btn-accent"
          disabled={saving || staged.length === 0 || !zonaId}
          onClick={confirmar}
        >
          <MaterialIcon name="done_all" />
          {saving ? "Guardando…" : `Confirmar asignación${staged.length ? ` (${staged.length})` : ""}`}
        </button>
      </div>

      <section className="panel-card az-zonas-table">
        <h3>Zonas y líderes asignados</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Zona de trabajo</th>
              <th>Jefe / Líder de zona</th>
              <th>Supervisores</th>
              <th>Detectives</th>
              <th>Agentes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {zonas.map((z) => (
              <tr key={z.id}>
                <td>
                  <strong>{z.nombre}</strong>
                  <div className="mod-muted">
                    {z.tipo_label} · {z.codigo}
                  </div>
                </td>
                <td>
                  {z.jefe_zona ? (
                    <div className="az-jefe-cell">
                      <span className="az-avatar sm">
                        {(z.jefe_zona.nombre || "?")
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span>
                        <strong>{z.jefe_zona.nombre}</strong>
                        <div className="mod-muted">
                          {z.jefe_zona.role_label || "Jefe de Zona"}
                        </div>
                      </span>
                    </div>
                  ) : (
                    <span className="mod-muted">— Sin asignar</span>
                  )}
                </td>
                <td>{z.conteos?.supervisores ?? 0}</td>
                <td>{z.conteos?.detectives ?? 0}</td>
                <td>{z.conteos?.agentes ?? 0}</td>
                <td>
                  <div className="az-row-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      title="Actualizar asignaciones"
                      onClick={() => actualizarZona(z)}
                    >
                      <MaterialIcon name="edit" />
                      Actualizar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      title="Ver detalle en PDF"
                      disabled={busyId === `pdf-${z.id}`}
                      onClick={() => verPdfZona(z)}
                    >
                      <MaterialIcon name="picture_as_pdf" />
                      {busyId === `pdf-${z.id}` ? "PDF…" : "Ver detalles"}
                    </button>
                    <button
                      type="button"
                      className="btn-warn"
                      title="Restablecer usuarios de esta zona"
                      disabled={busyId === `reset-${z.id}`}
                      onClick={() => restablecerZona(z)}
                    >
                      <MaterialIcon name="restart_alt" />
                      {busyId === `reset-${z.id}` ? "…" : "Restablecer"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showHist && (
        <div className="modal-backdrop" onClick={() => setShowHist(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="az-hist-head">
              <h3 style={{ margin: 0 }}>Histórico de asignaciones</h3>
              <button type="button" className="btn-ghost" onClick={() => setShowHist(false)}>
                Cerrar
              </button>
            </div>
            {historial.length === 0 ? (
              <p className="mod-muted">Aún no hay movimientos en esta sesión.</p>
            ) : (
              <ul className="az-hist-list">
                {historial.map((h) => (
                  <li key={h.id}>
                    <time>{h.at}</time>
                    <span>{h.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
