import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import PaginationBar from "../../../../shared/components/PaginationBar";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../../shared/components/PaginationBar.css";
import "../DirectorZona.css";

const PAGE_SIZE = 10;

const ESTADO_TONE = {
  ACTIVO: "ok",
  FRANCO: "muted",
  VACACIONES: "info",
  CALAMIDAD: "warn",
  ARRESTO: "danger",
  PERMISO: "warn",
};

const ROLES = [
  { value: "", label: "Todos los roles" },
  { value: "AGENTE_OPERATIVO", label: "Agente Operativo" },
  { value: "SUPERVISOR_UNIDAD", label: "Supervisor de Unidad" },
  { value: "DETECTIVE", label: "Detective / Investigador" },
];

export default function PersonalPage() {
  const [tab, setTab] = useState("estado");
  const [data, setData] = useState(null);
  const [evals, setEvals] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [rol, setRol] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    supervisor_id: "",
    calificacion: 4,
    periodo: "",
    anotacion: "",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [estado, ev, sup] = await Promise.all([
        directorApi.estadoPersonal(),
        directorApi.listEvaluaciones(),
        directorApi.listSupervisores(),
      ]);
      setData(estado);
      setEvals(ev.evaluaciones || []);
      setSupervisores(sup.supervisores || []);
      if (!form.supervisor_id && sup.supervisores?.[0]) {
        setForm((f) => ({ ...f, supervisor_id: String(sup.supervisores[0].id) }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar criterios, volver a página 1
  useEffect(() => {
    setPage(1);
  }, [q, filtro, rol]);

  const filtered = useMemo(() => {
    const list = data?.personal || [];
    const term = q.trim().toLowerCase();
    return list.filter((p) => {
      if (filtro !== "TODOS" && p.estado !== filtro) return false;
      if (rol && p.rol !== rol) return false;
      if (!term) return true;
      const haystack = [
        p.nombre,
        p.email,
        p.rol_label,
        p.rol,
        p.unidad,
        p.jurisdiccion,
        p.zona,
        p.estado,
        p.estado_detalle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, filtro, rol, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  async function submitEval(e) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      await directorApi.createEvaluacion({
        supervisor_id: Number(form.supervisor_id),
        calificacion: Number(form.calificacion),
        periodo: form.periodo,
        anotacion: form.anotacion,
      });
      setOk("Evaluación registrada.");
      setForm((f) => ({ ...f, anotacion: "", periodo: "" }));
      const ev = await directorApi.listEvaluaciones();
      setEvals(ev.evaluaciones || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeEval(id) {
    if (!window.confirm("¿Eliminar esta evaluación?")) return;
    try {
      await directorApi.deleteEvaluacion(id);
      setEvals((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const resumen = data?.resumen || {};

  return (
    <div className="mod-page dir-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Gestión de Personal Regional</p>
          <h2>Disponibilidad — {data?.jurisdiccion?.nombre || "su zona"}</h2>
          <p className="mod-desc">
            Novedades del personal a su cargo y evaluación de supervisores de distrito.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      <div className="dir-tabs">
        {[
          { id: "estado", label: "Novedades del personal", icon: "badge" },
          { id: "eval", label: "Evaluación de supervisores", icon: "star" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <MaterialIcon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mod-error">{error}</p>}
      {ok && <p className="mod-success">{ok}</p>}
      {loading ? (
        <p className="mod-muted">Cargando personal…</p>
      ) : tab === "estado" ? (
        <>
          <div className="dir-kpi-grid compact">
            {[
              ["Activos hoy", resumen.ACTIVO, "ok"],
              ["Franco", resumen.FRANCO, "muted"],
              ["Vacaciones", resumen.VACACIONES, "info"],
              ["Calamidad", resumen.CALAMIDAD, "warn"],
              ["Arresto", resumen.ARRESTO, "danger"],
            ].map(([label, val, tone]) => (
              <article key={label} className={`panel-card dir-kpi tone-${tone}`}>
                <span>{label}</span>
                <strong>{val ?? 0}</strong>
              </article>
            ))}
          </div>

          <div
            className="panel-card filters-bar"
            style={{
              gridTemplateColumns: "minmax(0, 1.6fr) repeat(2, minmax(150px, 0.7fr))",
            }}
          >
            <label>
              Buscar
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, correo, rol, unidad…"
              />
            </label>
            <label>
              Rol
              <select value={rol} onChange={(e) => setRol(e.target.value)}>
                {ROLES.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="TODOS">Todos</option>
                <option value="ACTIVO">Activo</option>
                <option value="FRANCO">Franco</option>
                <option value="VACACIONES">Vacaciones</option>
                <option value="CALAMIDAD">Calamidad</option>
                <option value="ARRESTO">Arresto</option>
                <option value="PERMISO">Permiso</option>
              </select>
            </label>
          </div>

          <p className="mod-muted" style={{ margin: "0.35rem 0 0" }}>
            Disponibles para operar hoy: <strong>{data?.disponibles_hoy ?? 0}</strong> /{" "}
            {data?.total ?? 0}
            {filtered.length !== (data?.total ?? 0) && (
              <>
                {" "}
                · Coincidencias: <strong>{filtered.length}</strong>
              </>
            )}
          </p>

          <section className="panel-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                      <div className="mod-muted">{p.email}</div>
                    </td>
                    <td>{p.rol_label}</td>
                    <td>{p.unidad || p.jurisdiccion || "—"}</td>
                    <td>
                      <span className={`dir-badge tone-${ESTADO_TONE[p.estado] || "muted"}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td>{p.estado_detalle}</td>
                  </tr>
                ))}
                {!pageItems.length && (
                  <tr>
                    <td colSpan={5} className="mod-muted">
                      No hay personal con esos criterios. Prueba otro nombre, rol o estado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <PaginationBar
              page={safePage}
              totalPages={totalPages}
              count={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>
        </>
      ) : (
        <div className="dir-split">
          <form className="panel-card form-grid" onSubmit={submitEval}>
            <h3 style={{ marginTop: 0, gridColumn: "1 / -1" }}>Nueva evaluación</h3>
            <label>
              Supervisor
              <select
                required
                value={form.supervisor_id}
                onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
              >
                <option value="">Seleccione…</option>
                {supervisores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} {s.unidad ? `· ${s.unidad}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Calificación (1–5)
              <input
                type="number"
                min={1}
                max={5}
                required
                value={form.calificacion}
                onChange={(e) => setForm({ ...form, calificacion: e.target.value })}
              />
            </label>
            <label>
              Periodo
              <input
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                placeholder="2026-08 / Trimestre 3"
              />
            </label>
            <label className="full">
              Anotación de desempeño
              <textarea
                rows={4}
                value={form.anotacion}
                onChange={(e) => setForm({ ...form, anotacion: e.target.value })}
                placeholder="Fortalezas, debilidades, acuerdos de mejora…"
              />
            </label>
            <button type="submit" className="btn-accent full">
              Guardar evaluación
            </button>
          </form>

          <section className="panel-card">
            <h3 style={{ marginTop: 0 }}>Historial de evaluaciones</h3>
            <div className="dir-eval-list">
              {evals.map((e) => (
                <article key={e.id} className="dir-eval-card">
                  <div className="dir-eval-top">
                    <strong>{e.supervisor}</strong>
                    <span className="dir-badge tone-info">{e.calificacion}/5</span>
                  </div>
                  <p className="mod-muted">
                    {e.unidad || "—"} · {e.periodo || "Sin periodo"}
                  </p>
                  <p>{e.anotacion || "Sin anotación."}</p>
                  <button type="button" className="btn-ghost" onClick={() => removeEval(e.id)}>
                    Eliminar
                  </button>
                </article>
              ))}
              {!evals.length && <p className="mod-muted">Aún no hay evaluaciones registradas.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
