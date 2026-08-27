import { useCallback, useEffect, useState } from "react";
import { visorIndicadoresApi } from "../../api";
import "./FichaTecnica.css";
import "./FichaTecnicaDark.css";

function pctClass(n) {
  if (n >= 5) return "up";
  if (n <= -5) return "down";
  return "flat";
}

function Semaforo({ data }) {
  if (!data) return null;
  return (
    <div className={`ft-semaforo tone-${data.tono}`}>
      <div className="ft-semaforo-lights" aria-hidden>
        <span className={data.nivel === "ROJO" ? "on" : ""} />
        <span className={data.nivel === "AMARILLO" ? "on" : ""} />
        <span className={data.nivel === "VERDE" ? "on" : ""} />
      </div>
      <div>
        <strong>Semáforo de Estrés Operativo · {data.nivel}</strong>
        <p>{data.mensaje}</p>
        <small>
          Ratio {data.ratio} delitos/agente · {data.delitos_semana} delitos ·{" "}
          {data.agentes_operativos} agentes
        </small>
      </div>
    </div>
  );
}

function CadenaMando({ data }) {
  const [open, setOpen] = useState({ s: true, d: false, a: false });
  if (!data) return null;
  const jefe = data.jefe_zona;

  return (
    <div className="ft-tree">
      <div className="ft-tree-root">
        <span className="material-symbols-outlined">shield_person</span>
        <div>
          <em>Jefe de Zona</em>
          <strong>{jefe?.nombre || "Sin asignar"}</strong>
          {jefe?.email && <small>{jefe.email}</small>}
        </div>
      </div>

      <div className="ft-tree-branches">
        {[
          { key: "s", label: "Supervisores", icon: "supervisor_account", items: data.supervisores, n: data.conteos.supervisores },
          { key: "d", label: "Detectives", icon: "person_search", items: data.detectives, n: data.conteos.detectives },
          { key: "a", label: "Agentes", icon: "badge", items: data.agentes, n: data.conteos.agentes },
        ].map((branch) => (
          <div key={branch.key} className="ft-branch">
            <button
              type="button"
              className="ft-branch-head"
              onClick={() => setOpen((o) => ({ ...o, [branch.key]: !o[branch.key] }))}
            >
              <span className="material-symbols-outlined">{branch.icon}</span>
              <strong>{branch.label}</strong>
              <em>{branch.n}</em>
              <span className="material-symbols-outlined ft-chevron">
                {open[branch.key] ? "expand_less" : "expand_more"}
              </span>
            </button>
            {open[branch.key] && (
              <ul>
                {branch.items.length === 0 && <li className="ft-empty">Sin personal registrado</li>}
                {branch.items.map((u) => (
                  <li key={u.id}>
                    <strong>{u.nombre}</strong>
                    <span>{u.unidad || u.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FichaDetalle({ ficha, onBack, loading }) {
  if (loading) {
    return <p className="ft-loading">Cargando radiografía de la zona…</p>;
  }
  if (!ficha) return null;

  const { zona, carga_laboral: carga, tasa_resolucion: tasa, flota, sla_respuesta: sla } = ficha;

  return (
    <div className="ft-ficha">
      <div className="ft-ficha-head">
        <button type="button" className="ft-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>
          Volver a zonas
        </button>
        <div>
          <p className="ft-kicker">Expediente jurisdiccional</p>
          <h3>{zona.nombre}</h3>
          <small>Código {zona.codigo || "—"}</small>
        </div>
      </div>

      <Semaforo data={ficha.semaforo_estres} />

      <div className="ft-grid">
        <article className="ft-card ft-span-2">
          <header>
            <span className="material-symbols-outlined">account_tree</span>
            <h4>Cadena de Mando</h4>
          </header>
          <CadenaMando data={ficha.cadena_mando} />
        </article>

        <article className="ft-card">
          <header>
            <span className="material-symbols-outlined">folder_open</span>
            <h4>Carga Laboral</h4>
          </header>
          <div className="ft-metric-big">
            <strong>{carga.esta_semana}</strong>
            <span>
              {carga.ventana === "30d" ? "Partes últimos 30 días" : "Partes esta semana"}
            </span>
          </div>
          <div className="ft-compare">
            <div>
              <em>Semana pasada</em>
              <strong>{carga.semana_pasada}</strong>
            </div>
            <div className={`ft-delta ${pctClass(carga.variacion_pct)}`}>
              {carga.variacion_pct > 0 ? "+" : ""}
              {carga.variacion_pct}%
            </div>
          </div>
          <p className="ft-hint">
            Periodo {carga.desde} ? {carga.hasta}
          </p>
        </article>

        <article className="ft-card">
          <header>
            <span className="material-symbols-outlined">crisis_alert</span>
            <h4>Tasa de Resolución</h4>
          </header>
          <div className="ft-metric-big">
            <strong>{tasa.tasa_pct}%</strong>
            <span>Casos resueltos</span>
          </div>
          <ul className="ft-stat-list">
            <li>
              <span>Asignados</span>
              <strong>{tasa.asignados}</strong>
            </li>
            <li>
              <span>Resueltos</span>
              <strong>{tasa.resueltos}</strong>
            </li>
            <li>
              <span>Pendientes</span>
              <strong>{tasa.pendientes}</strong>
            </li>
          </ul>
          <p className="ft-hint">{tasa.criterio}</p>
        </article>

        <article className="ft-card">
          <header>
            <span className="material-symbols-outlined">local_police</span>
            <h4>Estado de Fuerza Logística</h4>
          </header>
          <div className="ft-metric-big">
            <strong>{flota.asignados}</strong>
            <span>Patrulleros asignados</span>
          </div>
          <div className="ft-fleet-bars">
            <div>
              <span>Operativos</span>
              <strong className="good">{flota.operativos}</strong>
            </div>
            <div>
              <span>En taller</span>
              <strong className="warn">{flota.en_taller}</strong>
            </div>
          </div>
          <p className="ft-hint">{flota.label}</p>
        </article>

        <article className="ft-card">
          <header>
            <span className="material-symbols-outlined">timer</span>
            <h4>Tiempos de Respuesta (SLA)</h4>
          </header>
          <div className="ft-metric-big">
            <strong>
              {sla.promedio_dias != null ? `${sla.promedio_dias} d` : "—"}
            </strong>
            <span>Promedio aprobación de partes</span>
          </div>
          {sla.cuello_botella && (
            <p className="ft-alert">Cuello de botella detectado (= 3 días)</p>
          )}
          <p className="ft-hint">{sla.mensaje}</p>
          <small className="ft-hint">Muestra: {sla.muestra} partes</small>
        </article>
      </div>
    </div>
  );
}

export default function Page() {
  const [zonas, setZonas] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setError("");
      try {
        const data = await visorIndicadoresApi.zonas();
        if (!cancelled) setZonas(data.results || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudieron cargar las zonas");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openFicha = useCallback(async (id) => {
    setSelectedId(id);
    setLoadingFicha(true);
    setFicha(null);
    setError("");
    try {
      const data = await visorIndicadoresApi.ficha(id);
      setFicha(data);
    } catch (err) {
      setError(err.message || "No se pudo abrir la ficha");
      setSelectedId(null);
    } finally {
      setLoadingFicha(false);
    }
  }, []);

  const filtered = zonas.filter((z) => {
    const hay = `${z.nombre} ${z.codigo || ""} ${z.jefe_zona?.nombre || ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="ft-page">
      <header className="ft-head">
        <div>
          <h2>Ficha Técnica de Jurisdicción</h2>
          <p className="ft-sub">
            Expediente operativo por zona: cadena de mando, carga laboral, resolución,
            flota, SLA y semáforo de estrés.
          </p>
        </div>
      </header>

      {error && <p className="ft-error">{error}</p>}

      {selectedId ? (
        <FichaDetalle
          ficha={ficha}
          loading={loadingFicha}
          onBack={() => {
            setSelectedId(null);
            setFicha(null);
          }}
        />
      ) : (
        <section className="ft-list-wrap">
          <div className="ft-list-toolbar">
            <label>
              Buscar zona
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej. Zona 8 - Guayas"
              />
            </label>
            <span className="ft-count">
              {loadingList ? "Cargando…" : `${filtered.length} zona(s)`}
            </span>
          </div>

          <div className="ft-table-scroll">
            <table className="ft-table">
              <thead>
                <tr>
                  <th>Zona</th>
                  <th>Código</th>
                  <th>Jefe de Zona</th>
                  <th>Personal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loadingList && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="ft-empty-row">
                      No hay zonas registradas o no coinciden con la búsqueda.
                    </td>
                  </tr>
                )}
                {filtered.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <strong>{z.nombre}</strong>
                    </td>
                    <td>{z.codigo || "—"}</td>
                    <td>{z.jefe_zona?.nombre || "Sin asignar"}</td>
                    <td>{z.personal_count}</td>
                    <td>
                      <button
                        type="button"
                        className="ft-open"
                        onClick={() => openFicha(z.id)}
                      >
                        Abrir radiografía
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
