import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { fiscalApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Bandeja.css";

const NOTAS_MAX = 500;

function fmtFecha(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function badgeClass(estado) {
  if (estado === "PENDIENTE_FISCAL") return "is-pendiente";
  if (estado === "DESPACHO_ADMIN") return "is-despacho";
  if (estado === "EN_INVESTIGACION") return "is-investiga";
  return "is-cerrado";
}

function badgeLabel(estado, label) {
  if (estado === "PENDIENTE_FISCAL") return "Pendiente de revisión";
  if (estado === "DESPACHO_ADMIN") return "Despacho administrativo";
  if (estado === "EN_INVESTIGACION") return "En investigación";
  return label || estado;
}

export default function BandejaPage({ historial = false }) {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ detectives: [] });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [q, setQ] = useState("");
  const [detectiveId, setDetectiveId] = useState("");
  const [notas, setNotas] = useState("");
  const [opcion, setOpcion] = useState("B"); // A | B
  const [relatoOpen, setRelatoOpen] = useState(true);

  const [pdfBusyId, setPdfBusyId] = useState(null);

  const estadoFilter = historial ? "mios" : "pendientes";

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        fiscalApi.listCasos({ estado: estadoFilter }),
        fiscalApi.meta(),
      ]);
      const rows = Array.isArray(list) ? list : [];
      setItems(rows);
      setMeta(m || { detectives: [] });
      setSelected((prev) => {
        if (!prev) return prev;
        return rows.find((x) => x.id === prev.id) || null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoFilter]);

  const detectives = useMemo(() => meta.detectives || [], [meta]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => {
      const r = c.parte_resumen || {};
      const blob = [
        r.numero_caso,
        r.titulo,
        r.tipo_delito,
        r.lugar,
        r.sector_zona,
        r.creado_por?.nombre,
        c.estado_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(term);
    });
  }, [items, q]);

  function selectCaso(c) {
    setSelected(c);
    setOk("");
    setError("");
    setNotas("");
    setDetectiveId("");
    setOpcion("B");
    setRelatoOpen(true);
  }

  async function abrirPdf(caso, e) {
    e?.stopPropagation?.();
    if (!caso?.id) return;
    const win = window.open("about:blank", "_blank");
    setPdfBusyId(caso.id);
    setError("");
    try {
      const blob = await fiscalApi.fetchPartePdf(caso.id);
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
      setError(err.message || "No se pudo abrir el PDF");
    } finally {
      setPdfBusyId(null);
    }
  }

  async function confirmarDecision() {
    if (!selected || selected.estado !== "PENDIENTE_FISCAL") return;

    if (opcion === "A") {
      const yes = await confirm({
        title: "Despacho administrativo",
        message:
          "¿Confirmas resolver este parte por vía administrativa (delito menor / contravención)?",
        confirmLabel: "Confirmar decisión",
        variant: "warn",
      });
      if (!yes) return;
      setBusy(true);
      setError("");
      try {
        await fiscalApi.despachoAdmin(selected.id, { notas });
        setOk("Caso despachado por vía administrativa.");
        setSelected(null);
        setNotas("");
        await load(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!detectiveId) {
      setError("Selecciona un detective para asignar el caso.");
      return;
    }
    const det = detectives.find((d) => String(d.id) === String(detectiveId));
    const yes = await confirm({
      title: "Abrir investigación",
      message: `¿Abrir indagación previa y asignar el caso a ${det?.nombre || "el detective"}?`,
      confirmLabel: "Confirmar decisión",
      variant: "danger",
    });
    if (!yes) return;
    setBusy(true);
    setError("");
    try {
      const res = await fiscalApi.abrirInvestigacion(selected.id, {
        detective: Number(detectiveId),
        notas,
      });
      setOk(
        `Investigación abierta. Expediente ${res.expediente_numero || res.expediente_id}. Detective notificado.`
      );
      setSelected(null);
      setNotas("");
      setDetectiveId("");
      await load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const puedeDecidir =
    selected?.estado === "PENDIENTE_FISCAL" && !historial;

  return (
    <div className="mod-page fiscal-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Fiscalía de Turno</p>
          <h2>{historial ? "Historial de decisiones" : "Bandeja de partes"}</h2>
          <p className="mod-desc">
            {historial
              ? "Casos en los que ya tomaste una decisión jurídica."
              : "Partes aprobados por el supervisor. Lee el documento y decide el camino procesal."}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => load()}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {ok && <p className="mod-ok">{ok}</p>}

      <div className="fiscal-layout">
        <section className="panel-card fiscal-list">
          <div className="fiscal-search">
            <MaterialIcon name="search" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por caso, título, delito o ubicación…"
              aria-label="Filtrar partes"
            />
            {q && (
              <button
                type="button"
                className="fiscal-search-clear"
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
              >
                <MaterialIcon name="close" />
              </button>
            )}
          </div>

          {loading ? (
            <p className="mod-muted fiscal-empty">Cargando…</p>
          ) : !filtered.length ? (
            <p className="mod-muted fiscal-empty">
              {q
                ? "Ningún parte coincide con la búsqueda."
                : historial
                  ? "Aún no tienes decisiones registradas."
                  : "No hay partes pendientes."}
            </p>
          ) : (
            <div className="fiscal-rows">
              {filtered.map((c) => {
                const r = c.parte_resumen || {};
                const active = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`fiscal-card ${active ? "is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectCaso(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectCaso(c);
                      }
                    }}
                  >
                    <span className="fiscal-card-ico" aria-hidden>
                      <MaterialIcon name="description" />
                    </span>
                    <span className="fiscal-card-body">
                      <span className="fiscal-card-top">
                        <strong>
                          {r.numero_caso || `Parte #${r.id || c.id}`}
                        </strong>
                        <span className={`fiscal-dot ${badgeClass(c.estado)}`} />
                      </span>
                      <span className="fiscal-card-title">
                        {r.titulo || r.tipo_delito || "Sin título"}
                      </span>
                      <span className="fiscal-card-meta">
                        {fmtFecha(c.creado_en || r.aprobado_en)} ·{" "}
                        {r.creado_por?.nombre || "Agente"}
                      </span>
                    </span>
                    <span className="fiscal-card-aside">
                      <span className={`fiscal-badge ${badgeClass(c.estado)}`}>
                        {badgeLabel(c.estado, c.estado_label)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <footer className="fiscal-list-foot">
            Mostrando {filtered.length} de {items.length} parte
            {items.length === 1 ? "" : "s"}
            {q ? " (filtrado)" : ""}
          </footer>
        </section>

        <aside className="panel-card fiscal-detail">
          {!selected ? (
            <div className="fiscal-empty-detail">
              <MaterialIcon name="gavel" />
              <p>Selecciona un parte de la bandeja para revisar y decidir.</p>
            </div>
          ) : (
            <>
              <div className="fiscal-detail-head">
                <span className="fiscal-shield" aria-hidden>
                  <MaterialIcon name="shield" />
                </span>
                <div className="fiscal-detail-head-text">
                  <p className="fiscal-eyebrow">Parte policial</p>
                  <h3>
                    {selected.parte_resumen?.titulo || "Sin título"}
                  </h3>
                  <p className="mod-muted">
                    {selected.parte_resumen?.numero_caso || `#${selected.parte_resumen?.id}`}
                    {" · "}
                    {selected.parte_resumen?.tipo_delito || "Sin tipificación"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost fiscal-detail-pdf"
                  disabled={pdfBusyId === selected.id}
                  onClick={(e) => abrirPdf(selected, e)}
                >
                  <MaterialIcon name="picture_as_pdf" />
                  {pdfBusyId === selected.id ? "Abriendo…" : "Ver PDF"}
                </button>
              </div>

              <div className="fiscal-meta-grid">
                <p>
                  <MaterialIcon name="place" />
                  <span>
                    {selected.parte_resumen?.lugar || "—"}
                    {selected.parte_resumen?.sector_zona
                      ? ` · ${selected.parte_resumen.sector_zona}`
                      : ""}
                  </span>
                </p>
                <p>
                  <MaterialIcon name="badge" />
                  <span>
                    Agente: {selected.parte_resumen?.creado_por?.nombre || "—"}
                  </span>
                </p>
                <p>
                  <MaterialIcon name="flag" />
                  <span>
                    Prioridad:{" "}
                    <strong>{selected.parte_resumen?.prioridad || "—"}</strong>
                  </span>
                </p>
              </div>

              {(selected.parte?.descripcion || selected.parte?.relato_hechos) && (
                <div className="fiscal-relato">
                  <button
                    type="button"
                    className="fiscal-relato-toggle"
                    onClick={() => setRelatoOpen((v) => !v)}
                  >
                    <span>Relato / hechos</span>
                    <MaterialIcon name={relatoOpen ? "expand_less" : "expand_more"} />
                  </button>
                  {relatoOpen && (
                    <p className="fiscal-relato-body">
                      {selected.parte.descripcion || selected.parte.relato_hechos}
                    </p>
                  )}
                </div>
              )}

              {puedeDecidir ? (
                <div className="fiscal-actions">
                  <label className="fiscal-notas">
                    <span className="fiscal-notas-label">
                      Notas / fundamento jurídico
                      <em>
                        {notas.length}/{NOTAS_MAX}
                      </em>
                    </span>
                    <textarea
                      rows={3}
                      maxLength={NOTAS_MAX}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Motiva tu decisión jurídica…"
                    />
                  </label>

                  <p className="fiscal-opciones-label">Opciones de decisión</p>

                  <button
                    type="button"
                    className={`fiscal-option ${opcion === "A" ? "is-selected" : ""}`}
                    onClick={() => setOpcion("A")}
                  >
                    <span className="fiscal-option-radio" />
                    <span>
                      <strong>Opción A · Despacho administrativo</strong>
                      <small>Delito menor / contravención — vía rápida administrativa.</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`fiscal-option ${opcion === "B" ? "is-selected" : ""}`}
                    onClick={() => setOpcion("B")}
                  >
                    <span className="fiscal-option-radio" />
                    <span>
                      <strong>Opción B · Abrir investigación y asignar detective</strong>
                      <small>Delito grave — indagación previa con expediente en MinIO.</small>
                    </span>
                  </button>

                  {opcion === "B" && (
                    <label className="fiscal-detective">
                      Detective a asignar
                      <select
                        value={detectiveId}
                        onChange={(e) => setDetectiveId(e.target.value)}
                      >
                        <option value="">Seleccione detective…</option>
                        {detectives.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                            {d.placa ? ` · ${d.placa}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <button
                    type="button"
                    className="btn-accent fiscal-confirm"
                    disabled={busy || (opcion === "B" && !detectiveId)}
                    onClick={confirmarDecision}
                  >
                    <MaterialIcon name="check_circle" />
                    {busy ? "Procesando…" : "Confirmar decisión"}
                  </button>
                </div>
              ) : (
                <div className="fiscal-relato">
                  <p>
                    <strong>{badgeLabel(selected.estado, selected.estado_label)}</strong>
                  </p>
                  {selected.fiscal && (
                    <p className="mod-muted">Fiscal: {selected.fiscal.nombre}</p>
                  )}
                  {selected.detective && (
                    <p className="mod-muted">Detective: {selected.detective.nombre}</p>
                  )}
                  {selected.expediente_numero && (
                    <p className="mod-muted">Expediente: {selected.expediente_numero}</p>
                  )}
                  {selected.decision_notas && (
                    <p style={{ whiteSpace: "pre-wrap" }}>{selected.decision_notas}</p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
