import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { saasApi } from "../../../../saas/api";
import "../../../../shared/styles/ModuloPage.css";
import "../../../../saas/CommercialSuite.css";

function money(v) {
  return Number(v || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setStats(await saasApi.estadisticas());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpis = stats?.kpis || {};
  const tenants = stats?.tenants || [];

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Plataforma SaaS</p>
          <h2>Overview de tenants</h2>
          <p className="mod-desc">
            MRR simulado, instituciones afiliadas y estado de pago.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando estadísticas…</p>
      ) : (
        <>
          <div className="ct-sa-kpis" style={{ marginBottom: "1rem" }}>
            <article>
              <span>MRR</span>
              <strong>{money(kpis.mrr)}</strong>
              <small>Ingresos mensuales recurrentes</small>
            </article>
            <article>
              <span>Instituciones activas</span>
              <strong>{kpis.instituciones_activas ?? 0}</strong>
              <small>de {kpis.instituciones_totales ?? 0} totales</small>
            </article>
            <article>
              <span>Usuarios totales</span>
              <strong>{kpis.usuarios_totales ?? 0}</strong>
              <small>Excepto SuperAdmin</small>
            </article>
          </div>

          <section className="panel-card">
            <h3 style={{ marginTop: 0 }}>Tenants afiliados</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong>{t.nombre_comercial}</strong>
                      <div className="mod-muted">{t.ruc}</div>
                    </td>
                    <td>{t.plan_actual}</td>
                    <td>
                      <span
                        className={`pill ${
                          t.estado_pago === "SUSPENDIDO" ? "bad" : "ok"
                        }`}
                      >
                        {t.estado_pago_label || t.estado_pago}
                      </span>
                    </td>
                    <td>{t.usuarios_count}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setSelected(t)}
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {selected && (
        <div className="ct-drawer" role="dialog">
          <div className="ct-drawer-card">
            <header>
              <h3>{selected.nombre_comercial}</h3>
              <button type="button" onClick={() => setSelected(null)}>
                <MaterialIcon name="close" />
              </button>
            </header>
            <dl>
              <div>
                <dt>RUC</dt>
                <dd>{selected.ruc}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>{selected.plan_actual}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{selected.estado_pago_label}</dd>
              </div>
              <div>
                <dt>Admin</dt>
                <dd>{selected.admin_email || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
