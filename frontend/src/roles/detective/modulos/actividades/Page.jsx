import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

const TABS = [
  { id: "bitacora", label: "Bitácora", icon: "menu_book" },
  { id: "bienes", label: "Bienes", icon: "directions_car" },
  { id: "solicitudes", label: "Solicitudes Fiscalía", icon: "gavel" },
  { id: "informe", label: "Informe final", icon: "description" },
];

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

  async function addBitacora(e) {
    e.preventDefault();
    if (!expId || locked) return;
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
    <div className="mod-page">
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

      <div className="panel-card" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1, minWidth: 220 }}>
          Expediente
          <select
            value={expId}
            onChange={(e) => setExpId(e.target.value)}
            style={{ flex: 1 }}
          >
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
          <span className="badge-estado ACTIVO">
            {selected.estado_label}
            {selected.bloqueado ? " · Bloqueado" : ""}
          </span>
        )}
      </div>

      {error && <p className="mod-error">{error}</p>}
      {ok && (
        <p
          className="mod-muted"
          style={{ background: "#eaf8ef", padding: "0.7rem 0.9rem", borderRadius: 10, color: "#1f7a45" }}
        >
          {ok}
        </p>
      )}

      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : !expId ? (
        <p className="mod-muted">Selecciona un expediente asignado.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? "btn-accent" : "btn-ghost"}
                onClick={() => setTab(t.id)}
              >
                <MaterialIcon name={t.icon} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "bitacora" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="panel-card">
                <p className="mod-kicker">Acciones registradas</p>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {bitacora.map((b) => (
                    <div key={b.id} style={{ padding: "0.65rem", background: "#f7f8fc", borderRadius: 10 }}>
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
                    disabled={locked || busy}
                    value={bitForm.fecha_hora}
                    onChange={(e) => setBitForm({ ...bitForm, fecha_hora: e.target.value })}
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
                    style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
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
                    <div key={b.id} style={{ padding: "0.65rem", background: "#f7f8fc", borderRadius: 10 }}>
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
                    style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
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
                    <div key={s.id} style={{ padding: "0.65rem", background: "#f7f8fc", borderRadius: 10 }}>
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
                    style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
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
                    style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
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
            <div className="panel-card" style={{ maxWidth: 820 }}>
              {informe || locked ? (
                <>
                  <p className="mod-kicker">Informe emitido</p>
                  <h3 style={{ marginTop: 0 }}>{informe?.titulo || "Informe Investigativo Final"}</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{informe?.contenido}</p>
                  {informe?.conclusiones && (
                    <>
                      <p className="mod-kicker">Conclusiones</p>
                      <p style={{ whiteSpace: "pre-wrap" }}>{informe.conclusiones}</p>
                    </>
                  )}
                  {informe?.paquete_url && (
                    <a className="btn-accent" href={informe.paquete_url} target="_blank" rel="noreferrer">
                      Descargar paquete digital
                    </a>
                  )}
                  <p className="mod-muted" style={{ marginTop: "0.75rem" }}>
                    Expediente bloqueado tras el envío a Fiscalía.
                  </p>
                </>
              ) : (
                <form className="form-grid" onSubmit={cerrarCaso}>
                  <p className="full mod-kicker" style={{ margin: 0 }}>
                    Paso 5 — Cierre y emisión del Informe Investigativo Final
                  </p>
                  <label className="full">
                    Título
                    <input
                      required
                      value={infForm.titulo}
                      onChange={(e) => setInfForm({ ...infForm, titulo: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    Contenido del informe
                    <textarea
                      required
                      rows={8}
                      value={infForm.contenido}
                      onChange={(e) => setInfForm({ ...infForm, contenido: e.target.value })}
                      style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
                      placeholder="Redacte el Informe Investigativo (no un Parte de Novedad)..."
                    />
                  </label>
                  <label className="full">
                    Conclusiones
                    <textarea
                      rows={3}
                      value={infForm.conclusiones}
                      onChange={(e) => setInfForm({ ...infForm, conclusiones: e.target.value })}
                      style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
                    />
                  </label>
                  <button type="submit" className="btn-accent full" disabled={busy}>
                    <MaterialIcon name="lock" />
                    Cerrar / Enviar a Fiscalía
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
