import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../DirectorZona.css";

export default function ReportesPage() {
  const [audiencia, setAudiencia] = useState("ALTO_MANDO");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      setPreview(
        await directorApi.reportePreview({
          audiencia,
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta,
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exportar(formato) {
    setBusy(formato);
    setError("");
    try {
      await directorApi.descargarReporte({
        formato,
        audiencia,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const resumen = preview?.resumen || {};

  return (
    <div className="mod-page dir-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Reportes y Rendición de Cuentas</p>
          <h2>Informes de zona</h2>
          <p className="mod-desc">
            Exporta estadísticas tácticas (ClickHouse) de su jurisdicción para el Alto Mando o
            autoridades civiles. Sin registro de partes: solo lectura y rendición.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={loadPreview} disabled={loading}>
          <MaterialIcon name="refresh" />
          Actualizar vista previa
        </button>
      </header>

      <div className="dir-filters panel-card">
        <label>
          Audiencia
          <select value={audiencia} onChange={(e) => setAudiencia(e.target.value)}>
            <option value="ALTO_MANDO">Alto Mando (Visor Ejecutivo)</option>
            <option value="AUTORIDADES_CIVILES">Autoridades civiles</option>
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </label>
        <button type="button" className="btn-accent" onClick={loadPreview}>
          Generar vista previa
        </button>
      </div>

      <div className="dir-export-actions">
        <button
          type="button"
          className="btn-accent"
          disabled={!!busy}
          onClick={() => exportar("pdf")}
        >
          <MaterialIcon name="picture_as_pdf" />
          {busy === "pdf" ? "Generando…" : "Exportar PDF"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!!busy}
          onClick={() => exportar("excel")}
        >
          <MaterialIcon name="table_view" />
          {busy === "excel" ? "Generando…" : "Exportar Excel"}
        </button>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Preparando informe…</p>
      ) : preview ? (
        <>
          <div className="dir-kpi-grid">
            <article className="panel-card dir-kpi">
              <span>Periodo</span>
              <strong style={{ fontSize: "1.05rem" }}>
                {preview.periodo?.fecha_desde} → {preview.periodo?.fecha_hasta}
              </strong>
              <small>{preview.jurisdiccion?.nombre}</small>
            </article>
            <article className="panel-card dir-kpi accent">
              <span>Total partes</span>
              <strong>{resumen.total_rango ?? 0}</strong>
              <small>En el rango seleccionado</small>
            </article>
            <article className="panel-card dir-kpi">
              <span>Mes actual / anterior</span>
              <strong>
                {resumen.mes_actual ?? 0} / {resumen.mes_anterior ?? 0}
              </strong>
              <small>Comparativo calendario</small>
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
                  {(preview.por_tipo || []).map((r) => (
                    <tr key={r.tipo_delito}>
                      <td>{r.tipo_delito}</td>
                      <td>{r.total}</td>
                    </tr>
                  ))}
                  {!preview.por_tipo?.length && (
                    <tr>
                      <td colSpan={2} className="mod-muted">
                        Sin datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <section className="panel-card">
              <h3>Por distrito</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Distrito</th>
                    <th>Partes</th>
                    <th>Críticos</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.por_distrito || []).map((r) => (
                    <tr key={r.distrito}>
                      <td>{r.distrito}</td>
                      <td>{r.total_partes}</td>
                      <td>{r.criticos}</td>
                    </tr>
                  ))}
                  {!preview.por_distrito?.length && (
                    <tr>
                      <td colSpan={3} className="mod-muted">
                        Sin datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
