import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "leaflet/dist/leaflet.css";
import "../DirectorZona.css";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

function heatColor(peso, max) {
  const t = max > 0 ? Math.min(1, peso / max) : 0.3;
  if (t > 0.7) return "#b91c1c";
  if (t > 0.4) return "#ea580c";
  return "#2f4d8a";
}

export default function InteligenciaPage() {
  const [tab, setTab] = useState("indicadores");
  const [stats, setStats] = useState(null);
  const [desglose, setDesglose] = useState(null);
  const [mapa, setMapa] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const range = {};
    if (fechaDesde) range.fecha_desde = fechaDesde;
    if (fechaHasta) range.fecha_hasta = fechaHasta;
    try {
      const [s, d, m, r] = await Promise.all([
        directorApi.estadisticas(),
        directorApi.delitosDesglose(range),
        directorApi.mapaCalor({ ...range, limit: 2000 }),
        directorApi.rankingDistritos(range),
      ]);
      setStats(s);
      setDesglose(d);
      setMapa(m);
      setRanking(r);
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

  const puntos = mapa?.puntos || [];
  const maxPeso = useMemo(
    () => puntos.reduce((acc, p) => Math.max(acc, p.peso || 0), 1),
    [puntos]
  );
  const mapPoints = useMemo(
    () => puntos.map((p) => [p.latitud, p.longitud]),
    [puntos]
  );
  const zonaNombre = stats?.jurisdiccion?.nombre || "su jurisdicción";

  return (
    <div className="mod-page dir-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Inteligencia Táctica</p>
          <h2>Dashboard regional — {zonaNombre}</h2>
          <p className="mod-desc">
            Indicadores, mapa de calor y ranking operativo filtrados exclusivamente a su zona.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load} disabled={loading}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      <div className="dir-filters panel-card">
        <label>
          Desde
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </label>
        <button type="button" className="btn-accent" onClick={load}>
          Aplicar rango
        </button>
      </div>

      <div className="dir-tabs">
        {[
          { id: "indicadores", label: "Delitos locales", icon: "monitoring" },
          { id: "mapa", label: "Mapa de calor", icon: "map" },
          { id: "ranking", label: "Ranking distritos", icon: "leaderboard" },
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
      {loading ? (
        <p className="mod-muted">Cargando inteligencia táctica…</p>
      ) : (
        <>
          {tab === "indicadores" && (
            <>
              <div className="dir-kpi-grid">
                <article className="panel-card dir-kpi">
                  <span>Mes actual</span>
                  <strong>{stats?.mes_actual ?? 0}</strong>
                  <small>{stats?.periodo?.mes_actual}</small>
                </article>
                <article className="panel-card dir-kpi">
                  <span>Mes anterior</span>
                  <strong>{stats?.mes_anterior ?? 0}</strong>
                  <small>{stats?.periodo?.mes_anterior}</small>
                </article>
                <article className="panel-card dir-kpi accent">
                  <span>Variación</span>
                  <strong>
                    {stats?.variacion_pct == null ? "—" : `${stats.variacion_pct}%`}
                  </strong>
                  <small>Δ {stats?.delta ?? 0} partes</small>
                </article>
              </div>

              <div className="dir-split">
                <section className="panel-card">
                  <h3>Por tipo de delito</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Delito</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(desglose?.por_tipo || []).map((row) => (
                        <tr key={row.tipo_delito}>
                          <td>{row.tipo_delito}</td>
                          <td>{row.total}</td>
                        </tr>
                      ))}
                      {!desglose?.por_tipo?.length && (
                        <tr>
                          <td colSpan={2} className="mod-muted">
                            Sin datos en el rango.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
                <section className="panel-card">
                  <h3>Por distrito / circuito</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Distrito</th>
                        <th>Delito</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(desglose?.por_distrito || []).map((row, i) => (
                        <tr key={`${row.distrito}-${row.tipo_delito}-${i}`}>
                          <td>{row.distrito}</td>
                          <td>{row.tipo_delito}</td>
                          <td>{row.total}</td>
                        </tr>
                      ))}
                      {!desglose?.por_distrito?.length && (
                        <tr>
                          <td colSpan={3} className="mod-muted">
                            Sin datos en el rango.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>
            </>
          )}

          {tab === "mapa" && (
            <section className="panel-card dir-map-card">
              <h3>Zonas calientes — {mapa?.total_puntos ?? 0} focos</h3>
              <div className="dir-map-wrap">
                <MapContainer
                  center={mapPoints[0] || [-0.18, -78.47]}
                  zoom={12}
                  className="dir-map"
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={mapPoints} />
                  {puntos.map((p, idx) => (
                    <CircleMarker
                      key={`${p.latitud}-${p.longitud}-${idx}`}
                      center={[p.latitud, p.longitud]}
                      radius={8 + Math.min(18, (p.peso / maxPeso) * 18)}
                      pathOptions={{
                        color: heatColor(p.peso, maxPeso),
                        fillColor: heatColor(p.peso, maxPeso),
                        fillOpacity: 0.55,
                        weight: 1,
                      }}
                    >
                      <Popup>
                        <strong>{p.tipo_delito || "Delito"}</strong>
                        <br />
                        Peso: {p.peso}
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              {!puntos.length && (
                <p className="mod-muted">No hay coordenadas en el rango seleccionado.</p>
              )}
            </section>
          )}

          {tab === "ranking" && (
            <section className="panel-card">
              <h3>Productividad interna por distrito</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Distrito</th>
                    <th>Partes</th>
                    <th>Críticos</th>
                    <th>Tipos delito</th>
                    <th>Agentes</th>
                  </tr>
                </thead>
                <tbody>
                  {(ranking?.ranking || []).map((row) => (
                    <tr key={row.distrito}>
                      <td>{row.posicion}</td>
                      <td>{row.distrito}</td>
                      <td>{row.total_partes}</td>
                      <td>{row.partes_criticos ?? 0}</td>
                      <td>{row.tipos_delito}</td>
                      <td>{row.agentes_reportantes ?? "—"}</td>
                    </tr>
                  ))}
                  {!ranking?.ranking?.length && (
                    <tr>
                      <td colSpan={6} className="mod-muted">
                        Sin ranking disponible.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
