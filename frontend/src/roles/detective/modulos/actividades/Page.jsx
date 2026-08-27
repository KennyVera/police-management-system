import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "./Actividades.css";

const TABS = [
  { id: "bitacora", label: "Bitácora", icon: "menu_book" },
  { id: "bienes", label: "Bienes", icon: "directions_car" },
  { id: "solicitudes", label: "Solicitudes Fiscalía", icon: "gavel" },
  { id: "informe", label: "Informe final", icon: "description" },
];

/** Formato YYYY-MM-DDTHH:mm para input datetime-local */
function toLocalInputValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bitacoraDateBounds(expediente) {
  const now = new Date();
  const max = toLocalInputValue(now);
  let minDate = null;
  if (expediente?.investigacion_iniciada_en) {
    minDate = new Date(expediente.investigacion_iniciada_en);
  } else if (expediente?.creado_en) {
    minDate = new Date(expediente.creado_en);
  } else {
    minDate = new Date(now);
    minDate.setFullYear(now.getFullYear() - 1);
  }
  // No permitir min posterior a max
  if (minDate > now) minDate = new Date(now.getTime() - 60 * 1000);
  return { min: toLocalInputValue(minDate), max };
}

function validateBitacoraFecha(fechaHora, bounds) {
  if (!fechaHora) {
    return "Indica la fecha y hora de la diligencia.";
  }
  const value = new Date(fechaHora);
  if (Number.isNaN(value.getTime())) {
    return "Fecha / hora inválida.";
  }
  if (bounds.min) {
    const min = new Date(bounds.min);
    if (value < min) {
      return "La fecha no puede ser anterior al inicio del expediente / investigación.";
    }
  }
  if (bounds.max) {
    const max = new Date(bounds.max);
    if (value > max) {
      return "La fecha / hora no puede ser futura.";
    }
  }
  return "";
}

