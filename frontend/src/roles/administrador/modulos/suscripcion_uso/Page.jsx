import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useTheme } from "../../../../shared/theme/ThemeContext";
import { suscripcionApi } from "../../api";
import "./SuscripcionUso.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function formatMoney(n) {
  return Number(n || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatDay(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function badgeClass(estadoUi) {
  if (estadoUi === "PAGADO") return "su-badge ok";
  if (estadoUi === "PENDIENTE") return "su-badge warn";
  if (estadoUi === "VENCIDA") return "su-badge danger";
  return "su-badge muted";
}

function UsoChart({ uso, isDark }) {
  const tick = isDark ? "#9ca3af" : "#6b7280";
  const grid = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.22)";

  const labels = (uso?.labels || []).map(formatDay);
  const series = uso?.series || [];

  const palette = [
    {
      border: "#7c5cbf",
      fill: "rgba(124, 92, 191, 0.35)",
    },
    {
      border: "#38bdf8",
      fill: "rgba(56, 189, 248, 0.28)",
    },
    {
      border: "#34d399",
      fill: "rgba(52, 211, 153, 0.22)",
    },
  ];

  const data = useMemo(
    () => ({
      labels,
      datasets: series.map((s, i) => {
        const colors = palette[i % palette.length];
        const isNivel = s.modo === "nivel" || s.key === "usuarios_activos";
        return {
          label: s.label,
          data: s.data,
          borderColor: colors.border,
          backgroundColor: colors.fill,
          // No apilar: partes (acum.) y usuarios (nivel) son métricas distintas
          fill: true,
          tension: isNivel ? 0.15 : 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          order: isNivel ? 1 : 2,
        };
      }),
    }),
    [labels, series]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: isDark ? "#e5e7eb" : "#374151",
            usePointStyle: true,
            boxWidth: 8,
            font: { weight: "600", size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString("es-EC")}`,
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { display: false },
          ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          border: { display: false },
        },
        y: {
          stacked: false,
          beginAtZero: true,
          title: {
            display: true,
            text: "Uso de la institución",
            color: tick,
            font: { size: 11, weight: "600" },
          },
          grid: { color: grid, drawBorder: false },
          ticks: { color: tick },
          border: { display: false },
        },
      },
    }),
    [isDark, tick, grid]
  );

  return (
    <div className="su-chart-box">
      <Line data={data} options={options} />
    </div>
  );
}

function CancelModal({ open, onClose, onConfirm, loading, accesoHasta }) {
  if (!open) return null;
  return (
    <div className="su-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="su-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="su-cancel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <MaterialIcon name="warning" />
          <h3 id="su-cancel-title">¿Cancelar suscripción?</h3>
        </header>
        <p>
          Tu plan dejará de renovarse automáticamente. Conservarás el acceso completo
          hasta la fecha de corte
          {accesoHasta ? (
            <>
              {" "}
              (<strong>{formatDate(accesoHasta)}</strong>)
            </>
          ) : null}
          .
        </p>
        <footer>
          <button type="button" className="su-btn ghost" onClick={onClose} disabled={loading}>
            Mantener plan
          </button>
          <button
            type="button"
            className="su-btn danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function Page() {
  const { isDark } = useTheme();
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async (d = dias) => {
    setLoading(true);
    setError("");
    try {
      const res = await suscripcionApi.dashboard({ dias: d });
      setData(res);
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel de suscripción.");
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => {
    load(dias);
  }, [dias, load]);

  async function confirmCancel() {
    setCancelling(true);
    try {
      const res = await suscripcionApi.cancelar({
        confirmacion: true,
        motivo: "Cancelación desde panel Suscripción y Uso",
      });
      setToast(res.detail || "Cancelación registrada.");
      setModalOpen(false);
      await load(dias);
    } catch (err) {
      setError(err.message || "No se pudo cancelar la suscripción.");
    } finally {
      setCancelling(false);
    }
  }

  async function downloadPdf(factura) {
    if (factura.demo || factura.id < 0) {
      setToast("Factura de demostración: sin PDF real.");
      return;
    }
    try {
      const blob = await suscripcionApi.facturaPdf(factura.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${factura.numero || `factura_${factura.id}`}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "No se pudo descargar el PDF.");
    }
  }

  const plan = data?.plan;
  const facturas = data?.facturas || [];

  return (
    <div className="su-page">
      <header className="su-hero">
        <div>
          <p className="su-kicker">Facturación institucional</p>
          <h2>Suscripción y Uso</h2>
          <p className="su-sub">
            Gestiona tu plan, revisa el consumo acumulado y descarga tus facturas.
          </p>
        </div>
        {data?.institucion?.nombre ? (
          <div className="su-tenant-pill">
            <MaterialIcon name="apartment" />
            <span>{data.institucion.nombre}</span>
          </div>
        ) : null}
      </header>

      {toast ? (
        <div className="su-toast" role="status">
          <MaterialIcon name="check_circle" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast("")} aria-label="Cerrar">
            <MaterialIcon name="close" />
          </button>
        </div>
      ) : null}

      {error ? <div className="su-error">{error}</div> : null}
      {loading && !data ? (
        <div className="su-loading">Cargando panel…</div>
      ) : (
        <div className="su-grid">
          {/* Sección A — Plan actual */}
          <article className="su-card su-plan" id="plan">
            <header>
              <span className="material-symbols-outlined">workspace_premium</span>
              <h3>Plan actual</h3>
            </header>
            {plan ? (
              <>
                <div className="su-plan-main">
                  <div>
                    <p className="su-plan-name">{plan.nombre}</p>
                    <p className="su-plan-meta">
                      Estado: <strong>{plan.estado_label}</strong>
                      {plan.cancelacion_solicitada ? (
                        <em className="su-cancel-flag"> · Cancelación programada</em>
                      ) : null}
                    </p>
                  </div>
                  <div className="su-price">
                    <strong>{formatMoney(plan.precio)}</strong>
                    <span>/{plan.periodo_label?.toLowerCase() || "mes"}</span>
                  </div>
                </div>
                <ul className="su-plan-stats">
                  <li>
                    <span>Próximo cobro</span>
                    <strong>{formatDate(plan.proxima_renovacion)}</strong>
                  </li>
                  <li>
                    <span>Usuarios</span>
                    <strong>
                      {plan.usuarios_activos}
                      {plan.limite_usuarios != null ? ` / ${plan.limite_usuarios}` : ""}
                    </strong>
                  </li>
                  <li>
                    <span>Partes este mes</span>
                    <strong>{plan.partes_mes ?? 0}</strong>
                  </li>
                </ul>
                {plan.cancelacion_solicitada ? (
                  <p className="su-hint warn">
                    Acceso vigente hasta {formatDate(plan.acceso_hasta)}. No se renovará
                    automáticamente.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="su-btn danger outline"
                    onClick={() => setModalOpen(true)}
                  >
                    <MaterialIcon name="cancel" />
                    Cancelar Suscripción
                  </button>
                )}
              </>
            ) : (
              <p className="su-hint">No hay plan asignado a esta institución.</p>
            )}
          </article>

          {/* Sección B — Diagrama de uso */}
          <article className="su-card su-usage su-span-2" id="uso">
            <header className="su-usage-head">
              <div>
                <span className="material-symbols-outlined">area_chart</span>
                <h3>Diagrama de uso</h3>
              </div>
              <div className="su-range">
                <label htmlFor="su-dias">Periodo</label>
                <select
                  id="su-dias"
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                >
                  <option value={7}>Últimos 7 días</option>
                  <option value={30}>Últimos 30 días</option>
                </select>
              </div>
            </header>
            <p className="su-hint">
              Consumo de <strong>tu institución</strong>
              {data?.uso?.resumen?.usuarios_activos != null
                ? ` · ${data.uso.resumen.usuarios_activos} usuario(s) activo(s)`
                : ""}
              {data?.uso?.fuente === "demo" ? " · datos de demostración" : ""}.
            </p>
            <UsoChart uso={data?.uso} isDark={isDark} />
          </article>

          {/* Sección C — Historial de pagos */}
          <article className="su-card su-span-3" id="facturas">
            <header>
              <span className="material-symbols-outlined">receipt_long</span>
              <h3>Historial de pagos</h3>
            </header>
            <div className="su-table-wrap">
              <table className="su-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="su-empty">
                        Sin facturas registradas.
                      </td>
                    </tr>
                  ) : (
                    facturas.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.numero}</strong>
                          {f.plan ? <small>{f.plan}</small> : null}
                        </td>
                        <td>{formatDate(f.fecha)}</td>
                        <td>{formatMoney(f.monto)}</td>
                        <td>
                          <span className={badgeClass(f.estado_ui)}>{f.estado_ui}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="su-icon-btn"
                            title="Descargar PDF"
                            onClick={() => downloadPdf(f)}
                          >
                            <MaterialIcon name="download" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}

      <CancelModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmCancel}
        loading={cancelling}
        accesoHasta={plan?.acceso_hasta}
      />
    </div>
  );
}
