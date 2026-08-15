import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { useConfirm } from "../../../../shared/components/ConfirmContext";
import { detectiveApi } from "../../api";
import "./ExpedienteDetalle.css";
import ExpedienteEvidencias from "./ExpedienteEvidencias";
import InvolucradoPerfil from "./InvolucradoPerfil";

const TABS = [
  { id: "resumen", label: "Resumen", icon: "description" },
  { id: "involucrados", label: "Involucrados", icon: "group" },
  { id: "evidencias", label: "Evidencias", icon: "science" },
  { id: "entrevistas", label: "Entrevistas", icon: "record_voice_over" },
  { id: "documentos", label: "Documentos", icon: "folder" },
  { id: "bitacora", label: "Bitácora", icon: "menu_book" },
  { id: "actividades", label: "Actividades", icon: "task_alt" },
];

const emptyInv = {
  tipo: "TESTIGO",
  nombres: "",
  apellidos: "",
  cedula: "",
  fecha_nacimiento: "",
  alias: "",
  genero: "NO_ESPECIFICADO",
  nacionalidad: "",
  telefono: "",
  direccion: "",
  ocupacion: "",
  estado_civil: "NO_REGISTRADO",
  observaciones: "",
};

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function initials(nombre = "") {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function ExpedienteDetalle({
  expediente: initial,
  meta,
  onClose,
  onUpdated,
  onNotify,
}) {
  const confirm = useConfirm();
  const [exp, setExp] = useState(initial);
  const [tab, setTab] = useState("resumen");
  const [invFilter, setInvFilter] = useState("TODOS");
  const [evidencias, setEvidencias] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [bienes, setBienes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [informe, setInforme] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editingNota, setEditingNota] = useState(false);
  const [nota, setNota] = useState(initial?.observaciones || "");
  const [invForm, setInvForm] = useState(emptyInv);
  const [editingInvId, setEditingInvId] = useState(null);
  const [showInvForm, setShowInvForm] = useState(false);
  const [perfilInvId, setPerfilInvId] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const fotoInputRef = useRef(null);
  const [bitForm, setBitForm] = useState({
    tipo: "ENTREVISTA",
    lugar: "",
    relato: "",
  });

  const locked = Boolean(exp?.bloqueado);
  const codigo = exp?.codigo_caso || exp?.numero_expediente || "—";

  async function refreshRelated(id = exp.id) {
    const [ev, bits, biens, sols] = await Promise.all([
      detectiveApi.listEvidencias({ expediente: id }),
      detectiveApi.listBitacora(id),
      detectiveApi.listBienes(id),
      detectiveApi.listSolicitudes(id),
    ]);
    setEvidencias(ev);
    setBitacora(bits);
    setBienes(biens);
    setSolicitudes(sols);
    try {
      setInforme(await detectiveApi.getInforme(id));
    } catch {
      setInforme(null);
    }
  }

  useEffect(() => {
    setExp(initial);
    setNota(initial?.observaciones || "");
    setTab("resumen");
    setEditingInvId(null);
    setInvForm(emptyInv);
    if (initial?.id) {
      refreshRelated(initial.id).catch((err) => onNotify?.(err.message, true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const involucrados = exp?.involucrados || [];
  const sospechosos = involucrados.filter((i) => i.tipo === "SOSPECHOSO");
  const victimas = involucrados.filter((i) =>
    ["VICTIMA", "DENUNCIANTE"].includes(i.tipo)
  );
  const filteredInv = useMemo(() => {
    if (invFilter === "SOSPECHOSO") return sospechosos;
    if (invFilter === "VICTIMA") return victimas;
    return involucrados;
  }, [invFilter, involucrados, sospechosos, victimas]);

  const entrevistas = bitacora.filter((b) => b.tipo === "ENTREVISTA");

  const timeline = useMemo(() => {
    const steps = [
      {
        key: "asignado",
        label: "Caso asignado",
        done: true,
        when: formatWhen(exp?.creado_en),
      },
      {
        key: "indagacion",
        label: "Investigación iniciada",
        done: ["INDAGACION_PREVIA", "INSTRUCCION_FISCAL", "CERRADO"].includes(exp?.estado),
        current: exp?.estado === "INDAGACION_PREVIA",
        when:
          exp?.estado === "INDAGACION_PREVIA" || exp?.estado === "INSTRUCCION_FISCAL"
            ? formatWhen(exp?.actualizado_en)
            : null,
      },
      {
        key: "evidencias",
        label: "Evidencias agregadas",
        done: evidencias.length > 0,
        current: evidencias.length > 0 && exp?.estado !== "CERRADO",
        when: evidencias[0] ? formatWhen(evidencias[0].creado_en) : null,
      },
      {
        key: "instruccion",
        label: "En instrucción fiscal",
        done: ["INSTRUCCION_FISCAL", "CERRADO"].includes(exp?.estado),
        current: exp?.estado === "INSTRUCCION_FISCAL",
      },
      {
        key: "cerrado",
        label: "Expediente completado",
        done: exp?.estado === "CERRADO" || locked,
        current: locked,
        when: exp?.cerrado_en ? formatWhen(exp.cerrado_en) : null,
      },
    ];
    return steps;
  }, [exp, evidencias, locked]);

  async function reloadExp() {
    const fresh = await detectiveApi.getExpediente(exp.id);
    setExp(fresh);
    setNota(fresh.observaciones || "");
    onUpdated?.(fresh);
    await refreshRelated(fresh.id);
    return fresh;
  }

  async function iniciarInvestigacion() {
    if (locked) return;
    setBusy(true);
    try {
      await detectiveApi.cambiarEstado(exp.id, { estado: "INDAGACION_PREVIA" });
      await reloadExp();
      onNotify?.("Investigación iniciada / en indagación previa.");
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function marcarCompletado() {
    if (locked) return;
    setTab("documentos");
    onNotify?.(
      "Para completar el caso, redacta el Informe Investigativo Final en Documentos."
    );
  }

  async function saveNota() {
    if (locked) return;
    setBusy(true);
    try {
      await detectiveApi.updateExpediente(exp.id, { observaciones: nota });
      setEditingNota(false);
      await reloadExp();
      onNotify?.("Nota del expediente actualizada.");
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function saveInvolucrado(e) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    try {
      const body = {
        tipo: invForm.tipo,
        nombres: invForm.nombres,
        apellidos: invForm.apellidos,
        cedula: invForm.cedula,
        fecha_nacimiento: invForm.fecha_nacimiento || "",
        alias: invForm.alias,
        genero: invForm.genero || "NO_ESPECIFICADO",
        nacionalidad: invForm.nacionalidad,
        telefono: invForm.telefono,
        direccion: invForm.direccion,
        ocupacion: invForm.ocupacion,
        estado_civil: invForm.estado_civil || "NO_REGISTRADO",
        observaciones: invForm.observaciones,
      };
      if (editingInvId) {
        await detectiveApi.updateInvolucrado(exp.id, editingInvId, body, fotoFile);
        onNotify?.("Involucrado actualizado.");
      } else {
        await detectiveApi.createInvolucrado(exp.id, body, fotoFile);
        onNotify?.("Involucrado registrado.");
      }
      closeInvForm();
      await reloadExp();
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  function openAddInvolucrado() {
    setEditingInvId(null);
    setInvForm({
      ...emptyInv,
      tipo:
        invFilter === "VICTIMA"
          ? "VICTIMA"
          : invFilter === "SOSPECHOSO"
            ? "SOSPECHOSO"
            : "TESTIGO",
    });
    setFotoFile(null);
    setFotoPreview("");
    setShowInvForm(true);
  }

  async function openEditInvolucrado(inv) {
    setEditingInvId(inv.id);
    setInvForm({
      tipo: inv.tipo,
      nombres: inv.nombres || "",
      apellidos: inv.apellidos || "",
      cedula: inv.cedula || "",
      fecha_nacimiento: inv.fecha_nacimiento || "",
      alias: inv.alias || "",
      genero: inv.genero || "NO_ESPECIFICADO",
      nacionalidad: inv.nacionalidad || "",
      telefono: inv.telefono || "",
      direccion: inv.direccion || "",
      ocupacion: inv.ocupacion || "",
      estado_civil: inv.estado_civil || "NO_REGISTRADO",
      observaciones: inv.observaciones || "",
    });
    setFotoFile(null);
    setFotoPreview("");
    if (inv.tiene_foto) {
      try {
        const blob = await detectiveApi.fetchInvolucradoFotoBlob(exp.id, inv.id);
        setFotoPreview(URL.createObjectURL(blob));
      } catch {
        /* sin foto */
      }
    }
    setPerfilInvId(null);
    setShowInvForm(true);
  }

  function closeInvForm() {
    setShowInvForm(false);
    setEditingInvId(null);
    setInvForm(emptyInv);
    setFotoFile(null);
    if (fotoPreview && fotoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(fotoPreview);
    }
    setFotoPreview("");
  }

  function onPickFoto(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onNotify?.("La foto debe ser JPG o PNG.", true);
      return;
    }
    setFotoFile(f);
    if (fotoPreview && fotoPreview.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(URL.createObjectURL(f));
  }

  async function openPerfil(inv) {
    setPerfilInvId(inv.id);
  }

  async function removeInvolucrado(id) {
    if (locked) return;
    const ok = await confirm({
      title: "Eliminar involucrado",
      message: "¿Eliminar involucrado? Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await detectiveApi.deleteInvolucrado(exp.id, id);
      await reloadExp();
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function addBitacora(e, forceTipo) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    try {
      const body = {
        ...bitForm,
        tipo: forceTipo || bitForm.tipo || "DILIGENCIA",
      };
      await detectiveApi.createBitacora(exp.id, body);
      setBitForm({ tipo: forceTipo || "DILIGENCIA", lugar: "", relato: "" });
      await refreshRelated();
      onNotify?.("Entrada registrada en bitácora.");
    } catch (err) {
      onNotify?.(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (!exp) return null;

  return (
    <div className="exp-overlay" role="dialog" aria-modal="true">
      <div className="exp-shell">
        <header className="exp-top">
          <div>
            <p className="exp-breadcrumb">
              <button type="button" className="exp-crumb-link" onClick={onClose}>
                Mis Casos
              </button>
              <span>›</span>
              <span>Expedientes</span>
              <span>›</span>
              <strong>{codigo}</strong>
            </p>
            <div className="exp-title-row">
              <h2>Expediente {codigo}</h2>
              <span className={`badge-prioridad ${exp.prioridad}`}>{exp.prioridad_label}</span>
            </div>
            <p className="exp-meta-line">
              <MaterialIcon name="gavel" />
              {exp.tipo_delito_nombre || exp.titulo}
              <span className="exp-dot">·</span>
              <MaterialIcon name="schedule" />
              Asignado: {formatWhen(exp.creado_en)}
            </p>
          </div>
          <div className="exp-actions">
            {!locked && (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={iniciarInvestigacion}
                >
                  <MaterialIcon name="play_arrow" />
                  Iniciar investigación
                </button>
                <button
                  type="button"
                  className="btn-accent"
                  disabled={busy}
                  onClick={marcarCompletado}
                >
                  <MaterialIcon name="check_circle" />
                  Establecer como completado
                </button>
              </>
            )}
            <button type="button" className="btn-ghost" onClick={onClose} title="Cerrar">
              <MaterialIcon name="close" />
            </button>
          </div>
        </header>

        <nav className="exp-tabs">
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

        <div className="exp-body">
          {tab === "resumen" && (
            <div className="exp-layout">
              <div className="exp-main">
                <section className="exp-card">
                  <h3>Información del expediente</h3>
                  <div className="exp-info-grid">
                    <div>
                      <span className="exp-label">Código del caso</span>
                      <strong>{codigo}</strong>
                      <small>{exp.numero_expediente}</small>
                    </div>
                    <div>
                      <span className="exp-label">Tipo de delito</span>
                      <strong>{exp.tipo_delito_nombre || "—"}</strong>
                      <small>{exp.tipo_delito_articulo || exp.titulo}</small>
                    </div>
                    <div>
                      <span className="exp-label">Fecha / hora del hecho</span>
                      <strong>{exp.fecha_hechos || "—"}</strong>
                    </div>
                    <div>
                      <span className="exp-label">Lugar</span>
                      <strong>{exp.lugar || "—"}</strong>
                    </div>
                  </div>
                  <div className="exp-desc-block">
                    <span className="exp-label">Descripción del hecho</span>
                    <p>{exp.descripcion || "Sin descripción registrada."}</p>
                  </div>
                  <div className="exp-status-row">
                    <div>
                      <span className="exp-label">Unidad / Dependencia</span>
                      <strong>{exp.unidad || "—"}</strong>
                    </div>
                    <div>
                      <span className="exp-label">Detective asignado</span>
                      <div className="exp-person-mini">
                        <span className="exp-avatar">
                          {initials(exp.detective_info?.nombre)}
                        </span>
                        <div>
                          <strong>{exp.detective_info?.nombre || "—"}</strong>
                          <small>{exp.detective_info?.email || ""}</small>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="exp-label">Estado del expediente</span>
                      <span className={`badge-estado ${exp.estado}`}>
                        <span className="badge-dot" />
                        {exp.estado_label}
                      </span>
                    </div>
                    <div>
                      <span className="exp-label">Prioridad</span>
                      <span className={`badge-prioridad ${exp.prioridad}`}>
                        {exp.prioridad_label}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="exp-card">
                  <h3>Oficiales encargados</h3>
                  <div className="exp-officers">
                    <div className="exp-officer">
                      <span className="exp-avatar lg">
                        {initials(exp.jefe_info?.nombre || "Jefe")}
                      </span>
                      <div>
                        <strong>{exp.jefe_info?.nombre || "Jefe de Investigaciones"}</strong>
                        <small>Supervisor / asignador</small>
                        <small>{exp.jefe_info?.email || "—"}</small>
                      </div>
                    </div>
                    <div className="exp-officer">
                      <span className="exp-avatar lg">
                        {initials(exp.detective_info?.nombre)}
                      </span>
                      <div>
                        <strong>{exp.detective_info?.nombre || "Detective"}</strong>
                        <small>Investigador asignado</small>
                        <small>
                          {exp.detective_info?.placa
                            ? `Placa ${exp.detective_info.placa}`
                            : exp.detective_info?.email || "—"}
                        </small>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="exp-side">
                <section className="exp-card exp-notes">
                  <div className="exp-card-head">
                    <h3>Notas del expediente</h3>
                    {!locked && !editingNota && (
                      <button
                        type="button"
                        className="exp-link"
                        onClick={() => setEditingNota(true)}
                      >
                        Editar nota
                      </button>
                    )}
                  </div>
                  {editingNota ? (
                    <>
                      <textarea
                        rows={5}
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn-accent"
                          disabled={busy}
                          onClick={saveNota}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setEditingNota(false);
                            setNota(exp.observaciones || "");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>{exp.observaciones || "Sin notas internas todavía."}</p>
                  )}
                </section>

                <section className="exp-card">
                  <h3>Línea de tiempo</h3>
                  <ol className="exp-timeline">
                    {timeline.map((step) => (
                      <li
                        key={step.key}
                        className={[
                          step.done ? "done" : "",
                          step.current ? "current" : "",
                          !step.done && !step.current ? "pending" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span className="exp-tl-dot" />
                        <div>
                          <strong>{step.label}</strong>
                          <small>
                            {step.done || step.current
                              ? step.when || "Registrado"
                              : "Pendiente"}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="exp-card">
                  <h3>Acciones rápidas</h3>
                  <div className="exp-quick">
                    <button type="button" onClick={() => setTab("involucrados")}>
                      <MaterialIcon name="group" />
                      Ver involucrados
                    </button>
                    <button type="button" onClick={() => setTab("entrevistas")}>
                      <MaterialIcon name="record_voice_over" />
                      Registrar entrevista
                    </button>
                    <button type="button" onClick={() => setTab("documentos")}>
                      <MaterialIcon name="upload_file" />
                      Ver documentos
                    </button>
                    <button type="button" onClick={() => window.print()}>
                      <MaterialIcon name="print" />
                      Imprimir resumen
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          )}

          {tab === "involucrados" && (
            <section className="exp-card">
              <div className="exp-card-head">
                <h3>Sospechosos / Víctimas</h3>
                <div className="exp-inv-toolbar">
                  <div className="exp-subtabs">
                    {[
                      { id: "TODOS", label: "Todos" },
                      { id: "SOSPECHOSO", label: "Sospechosos" },
                      { id: "VICTIMA", label: "Víctimas" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={invFilter === s.id ? "active" : ""}
                        onClick={() => setInvFilter(s.id)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      className="exp-add-btn"
                      title="Añadir involucrado"
                      onClick={openAddInvolucrado}
                    >
                      <MaterialIcon name="add" />
                    </button>
                  )}
                </div>
              </div>
              <div className="exp-inv-list">
                {filteredInv.map((inv) => (
                  <InvolucradoRow
                    key={inv.id}
                    inv={inv}
                    expId={exp.id}
                    onVer={() => openPerfil(inv)}
                  />
                ))}
                {!filteredInv.length && (
                  <p className="mod-muted">No hay involucrados en este filtro.</p>
                )}
              </div>
            </section>
          )}

          {tab === "evidencias" && (
            <ExpedienteEvidencias
              expedienteId={exp.id}
              locked={locked}
              onNotify={onNotify}
            />
          )}

          {tab === "entrevistas" && (
            <div className="exp-split">
              <section className="exp-card">
                <h3>Entrevistas registradas</h3>
                <div className="exp-feed">
                  {entrevistas.map((b) => (
                    <article key={b.id}>
                      <strong>{b.tipo_label}</strong>
                      <small>
                        {formatWhen(b.fecha_hora)}
                        {b.lugar ? ` · ${b.lugar}` : ""}
                      </small>
                      <p>{b.relato}</p>
                    </article>
                  ))}
                  {!entrevistas.length && (
                    <p className="mod-muted">Aún no hay entrevistas en la bitácora.</p>
                  )}
                </div>
              </section>
              {!locked && (
                <form className="exp-card form-grid" onSubmit={(e) => addBitacora(e, "ENTREVISTA")}>
                  <p className="full mod-kicker" style={{ margin: 0 }}>
                    Nueva entrevista
                  </p>
                  <label className="full">
                    Lugar
                    <input
                      value={bitForm.lugar}
                      onChange={(e) => setBitForm({ ...bitForm, lugar: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    Relato
                    <textarea
                      required
                      rows={5}
                      value={bitForm.relato}
                      onChange={(e) => setBitForm({ ...bitForm, relato: e.target.value })}
                      placeholder='Ej. "Se entrevistó al testigo Y..."'
                    />
                  </label>
                  <button type="submit" className="btn-accent full" disabled={busy}>
                    Guardar entrevista
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "documentos" && (
            <div className="exp-split">
              <section className="exp-card">
                <h3>Documento base ({exp.origen_documento_label})</h3>
                <pre className="exp-doc">{exp.documento_base || "Sin documento base."}</pre>
              </section>
              <section className="exp-card">
                <h3>Solicitudes a Fiscalía</h3>
                {solicitudes.map((s) => (
                  <div key={s.id} className="exp-sol">
                    <strong>
                      {s.numero} · {s.tipo_label}
                    </strong>
                    <span className="badge-estado ACTIVO">{s.estado_label}</span>
                    <p>{s.pedimento}</p>
                  </div>
                ))}
                {!solicitudes.length && (
                  <p className="mod-muted">
                    Sin solicitudes. Genéralas en{" "}
                    <Link to="/app/detective/actividades">Documentación Legal</Link>.
                  </p>
                )}
                {informe && (
                  <div className="exp-informe">
                    <h4>{informe.titulo}</h4>
                    <p>{informe.contenido}</p>
                    {informe.paquete_url && (
                      <a
                        className="btn-accent"
                        href={informe.paquete_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Descargar paquete digital
                      </a>
                    )}
                  </div>
                )}
                {!informe && !locked && (
                  <p className="mod-muted" style={{ marginTop: "0.75rem" }}>
                    Para cerrar el caso emite el Informe Investigativo Final desde{" "}
                    <Link to="/app/detective/actividades">Documentación Legal</Link>.
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === "bitacora" && (
            <div className="exp-split">
              <section className="exp-card">
                <h3>Bitácora de investigación</h3>
                <div className="exp-feed">
                  {bitacora.map((b) => (
                    <article key={b.id}>
                      <strong>{b.tipo_label}</strong>
                      <small>
                        {formatWhen(b.fecha_hora)}
                        {b.lugar ? ` · ${b.lugar}` : ""}
                      </small>
                      <p>{b.relato}</p>
                    </article>
                  ))}
                  {!bitacora.length && (
                    <p className="mod-muted">Bitácora vacía.</p>
                  )}
                </div>
              </section>
              {!locked && (
                <form className="exp-card form-grid" onSubmit={(e) => addBitacora(e)}>
                  <p className="full mod-kicker" style={{ margin: 0 }}>
                    Nueva entrada
                  </p>
                  <label>
                    Tipo
                    <select
                      value={bitForm.tipo}
                      onChange={(e) => setBitForm({ ...bitForm, tipo: e.target.value })}
                    >
                      <option value="VIGILANCIA">Vigilancia</option>
                      <option value="ENTREVISTA">Entrevista</option>
                      <option value="DILIGENCIA">Diligencia</option>
                      <option value="ANALISIS">Análisis</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </label>
                  <label>
                    Lugar
                    <input
                      value={bitForm.lugar}
                      onChange={(e) => setBitForm({ ...bitForm, lugar: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    Relato
                    <textarea
                      required
                      rows={4}
                      value={bitForm.relato}
                      onChange={(e) => setBitForm({ ...bitForm, relato: e.target.value })}
                    />
                  </label>
                  <button type="submit" className="btn-accent full" disabled={busy}>
                    Registrar
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "actividades" && (
            <div className="exp-split">
              <section className="exp-card">
                <h3>Bienes investigados</h3>
                {bienes.map((b) => (
                  <div key={b.id} className="exp-sol">
                    <strong>
                      {b.tipo_label}: {b.identificador}
                    </strong>
                    <p>{b.descripcion || "—"}</p>
                  </div>
                ))}
                {!bienes.length && (
                  <p className="mod-muted">Sin vehículos ni inmuebles registrados.</p>
                )}
              </section>
              <section className="exp-card">
                <h3>Más actividades</h3>
                <p className="mod-muted">
                  Solicitudes a Fiscalía, bitácora completa e informe final están en el módulo
                  Documentación Legal.
                </p>
                <Link className="btn-accent" to="/app/detective/actividades">
                  Abrir Documentación Legal
                </Link>
              </section>
            </div>
          )}
        </div>
      </div>

      {perfilInvId && (
        <InvolucradoPerfil
          expedienteId={exp.id}
          involucradoId={perfilInvId}
          locked={locked}
          onClose={() => setPerfilInvId(null)}
          onEdit={(inv) => openEditInvolucrado(inv)}
          onDelete={async (inv) => {
            await removeInvolucrado(inv.id);
            setPerfilInvId(null);
          }}
          onNotify={onNotify}
          onOpenExpediente={(expId) => {
            setPerfilInvId(null);
            if (expId !== exp.id) {
              onNotify?.(
                "Ese expediente está en tu bandeja; ciérralo y ábrelo desde Mis Casos.",
                false
              );
            }
          }}
        />
      )}

      {showInvForm && (
        <div className="exp-perfil-backdrop" onClick={closeInvForm}>
          <form
            className="exp-inv-modal-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveInvolucrado}
          >
            <div className="exp-inv-modal-title">
              <MaterialIcon name="person_add" />
              <h3>{editingInvId ? "Editar involucrado" : "Agregar involucrado"}</h3>
            </div>

            <div className="exp-foto-row">
              <button
                type="button"
                className="exp-foto-box"
                onClick={() => fotoInputRef.current?.click()}
                title="Subir foto"
              >
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Vista previa" />
                ) : (
                  <MaterialIcon name="photo_camera" />
                )}
              </button>
              <div>
                <strong>Foto de perfil (opcional)</strong>
                <p className="mod-muted" style={{ margin: "0.25rem 0 0" }}>
                  JPG o PNG, hasta unos pocos MB.
                </p>
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={onPickFoto}
              />
            </div>

            <div className="exp-inv-fields">
              <label className="full">
                Tipo de relación
                <select
                  value={invForm.tipo}
                  onChange={(e) => setInvForm({ ...invForm, tipo: e.target.value })}
                >
                  {(meta.tipos_involucrado || []).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nombres
                <input
                  required
                  value={invForm.nombres}
                  onChange={(e) => setInvForm({ ...invForm, nombres: e.target.value })}
                />
              </label>
              <label>
                Apellidos
                <input
                  value={invForm.apellidos}
                  onChange={(e) => setInvForm({ ...invForm, apellidos: e.target.value })}
                />
              </label>
              <label>
                Identificación
                <input
                  placeholder="Cédula, pasaporte..."
                  value={invForm.cedula}
                  onChange={(e) => setInvForm({ ...invForm, cedula: e.target.value })}
                />
              </label>
              <label>
                Fecha de nacimiento
                <input
                  type="date"
                  value={invForm.fecha_nacimiento}
                  onChange={(e) =>
                    setInvForm({ ...invForm, fecha_nacimiento: e.target.value })
                  }
                />
              </label>
              <label>
                Alias
                <input
                  value={invForm.alias}
                  onChange={(e) => setInvForm({ ...invForm, alias: e.target.value })}
                />
              </label>
              <label>
                Género
                <select
                  value={invForm.genero}
                  onChange={(e) => setInvForm({ ...invForm, genero: e.target.value })}
                >
                  {(meta.generos_involucrado || [
                    { value: "NO_ESPECIFICADO", label: "No especificado" },
                    { value: "MASCULINO", label: "Masculino" },
                    { value: "FEMENINO", label: "Femenino" },
                    { value: "OTRO", label: "Otro" },
                  ]).map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nacionalidad
                <input
                  value={invForm.nacionalidad}
                  onChange={(e) => setInvForm({ ...invForm, nacionalidad: e.target.value })}
                />
              </label>
              <label>
                Teléfono
                <input
                  value={invForm.telefono}
                  onChange={(e) => setInvForm({ ...invForm, telefono: e.target.value })}
                />
              </label>
              <label>
                Ocupación
                <input
                  value={invForm.ocupacion}
                  onChange={(e) => setInvForm({ ...invForm, ocupacion: e.target.value })}
                />
              </label>
              <label>
                Estado civil
                <select
                  value={invForm.estado_civil}
                  onChange={(e) => setInvForm({ ...invForm, estado_civil: e.target.value })}
                >
                  {(meta.estados_civiles || [
                    { value: "NO_REGISTRADO", label: "No registrado" },
                    { value: "SOLTERO", label: "Soltero/a" },
                    { value: "CASADO", label: "Casado/a" },
                    { value: "DIVORCIADO", label: "Divorciado/a" },
                    { value: "VIUDO", label: "Viudo/a" },
                    { value: "UNION", label: "Unión de hecho" },
                  ]).map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Dirección
                <input
                  value={invForm.direccion}
                  onChange={(e) => setInvForm({ ...invForm, direccion: e.target.value })}
                />
              </label>
              <label className="full">
                Declaración / notas
                <textarea
                  rows={4}
                  placeholder="Resumen de la declaración o notas relevantes..."
                  value={invForm.observaciones}
                  onChange={(e) =>
                    setInvForm({ ...invForm, observaciones: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="exp-perfil-actions">
              <button type="button" className="btn-ghost" onClick={closeInvForm}>
                Cancelar
              </button>
              <button type="submit" className="btn-accent" disabled={busy}>
                <MaterialIcon name="person_add" />
                {editingInvId ? "Guardar cambios" : "Agregar involucrado"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function InvolucradoRow({ inv, expId, onVer }) {
  const [fotoUrl, setFotoUrl] = useState("");

  useEffect(() => {
    let alive = true;
    let url = "";
    async function load() {
      if (!inv.tiene_foto) return;
      try {
        const blob = await detectiveApi.fetchInvolucradoFotoBlob(expId, inv.id);
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setFotoUrl(url);
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [expId, inv.id, inv.tiene_foto]);

  return (
    <div className="exp-inv-row">
      {fotoUrl ? (
        <img src={fotoUrl} alt="" className="exp-avatar-img" />
      ) : (
        <span className="exp-avatar">{initials(`${inv.nombres} ${inv.apellidos}`)}</span>
      )}
      <div className="exp-inv-main">
        <div className="exp-inv-name">
          <strong>
            {inv.nombres} {inv.apellidos}
          </strong>
          <span className={`exp-chip ${inv.tipo === "SOSPECHOSO" ? "danger" : "info"}`}>
            {inv.tipo_label}
          </span>
        </div>
        <div className="exp-inv-meta">
          <span>C.I. {inv.cedula || "—"}</span>
          {inv.alias ? <span>Alias: {inv.alias}</span> : null}
          {inv.telefono ? <span>{inv.telefono}</span> : null}
        </div>
      </div>
      <button type="button" className="btn-ghost exp-inv-action" onClick={onVer}>
        Ver perfil
      </button>
    </div>
  );
}
