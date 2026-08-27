import { useEffect, useMemo, useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { useAuth } from "../../../../../auth/AuthContext";
import { agenteApi } from "../../../api";
import "./ParteFormulario.css";

const STEPS = [
  { id: 0, label: "Información general" },
  { id: 1, label: "Personas involucradas" },
  { id: 2, label: "Evidencias" },
  { id: 3, label: "Revisión" },
];

const TIPOS_PERSONA = [
  { value: "SOSPECHOSO", label: "Sospechoso", icon: "person_alert", tone: "warn" },
  { value: "VICTIMA", label: "Víctima", icon: "personal_injury", tone: "accent" },
  { value: "TESTIGO", label: "Testigo", icon: "visibility", tone: "muted" },
  { value: "DENUNCIANTE", label: "Denunciante", icon: "campaign", tone: "muted" },
  { value: "OTRO", label: "Otra persona relacionada", icon: "person", tone: "muted" },
];

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyFromAlerta(alertaContext, oficialNombre, sectorZona = "") {
  return {
    numero_caso: "",
    tipo_delito: "",
    codigo_iucr: "",
    clasificacion_fbi: "",
    titulo: alertaContext?.titulo || "",
    fecha_hecho: todayStr(),
    hora_hecho: nowTime(),
    prioridad: "MEDIA",
    nivel_riesgo: "MEDIO",
    lugar: alertaContext?.direccion || "",
    sector_zona: sectorZona || "",
    descripcion: alertaContext
      ? `Atención a alerta: ${alertaContext.titulo}. ${alertaContext.descripcion || ""}`.trim()
      : "",
    fuente_reporte: "LLAMADA_911",
    hay_heridos: "",
    hay_armas: "",
    estado_inicial: "Clasificado",
    oficial_registra: oficialNombre || "",
    latitud: alertaContext?.latitud != null ? String(alertaContext.latitud) : "",
    longitud: alertaContext?.longitud != null ? String(alertaContext.longitud) : "",
  };
}

function fromInitial(initial, oficialNombre) {
  return {
    numero_caso: initial.numero_caso || "",
    tipo_delito: initial.tipo_delito || "",
    codigo_iucr: initial.codigo_iucr || "",
    clasificacion_fbi: initial.clasificacion_fbi || "",
    titulo: initial.titulo || "",
    fecha_hecho: initial.fecha_hecho || todayStr(),
    hora_hecho: initial.hora_hecho ? String(initial.hora_hecho).slice(0, 5) : nowTime(),
    prioridad: initial.prioridad || "MEDIA",
    nivel_riesgo: initial.nivel_riesgo || "MEDIO",
    lugar: initial.lugar || "",
    sector_zona: initial.sector_zona || "",
    descripcion: initial.descripcion || initial.relato_hechos || "",
    fuente_reporte: initial.fuente_reporte || "LLAMADA_911",
    hay_heridos: initial.hay_heridos || "",
    hay_armas: initial.hay_armas || "",
    estado_inicial: initial.estado_inicial || "Clasificado",
    oficial_registra: initial.oficial_registra || oficialNombre || "",
    latitud: initial.latitud != null ? String(initial.latitud) : "",
    longitud: initial.longitud != null ? String(initial.longitud) : "",
  };
}

function emptyPerson(tipo) {
  return {
    _key: `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    nombres: "",
    apellidos: "",
    cedula: "",
    alias: "",
    genero: "NO_ESPECIFICADO",
    telefono: "",
    direccion: "",
    observaciones: "",
  };
}

function personsFromInitial(initial) {
  return (initial?.involucrados || []).map((p, i) => ({
    _key: `inv-${p.id || i}`,
    id: p.id,
    tipo: p.tipo || "OTRO",
    nombres: p.nombres || "",
    apellidos: p.apellidos || "",
    cedula: p.cedula || "",
    alias: p.alias || "",
    genero: p.genero || "NO_ESPECIFICADO",
    telefono: p.telefono || "",
    direccion: p.direccion || "",
    observaciones: p.observaciones || "",
  }));
}

function tipoMeta(tipo) {
  return TIPOS_PERSONA.find((t) => t.value === tipo) || TIPOS_PERSONA[4];
}

function personLabel(p) {
  return `${p.nombres || ""} ${p.apellidos || ""}`.trim() || "Sin nombre";
}

function mapThumbUrl(lat, lng) {
  if (!lat || !lng) return null;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=280x140&markers=${lat},${lng},red-pushpin`;
}

export default function ParteFormulario({
  delitos = [],
  meta = {},
  initial,
  alertaId,
  alertaContext,
  readOnly = false,
  onClose,
  onSaved,
}) {
  const { user } = useAuth();
  const oficialNombre =
    meta.oficial?.nombre ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.email ||
    "";

  const sectorZonaAuto = useMemo(() => {
    const z = meta.zona_operativa;
    if (!z) return "";
    if (z.label) return z.label;
    return [z.zona_nombre, z.cuadrante, z.sector_detalle].filter(Boolean).join(" · ");
  }, [meta.zona_operativa]);

  const isEdit = Boolean(initial?.id);
  const locked =
    readOnly ||
    initial?.estado_revision === "EN_REVISION" ||
    initial?.estado_revision === "APROBADO";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() =>
    initial
      ? fromInitial(initial, oficialNombre)
      : emptyFromAlerta(alertaContext, oficialNombre, sectorZonaAuto)
  );
  const [involucrados, setInvolucrados] = useState(() => personsFromInitial(initial));
  const [personaTipo, setPersonaTipo] = useState("SOSPECHOSO");
  const [editingKey, setEditingKey] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (!sectorZonaAuto || locked) return;
    setForm((f) => {
      if (f.sector_zona && isEdit && initial?.sector_zona) return f;
      if (f.sector_zona === sectorZonaAuto) return f;
      if (isEdit && initial?.sector_zona) return f;
      return { ...f, sector_zona: sectorZonaAuto };
    });
  }, [sectorZonaAuto, locked, isEdit, initial?.sector_zona]);

  const prioridades = meta.prioridades || [
    { value: "BAJA", label: "Baja" },
    { value: "MEDIA", label: "Media" },
    { value: "ALTA", label: "Alta" },
    { value: "CRITICA", label: "Crítica" },
  ];
  const riesgos = meta.niveles_riesgo || [
    { value: "BAJO", label: "Bajo" },
    { value: "MEDIO", label: "Medio" },
    { value: "ALTO", label: "Alto" },
  ];
  const fuentes = meta.fuentes_reporte || [
    { value: "LLAMADA_911", label: "Llamada 911" },
    { value: "DENUNCIA_PRESENCIAL", label: "Denuncia presencial" },
    { value: "PATRULLAJE", label: "Patrullaje" },
    { value: "SUPERVISOR", label: "Asignación de supervisor" },
    { value: "OTRO", label: "Otro" },
  ];
  const siNo = meta.si_no || [
    { value: "SI", label: "Sí" },
    { value: "NO", label: "No" },
    { value: "DESCONOCIDO", label: "Desconocido" },
  ];
  const generos = meta.generos_involucrado || [
    { value: "NO_ESPECIFICADO", label: "No especificado" },
    { value: "MASCULINO", label: "Masculino" },
    { value: "FEMENINO", label: "Femenino" },
    { value: "OTRO", label: "Otro" },
  ];

  const delitosMap = useMemo(() => {
    const m = {};
    delitos.forEach((d) => {
      m[String(d.id)] = d;
    });
    return m;
  }, [delitos]);

  const mapUrl = mapThumbUrl(form.latitud, form.longitud);
  const osmLink =
    form.latitud && form.longitud
      ? `https://www.openstreetmap.org/?mlat=${form.latitud}&mlon=${form.longitud}#map=16/${form.latitud}/${form.longitud}`
      : null;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onTipoDelitoChange(id) {
    const d = delitosMap[String(id)];
    setForm((prev) => ({
      ...prev,
      tipo_delito: id,
      codigo_iucr: d?.codigo_iucr || "",
      clasificacion_fbi: d?.clasificacion_fbi || "",
    }));
  }

  function addPersona(tipo = personaTipo) {
    const p = emptyPerson(tipo);
    setInvolucrados((prev) => [...prev, p]);
    setEditingKey(p._key);
    setStep(1);
  }

  function changePersona(key, field, value) {
    setInvolucrados((prev) =>
      prev.map((p) => (p._key === key ? { ...p, [field]: value } : p))
    );
  }

  function removePersona(key) {
    setInvolucrados((prev) => prev.filter((p) => p._key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      return;
    }
    setGeoBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitud: String(pos.coords.latitude.toFixed(7)),
          longitud: String(pos.coords.longitude.toFixed(7)),
        }));
        setGeoBusy(false);
      },
      () => {
        setError("No se pudo obtener la ubicación actual.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function validateStep(n) {
    if (n === 0) {
      if (!form.tipo_delito || !form.titulo || !form.fecha_hecho || !form.hora_hecho) {
        return "Completa los campos obligatorios de información general.";
      }
      if (!form.lugar || !form.descripcion) {
        return "Indica el lugar y la descripción del hecho.";
      }
      if (!form.latitud || !form.longitud) {
        return "Las coordenadas GPS son obligatorias.";
      }
      if (!form.hay_heridos || !form.hay_armas) {
        return "Indica si hay heridos y si hay armas.";
      }
    }
    return "";
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(3, s + 1));
  }

  function goPrev() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (locked) return;
    const err = validateStep(0);
    if (err) {
      setError(err);
      setStep(0);
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      tipo_delito: form.tipo_delito || null,
      titulo: form.titulo,
      fecha_hecho: form.fecha_hecho,
      hora_hecho: form.hora_hecho.length === 5 ? `${form.hora_hecho}:00` : form.hora_hecho,
      prioridad: form.prioridad,
      nivel_riesgo: form.nivel_riesgo,
      lugar: form.lugar,
      sector_zona: form.sector_zona,
      descripcion: form.descripcion,
      relato_hechos: form.descripcion,
      fuente_reporte: form.fuente_reporte,
      hay_heridos: form.hay_heridos,
      hay_armas: form.hay_armas,
      latitud: form.latitud,
      longitud: form.longitud,
      fecha_hora: new Date(`${form.fecha_hecho}T${form.hora_hecho}`).toISOString(),
      involucrados: involucrados
        .filter((p) => (p.nombres || "").trim())
        .map(({ _key, id, ...rest }) => rest),
    };
    if (form.numero_caso) payload.numero_caso = form.numero_caso;
    if (alertaId) payload.alerta = alertaId;

    try {
      let saved;
      if (isEdit) saved = await agenteApi.updateParte(initial.id, payload);
      else saved = await agenteApi.createParte(payload);

      if (files?.length && saved?.id) {
        for (const file of files) {
          const fd = new FormData();
          fd.append("archivo", file);
          fd.append("descripcion", `Evidencia inicial parte ${saved.numero_caso || saved.id}`);
          fd.append("parte", String(saved.id));
          fd.append("origen", "PARTE");
          await agenteApi.uploadMultimedia(fd);
        }
      }
      setSavedAt(new Date());
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const title = locked
    ? "Consulta de parte"
    : isEdit
      ? "Editar parte policial"
      : "Nuevo parte policial";

  return (
    <div className="modal-backdrop pf-backdrop" onClick={onClose}>
      <form
        className="pf-shell"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) goNext();
          else handleSubmit(e);
        }}
      >
        <header className="pf-header">
          <div className="pf-header-titles">
            <h3>{title}</h3>
            <p>Registro de información del incidente</p>
          </div>
          <nav className="pf-stepper" aria-label="Pasos del parte">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`pf-step${step === s.id ? " is-active" : ""}${step > s.id ? " is-done" : ""}`}
                onClick={() => {
                  if (locked || s.id <= step) setStep(s.id);
                }}
              >
                <span className="pf-step-num">{s.id + 1}</span>
                <span className="pf-step-label">{s.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Cerrar">
            <MaterialIcon name="close" />
          </button>
        </header>

        {(initial?.estado_revision === "OBSERVADO" || initial?.estado_revision === "APROBADO") && (
          <div className="pf-alerts">
            {initial?.estado_revision === "OBSERVADO" && initial?.motivo_rechazo && (
              <p className="mod-error">Parte rechazado: {initial.motivo_rechazo}. Corrige y vuelve a enviar.</p>
            )}
            {initial?.estado_revision === "APROBADO" && (
              <p className="pf-ok">
                Parte aprobado y bloqueado.
                {initial.pdf_url ? (
                  <>
                    {" "}
                    <a href={initial.pdf_url} target="_blank" rel="noreferrer">
                      Descargar PDF
                    </a>
                  </>
                ) : null}
              </p>
            )}
          </div>
        )}
        {error && <p className="mod-error pf-error">{error}</p>}

        <div className={`pf-body${step === 0 ? " is-split" : ""}`}>
          <fieldset className="pf-main" disabled={locked}>
            {step === 0 && (
              <>
                <section className="pf-card">
                  <div className="pf-card-head">
                    <MaterialIcon name="assignment" />
                    <h4>Información general del incidente</h4>
                  </div>
                  <div className="pf-grid pf-grid-4">
                    <label>
                      Número de caso
                      <input
                        value={form.numero_caso}
                        placeholder="Automático al guardar"
                        onChange={(e) => setField("numero_caso", e.target.value)}
                        disabled={locked || isEdit}
                      />
                    </label>
                    <label>
                      Tipo de delito <span className="req">*</span>
                      <select required value={form.tipo_delito} onChange={(e) => onTipoDelitoChange(e.target.value)}>
                        <option value="">Seleccione...</option>
                        {delitos.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Clasificación FBI
                      <input readOnly className="readonly-input" value={form.clasificacion_fbi} placeholder="Automático" />
                    </label>
                    <label>
                      Código IUCR
                      <input readOnly className="readonly-input" value={form.codigo_iucr} placeholder="Automático" />
                    </label>
                  </div>
                  <label className="pf-full">
                    Título del incidente <span className="req">*</span>
                    <input
                      required
                      value={form.titulo}
                      placeholder="Resumen breve del caso"
                      onChange={(e) => setField("titulo", e.target.value)}
                    />
                  </label>
                  <div className="pf-grid pf-grid-2">
                    <label>
                      Fecha del hecho <span className="req">*</span>
                      <input type="date" required value={form.fecha_hecho} onChange={(e) => setField("fecha_hecho", e.target.value)} />
                    </label>
                    <label>
                      Hora del hecho <span className="req">*</span>
                      <input type="time" required value={form.hora_hecho} onChange={(e) => setField("hora_hecho", e.target.value)} />
                    </label>
                  </div>
                  <div className="pf-grid pf-grid-3">
                    <label>
                      Prioridad <span className="req">*</span>
                      <select required value={form.prioridad} onChange={(e) => setField("prioridad", e.target.value)}>
                        {prioridades.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nivel de riesgo <span className="req">*</span>
                      <select required value={form.nivel_riesgo} onChange={(e) => setField("nivel_riesgo", e.target.value)}>
                        {riesgos.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Fuente del reporte <span className="req">*</span>
                      <select required value={form.fuente_reporte} onChange={(e) => setField("fuente_reporte", e.target.value)}>
                        {fuentes.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="pf-card">
                  <div className="pf-card-head">
                    <MaterialIcon name="location_on" />
                    <h4>Ubicación del hecho</h4>
                    {!locked && (
                      <button type="button" className="btn-ghost pf-geo-btn" onClick={usarUbicacionActual} disabled={geoBusy}>
                        <MaterialIcon name="my_location" />
                        {geoBusy ? "Obteniendo…" : "Usar ubicación actual"}
                      </button>
                    )}
                  </div>
                  <label className="pf-full">
                    Lugar del hecho <span className="req">*</span>
                    <input required value={form.lugar} onChange={(e) => setField("lugar", e.target.value)} />
                  </label>
                  <label className="pf-full">
                    Sector / zona
                    <input readOnly value={form.sector_zona} placeholder="Automático según tu turno" />
                  </label>
                  <div className="pf-geo-row">
                    <div className="pf-grid pf-grid-2">
                      <label>
                        Latitud <span className="req">*</span>
                        <input required value={form.latitud} onChange={(e) => setField("latitud", e.target.value)} />
                      </label>
                      <label>
                        Longitud <span className="req">*</span>
                        <input required value={form.longitud} onChange={(e) => setField("longitud", e.target.value)} />
                      </label>
                    </div>
                    <div className="pf-map-thumb">
                      {mapUrl ? (
                        <>
                          <img src={mapUrl} alt="Vista previa del mapa" />
                          {osmLink && (
                            <a href={osmLink} target="_blank" rel="noreferrer">
                              Ver en mapa
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="mod-muted">Sin coordenadas</span>
                      )}
                    </div>
                  </div>
                  <label className="pf-full">
                    Descripción del hecho <span className="req">*</span>
                    <textarea
                      required
                      rows={4}
                      value={form.descripcion}
                      placeholder="Detalle de los hechos reportados"
                      onChange={(e) => setField("descripcion", e.target.value)}
                    />
                  </label>
                </section>
              </>
            )}

            {step === 1 && (
              <section className="pf-card">
                <div className="pf-card-head">
                  <MaterialIcon name="group" />
                  <h4>Personas involucradas</h4>
                  {!locked && (
                    <button type="button" className="btn-ghost" onClick={() => addPersona(personaTipo)}>
                      + Agregar persona
                    </button>
                  )}
                </div>
                {!involucrados.length && <p className="mod-muted">Aún no hay personas registradas.</p>}
                <div className="pf-person-list">
                  {involucrados.map((p) => {
                    const t = tipoMeta(p.tipo);
                    const open = editingKey === p._key;
                    return (
                      <article key={p._key} className={`pf-person-item${open ? " is-open" : ""}`}>
                        <div className="pf-person-row">
                          <span className={`pf-person-icon tone-${t.tone}`}>
                            <MaterialIcon name={t.icon} />
                          </span>
                          <div>
                            <strong>{personLabel(p)}</strong>
                            <p>
                              {t.label}
                              {p.cedula ? ` · C.I. ${p.cedula}` : ""}
                            </p>
                          </div>
                          {!locked && (
                            <div className="pf-person-actions">
                              <button type="button" className="pf-icon-btn" onClick={() => setEditingKey(open ? null : p._key)}>
                                <MaterialIcon name="edit" />
                              </button>
                              <button type="button" className="pf-icon-btn" onClick={() => removePersona(p._key)}>
                                <MaterialIcon name="delete" />
                              </button>
                            </div>
                          )}
                        </div>
                        {open && (
                          <div className="pf-grid pf-grid-2 pf-person-edit">
                            <label>
                              Tipo
                              <select value={p.tipo} onChange={(e) => changePersona(p._key, "tipo", e.target.value)}>
                                {TIPOS_PERSONA.map((tOpt) => (
                                  <option key={tOpt.value} value={tOpt.value}>
                                    {tOpt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Género
                              <select value={p.genero} onChange={(e) => changePersona(p._key, "genero", e.target.value)}>
                                {generos.map((g) => (
                                  <option key={g.value} value={g.value}>
                                    {g.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Nombres
                              <input value={p.nombres} onChange={(e) => changePersona(p._key, "nombres", e.target.value)} />
                            </label>
                            <label>
                              Apellidos
                              <input value={p.apellidos} onChange={(e) => changePersona(p._key, "apellidos", e.target.value)} />
                            </label>
                            <label>
                              Cédula
                              <input value={p.cedula} onChange={(e) => changePersona(p._key, "cedula", e.target.value)} />
                            </label>
                            <label>
                              Alias
                              <input value={p.alias} onChange={(e) => changePersona(p._key, "alias", e.target.value)} />
                            </label>
                            <label>
                              Teléfono
                              <input value={p.telefono} onChange={(e) => changePersona(p._key, "telefono", e.target.value)} />
                            </label>
                            <label>
                              Dirección
                              <input value={p.direccion} onChange={(e) => changePersona(p._key, "direccion", e.target.value)} />
                            </label>
                            <label className="pf-full">
                              Observaciones
                              <textarea rows={2} value={p.observaciones} onChange={(e) => changePersona(p._key, "observaciones", e.target.value)} />
                            </label>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="pf-card">
                <div className="pf-card-head">
                  <MaterialIcon name="attach_file" />
                  <h4>Evidencias / archivos iniciales</h4>
                </div>
                {!locked && (
                  <label className="pf-dropzone">
                    <MaterialIcon name="cloud_upload" />
                    <span>Arrastra archivos o haz clic para elegir</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,audio/*"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        if (!picked.length) return;
                        setFiles((prev) => {
                          const keys = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
                          const extra = picked.filter((f) => !keys.has(`${f.name}-${f.size}-${f.lastModified}`));
                          return [...prev, ...extra];
                        });
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {files.length > 0 ? (
                  <ul className="registro-files-list">
                    {files.map((f, idx) => (
                      <li key={`${f.name}-${f.size}-${idx}`}>
                        <span>
                          {f.name}
                          <span className="mod-muted"> · {(f.size / 1024).toFixed(1)} KB</span>
                        </span>
                        {!locked && (
                          <button type="button" className="btn-ghost" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}>
                            Quitar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mod-muted">Sin archivos adjuntos.</p>
                )}
              </section>
            )}

            {step === 3 && (
              <section className="pf-card pf-review">
                <div className="pf-card-head">
                  <MaterialIcon name="fact_check" />
                  <h4>Revisión antes de guardar</h4>
                </div>
                <dl className="pf-review-grid">
                  <div>
                    <dt>Título</dt>
                    <dd>{form.titulo || "—"}</dd>
                  </div>
                  <div>
                    <dt>Delito</dt>
                    <dd>{delitosMap[String(form.tipo_delito)]?.nombre || "—"}</dd>
                  </div>
                  <div>
                    <dt>Fecha / hora</dt>
                    <dd>
                      {form.fecha_hecho} {form.hora_hecho}
                    </dd>
                  </div>
                  <div>
                    <dt>Lugar</dt>
                    <dd>{form.lugar || "—"}</dd>
                  </div>
                  <div>
                    <dt>Personas</dt>
                    <dd>{involucrados.filter((p) => p.nombres.trim()).length}</dd>
                  </div>
                  <div>
                    <dt>Archivos</dt>
                    <dd>{files.length}</dd>
                  </div>
                </dl>
                <p className="mod-muted">Al guardar se crea/actualiza el borrador del parte con la información ingresada.</p>
              </section>
            )}
          </fieldset>

          {step === 0 && (
            <aside className="pf-side">
              <section className="pf-side-card">
                <label>
                  Oficial que registra
                  <input readOnly className="readonly-input" value={form.oficial_registra} />
                </label>
                <label>
                  ¿Hay heridos? <span className="req">*</span>
                  <select required value={form.hay_heridos} onChange={(e) => setField("hay_heridos", e.target.value)} disabled={locked}>
                    <option value="">Seleccione...</option>
                    {siNo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ¿Hay armas? <span className="req">*</span>
                  <select required value={form.hay_armas} onChange={(e) => setField("hay_armas", e.target.value)} disabled={locked}>
                    <option value="">Seleccione...</option>
                    {siNo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estado inicial
                  <input readOnly className="readonly-input" value={form.estado_inicial} />
                </label>
              </section>

              <section className="pf-side-card">
                <h5>Personas involucradas</h5>
                <label>
                  Tipo de persona
                  <select value={personaTipo} onChange={(e) => setPersonaTipo(e.target.value)} disabled={locked}>
                    {TIPOS_PERSONA.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {!locked && (
                  <button type="button" className="btn-accent pf-side-add" onClick={() => addPersona(personaTipo)}>
                    + Agregar persona
                  </button>
                )}
                <p className="pf-side-count">Personas registradas ({involucrados.length})</p>
                <ul className="pf-side-people">
                  {involucrados.slice(0, 6).map((p) => {
                    const t = tipoMeta(p.tipo);
                    return (
                      <li key={p._key}>
                        <span className={`pf-person-icon tone-${t.tone}`}>
                          <MaterialIcon name={t.icon} />
                        </span>
                        <div>
                          <strong>{personLabel(p)}</strong>
                          <small>
                            {t.label}
                            {p.cedula ? ` · ${p.cedula}` : ""}
                          </small>
                        </div>
                        {!locked && (
                          <button type="button" className="pf-icon-btn" onClick={() => removePersona(p._key)} aria-label="Quitar">
                            <MaterialIcon name="delete" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {!involucrados.length && <li className="mod-muted">Sin personas aún</li>}
                </ul>
              </section>

              <section className="pf-side-card">
                <h5>Archivos iniciales</h5>
                {!locked ? (
                  <label className="pf-dropzone is-compact">
                    <MaterialIcon name="upload_file" />
                    <span>
                      Arrastra o <em>Elegir archivos</em>
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,audio/*"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        if (!picked.length) return;
                        setFiles((prev) => [...prev, ...picked]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <p className="mod-muted">{files.length} archivo(s)</p>
                )}
                {files.length > 0 && (
                  <ul className="registro-files-list">
                    {files.slice(0, 4).map((f, idx) => (
                      <li key={`${f.name}-${idx}`}>
                        <span>{f.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          )}
        </div>

        <footer className="pf-footer">
          <span className="pf-draft">
            {savedAt
              ? `Borrador guardado a las ${savedAt.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
              : locked
                ? initial?.estado_revision_label || "Solo lectura"
                : "Borrador sin guardar"}
          </span>
          <div className="pf-footer-actions">
            {step > 0 ? (
              <button type="button" className="btn-ghost" onClick={goPrev}>
                Atrás
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
            )}
            {step < 3 ? (
              <button type="submit" className="btn-accent">
                Siguiente →
              </button>
            ) : (
              !locked && (
                <button type="submit" className="btn-accent" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar borrador"}
                </button>
              )
            )}
          </div>
        </footer>
      </form>
    </div>
  );
}