export default function ActividadesPage() {
  const confirm = useConfirm();
  const [expedientes, setExpedientes] = useState([]);
  const [meta, setMeta] = useState({
    tipos_bitacora: [],
    tipos_bien: [],
    tipos_solicitud: [],
  });
  const [expId, setExpId] = useState("");
  const [tab, setTab] = useState("bitacora");
  const [selected, setSelected] = useState(null);
  const [bitacora, setBitacora] = useState([]);
  const [bienes, setBienes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [bitForm, setBitForm] = useState({
    tipo: "DILIGENCIA",
    fecha_hora: "",
    lugar: "",
    relato: "",
  });
  const [bienForm, setBienForm] = useState({
    tipo: "VEHICULO",
    identificador: "",
    descripcion: "",
  });
  const [solForm, setSolForm] = useState({
    tipo: "ALLANAMIENTO",
    fundamento: "",
    pedimento: "",
  });
  const [infForm, setInfForm] = useState({
    titulo: "Informe Investigativo Final",
    contenido: "",
    conclusiones: "",
  });

  const locked = Boolean(selected?.bloqueado);

  async function bootstrap() {
    setLoading(true);
    setError("");
    try {
      const [list, m] = await Promise.all([
        detectiveApi.listExpedientes(),
        detectiveApi.actividadesMeta(),
      ]);
      setExpedientes(list);
      setMeta(m);
      if (!expId && list.length) {
        setExpId(String(list[0].id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExpData(id) {
    if (!id) {
      setSelected(null);
      setBitacora([]);
      setBienes([]);
      setSolicitudes([]);
      setInforme(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [exp, bits, biens, sols] = await Promise.all([
        detectiveApi.getExpediente(id),
        detectiveApi.listBitacora(id),
        detectiveApi.listBienes(id),
        detectiveApi.listSolicitudes(id),
      ]);
      setSelected(exp);
      setBitacora(bits);
      setBienes(biens);
      setSolicitudes(sols);
      try {
        setInforme(await detectiveApi.getInforme(id));
      } catch {
        setInforme(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (expId) loadExpData(expId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expId]);

  const tiposBit = useMemo(() => meta.tipos_bitacora || [], [meta]);
  const tiposBien = useMemo(() => meta.tipos_bien || [], [meta]);
  const tiposSol = useMemo(() => meta.tipos_solicitud || [], [meta]);
  const fechaBounds = useMemo(() => bitacoraDateBounds(selected), [selected]);

  async function addBitacora(e) {
    e.preventDefault();
    if (!expId || locked) return;
    const fechaErr = validateBitacoraFecha(bitForm.fecha_hora, fechaBounds);
    if (fechaErr) {
      setError(fechaErr);
      setOk("");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const body = {
        ...bitForm,
        fecha_hora: bitForm.fecha_hora || undefined,
      };
      await detectiveApi.createBitacora(expId, body);
      setBitForm({ tipo: "DILIGENCIA", fecha_hora: "", lugar: "", relato: "" });
      setOk("Entrada de bitácora registrada.");
      await loadExpData(expId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addBien(e) {
    e.preventDefault();
    if (!expId || locked) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await detectiveApi.createBien(expId, bienForm);
      setBienForm({ tipo: "VEHICULO", identificador: "", descripcion: "" });
      setOk("Bien investigado registrado.");
      await loadExpData(expId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addSolicitud(e) {
    e.preventDefault();
    if (!expId || locked) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await detectiveApi.createSolicitud(expId, solForm);
      setSolForm({ tipo: "ALLANAMIENTO", fundamento: "", pedimento: "" });
      setOk("Solicitud creada como borrador.");
      await loadExpData(expId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function enviarSol(solId) {
    if (!expId || locked) return;
    setBusy(true);
    setError("");
    try {
      await detectiveApi.enviarSolicitud(expId, solId);
      setOk("Solicitud enviada a Fiscalía (simulada).");
      await loadExpData(expId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cerrarCaso(e) {
    e.preventDefault();
    if (!expId || locked) return;
    const okConfirm = await confirm({
      title: "Cerrar expediente",
      message:
        "Al emitir el Informe Investigativo Final el expediente se cerrará, se bloqueará la edición y se generará el paquete digital para Fiscalía. ¿Continuar?",
      confirmLabel: "Cerrar caso",
      variant: "danger",
    });
    if (!okConfirm) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await detectiveApi.cerrarConInforme(expId, infForm);
      setOk("Caso cerrado / enviado a Fiscalía. Expediente bloqueado.");
      setInforme(res.informe);
      setSelected(res.expediente);
      const list = await detectiveApi.listExpedientes();
      setExpedientes(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mod-page act-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Actividades y Documentación Legal</p>
          <h2>Bitácora, Solicitudes e Informe Investigativo</h2>
          <p className="mod-desc">
            Registra diligencias de campo, genera solicitudes a Fiscalía y cierra el caso con el
            Informe Investigativo Final.
          </p>
        </div>
      </header>

      <div className="act-toolbar">
        <label>
          Expediente
          <select value={expId} onChange={(e) => setExpId(e.target.value)}>
            <option value="">Seleccione...</option>
            {expedientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero_expediente} — {c.titulo}
                {c.bloqueado ? " (bloqueado)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <span className={`badge-estado ${selected.bloqueado ? "BAJA" : "ACTIVO"}`}>
            {selected.estado_label}
            {selected.bloqueado ? " · Bloqueado" : ""}
          </span>
        )}
      </div>

      {error && <p className="mod-error">{error}</p>}
      {ok && <p className="mod-ok">{ok}</p>}

      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : !expId ? (
        <p className="mod-muted">Selecciona un expediente asignado.</p>
      ) : (
        <>
          <nav className="act-tabs" aria-label="Secciones de documentación">
            {TABS.map((t) => (
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
          </nav>

          {tab === "bitacora" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="panel-card">
                <p className="mod-kicker">Acciones registradas</p>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {bitacora.map((b) => (
                    <div key={b.id} className="det-soft-block">
                      <strong>{b.tipo_label}</strong>
                      <div className="mod-muted" style={{ fontSize: "0.8rem" }}>
                        {b.fecha_hora ? new Date(b.fecha_hora).toLocaleString() : ""}
                        {b.lugar ? ` · ${b.lugar}` : ""}
                      </div>
                      <p style={{ margin: "0.35rem 0 0", whiteSpace: "pre-wrap" }}>{b.relato}</p>
                      {!locked && (
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ marginTop: "0.4rem", padding: "0.3rem 0.5rem" }}
                          onClick={async () => {
                            await detectiveApi.deleteBitacora(expId, b.id);
                            await loadExpData(expId);
                          }}
                        >
                          <MaterialIcon name="delete" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!bitacora.length && <p className="mod-muted">Sin entradas en la bitácora.</p>}
                </div>
              </div>
              <form className="panel-card form-grid" onSubmit={addBitacora} style={{ alignContent: "start" }}>
                <p className="full mod-kicker" style={{ margin: 0 }}>
                  Nueva entrada (ej. vigilancia, entrevista)
                </p>
                <label>
                  Tipo
                  <select
                    value={bitForm.tipo}
                    disabled={locked || busy}
                    onChange={(e) => setBitForm({ ...bitForm, tipo: e.target.value })}
                  >
                    {tiposBit.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha / hora
                  <input
                    type="datetime-local"
                    required
                    disabled={locked || busy}
                    min={fechaBounds.min}
                    max={fechaBounds.max}
                    value={bitForm.fecha_hora}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && fechaBounds.max && v > fechaBounds.max) {
                        setBitForm({ ...bitForm, fecha_hora: fechaBounds.max });
                        return;
                      }
                      if (v && fechaBounds.min && v < fechaBounds.min) {
                        setBitForm({ ...bitForm, fecha_hora: fechaBounds.min });
                        return;
                      }
                      setBitForm({ ...bitForm, fecha_hora: v });
                    }}
                    title="Desde el inicio del caso hasta ahora"
                  />
                </label>
                <label className="full">
                  Lugar
                  <input
                    disabled={locked || busy}
                    value={bitForm.lugar}
                    onChange={(e) => setBitForm({ ...bitForm, lugar: e.target.value })}
                  />
                </label>
                <label className="full">
                  Relato
                  <textarea
                    required
                    rows={4}
                    disabled={locked || busy}
                    value={bitForm.relato}
                    onChange={(e) => setBitForm({ ...bitForm, relato: e.target.value })}
                    className="det-file-input"
                    placeholder='Ej. "Se entrevistó al testigo Y..."'
                  />
                </label>
                <button type="submit" className="btn-accent full" disabled={locked || busy}>
                  <MaterialIcon name="add" />
                  Registrar en bitácora
                </button>
              </form>
            </div>
          )}

          {tab === "bienes" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="panel-card">
                <p className="mod-kicker">Vehículos / inmuebles investigados</p>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {bienes.map((b) => (
                    <div key={b.id} className="det-soft-block">
                      <strong>
                        {b.tipo_label}: {b.identificador}
                      </strong>
                      <p style={{ margin: "0.35rem 0 0" }}>{b.descripcion || "—"}</p>
                      {!locked && (
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ marginTop: "0.4rem", padding: "0.3rem 0.5rem" }}
                          onClick={async () => {
                            await detectiveApi.deleteBien(expId, b.id);
                            await loadExpData(expId);
                          }}
                        >
                          <MaterialIcon name="delete" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!bienes.length && <p className="mod-muted">Sin bienes registrados.</p>}
                </div>
              </div>
              <form className="panel-card form-grid" onSubmit={addBien}>
                <p className="full mod-kicker" style={{ margin: 0 }}>
                  Registrar bien
                </p>
                <label>
                  Tipo
                  <select
                    disabled={locked || busy}
                    value={bienForm.tipo}
                    onChange={(e) => setBienForm({ ...bienForm, tipo: e.target.value })}
                  >
                    {tiposBien.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Identificador
                  <input
                    required
                    disabled={locked || busy}
                    placeholder="Placa / dirección"
                    value={bienForm.identificador}
                    onChange={(e) => setBienForm({ ...bienForm, identificador: e.target.value })}
                  />
                </label>
                <label className="full">
                  Descripción
                  <textarea
                    rows={3}
                    disabled={locked || busy}
                    value={bienForm.descripcion}
                    onChange={(e) => setBienForm({ ...bienForm, descripcion: e.target.value })}
                    className="det-file-input"
                  />
                </label>
                <button type="submit" className="btn-accent full" disabled={locked || busy}>
                  Guardar bien
                </button>
              </form>
            </div>
          )}

          {tab === "solicitudes" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="panel-card">
                <p className="mod-kicker">Solicitudes generadas</p>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {solicitudes.map((s) => (
                    <div key={s.id} className="det-soft-block">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                        <strong>
                          {s.numero || `SF-${s.id}`} · {s.tipo_label}
                        </strong>
                        <span className="badge-estado ACTIVO">{s.estado_label}</span>
                      </div>
                      <p style={{ margin: "0.4rem 0 0", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                        <em>Fundamento:</em> {s.fundamento}
                      </p>
                      <p style={{ margin: "0.3rem 0 0", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>
                        <em>Pedimento:</em> {s.pedimento}
                      </p>
                      {!locked && s.estado === "BORRADOR" && (
                        <button
                          type="button"
                          className="btn-accent"
                          style={{ marginTop: "0.5rem" }}
                          disabled={busy}
                          onClick={() => enviarSol(s.id)}
                        >
                          Enviar a Fiscalía
                        </button>
                      )}
                    </div>
                  ))}
                  {!solicitudes.length && <p className="mod-muted">Sin solicitudes.</p>}
                </div>
              </div>
              <form className="panel-card form-grid" onSubmit={addSolicitud}>
                <p className="full mod-kicker" style={{ margin: 0 }}>
                  Nueva solicitud estandarizada
                </p>
                <label className="full">
                  Tipo
                  <select
                    disabled={locked || busy}
                    value={solForm.tipo}
                    onChange={(e) => setSolForm({ ...solForm, tipo: e.target.value })}
                  >
                    {tiposSol.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full">
                  Fundamento
                  <textarea
                    required
                    rows={3}
                    disabled={locked || busy}
                    value={solForm.fundamento}
                    onChange={(e) => setSolForm({ ...solForm, fundamento: e.target.value })}
                    className="det-file-input"
                    placeholder="Hechos y bases legales..."
                  />
                </label>
                <label className="full">
                  Pedimento
                  <textarea
                    required
                    rows={3}
                    disabled={locked || busy}
                    value={solForm.pedimento}
                    onChange={(e) => setSolForm({ ...solForm, pedimento: e.target.value })}
                    className="det-file-input"
                    placeholder="Se solicita al juez/fiscal..."
                  />
                </label>
                <button type="submit" className="btn-accent full" disabled={locked || busy}>
                  Crear borrador
                </button>
              </form>
            </div>
          )}

          {tab === "informe" && (
            <div className="act-informe">
              <div className="act-informe-doc">
                <div className="act-informe-banner">
                  <p className="act-step">Paso 5 · Cierre documental</p>
                  <h3>
                    {informe || locked
                      ? "Informe investigativo emitido"
                      : "Informe investigativo final"}
                  </h3>
                  <p>
                    {informe || locked
                      ? "Documento oficial generado para remisión a Fiscalía. El expediente queda bloqueado."
                      : "Redacta el informe de cierre. Al enviarlo, el expediente se bloqueará y se generará el paquete digital."}
                  </p>
                </div>

                {informe || locked ? (
                  <div className="act-informe-view">
                    <h3 className="act-doc-title">
                      {informe?.titulo || "Informe Investigativo Final"}
                    </h3>
                    <div className="act-doc-block">
                      <h4>Contenido</h4>
                      <p>{informe?.contenido || "Sin contenido registrado."}</p>
                    </div>
                    {informe?.conclusiones ? (
                      <div className="act-doc-block">
                        <h4>Conclusiones</h4>
                        <p>{informe.conclusiones}</p>
                      </div>
                    ) : null}
                    <div className="act-informe-actions">
                      {informe?.paquete_url ? (
                        <a
                          className="btn-accent"
                          href={informe.paquete_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MaterialIcon name="download" />
                          Descargar paquete digital
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <form className="act-informe-body" onSubmit={cerrarCaso}>
                    <label className="act-field">
                      <span>Título del informe</span>
                      <input
                        required
                        value={infForm.titulo}
                        onChange={(e) => setInfForm({ ...infForm, titulo: e.target.value })}
                      />
                    </label>
                    <label className="act-field">
                      <span>Contenido del informe</span>
                      <textarea
                        required
                        className="act-field-lg"
                        value={infForm.contenido}
                        onChange={(e) => setInfForm({ ...infForm, contenido: e.target.value })}
                        placeholder="Redacte el Informe Investigativo: hechos investigados, diligencias, hallazgos y análisis…"
                      />
                    </label>
                    <label className="act-field">
                      <span>Conclusiones</span>
                      <textarea
                        rows={4}
                        value={infForm.conclusiones}
                        onChange={(e) =>
                          setInfForm({ ...infForm, conclusiones: e.target.value })
                        }
                        placeholder="Síntesis de conclusiones y remisión a Fiscalía…"
                      />
                    </label>
                    <div className="act-informe-actions">
                      <button type="submit" className="btn-accent" disabled={busy}>
                        <MaterialIcon name="lock" />
                        {busy ? "Enviando..." : "Cerrar / Enviar a Fiscalía"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <aside className="act-informe-aside">
                <div className="act-aside-card">
                  <h4>
                    <MaterialIcon name="folder_open" />
                    Expediente
                  </h4>
                  <div className="act-meta-row">
                    <div>
                      <span>Código</span>
                      <strong>
                        {selected?.codigo_caso || selected?.numero_expediente || "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Caso</span>
                      <strong>{selected?.titulo || "—"}</strong>
                    </div>
                    <div>
                      <span>Estado</span>
                      <strong>{selected?.estado_label || "—"}</strong>
                    </div>
                    <div>
                      <span>Detective</span>
                      <strong>{selected?.detective_info?.nombre || "—"}</strong>
                    </div>
                  </div>
                </div>
                <div className="act-aside-card">
                  <h4>
                    <MaterialIcon name="info" />
                    Antes de emitir
                  </h4>
                  <ul>
                    <li>Verifica bitácora, evidencias e involucrados.</li>
                    <li>El informe debe ser investigativo, no un parte de novedad.</li>
                    <li>Al enviar, el expediente quedará bloqueado de forma definitiva.</li>
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
