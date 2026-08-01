import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../../../auth/AuthContext";
import { agenteApi } from "../../../api";

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

function emptyFromAlerta(alertaContext, oficialNombre) {
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
    sector_zona: "",
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

  const isEdit = Boolean(initial?.id);
  const locked =
    readOnly ||
    initial?.estado_revision === "EN_REVISION" ||
    initial?.estado_revision === "APROBADO";

  const [form, setForm] = useState(
    initial ? fromInitial(initial, oficialNombre) : emptyFromAlerta(alertaContext, oficialNombre)
  );
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      setOffset({
        x: e.clientX - d.startX,
        y: e.clientY - d.startY,
      });
    }
    function onUp() {
      dragRef.current = null;
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startDrag(e) {
    if (e.button !== 0) return;
    // No iniciar drag desde botones/inputs del encabezado
    if (e.target.closest("button, input, select, textarea, a")) return;
    dragRef.current = {
      startX: e.clientX - offset.x,
      startY: e.clientY - offset.y,
    };
    document.body.style.userSelect = "none";
  }

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

  const delitosMap = useMemo(() => {
    const m = {};
    delitos.forEach((d) => {
      m[String(d.id)] = d;
    });
    return m;
  }, [delitos]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (locked) return;
    if (!form.hay_heridos || !form.hay_armas) {
      setError("Indica si hay heridos y si hay armas.");
      return;
    }
    if (!form.latitud || !form.longitud) {
      setError("Las coordenadas GPS son obligatorias.");
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
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card parte-form-card is-draggable"
        style={{
          width: "min(860px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-drag-handle" onMouseDown={startDrag} title="Mantén pulsado para mover">
          <h3>
            {locked
              ? "Consulta de parte"
              : isEdit
                ? "Editar parte de servicio"
                : "Parte de servicio (desde alerta)"}
          </h3>
          <span className="modal-drag-hint">Arrastrar</span>
        </div>
        {initial?.estado_revision_label && (
          <p className="mod-muted" style={{ margin: 0 }}>
            Estado: {initial.estado_revision_label}
            {initial.alerta_titulo ? ` · Alerta: ${initial.alerta_titulo}` : ""}
          </p>
        )}
        {initial?.estado_revision === "OBSERVADO" && initial?.motivo_rechazo && (
          <p className="mod-error" style={{ margin: 0 }}>
            Parte rechazado: {initial.motivo_rechazo}. Corrige y vuelve a enviar.
          </p>
        )}
        {initial?.estado_revision === "APROBADO" && (
          <p
            style={{
              margin: 0,
              padding: "0.7rem 0.9rem",
              borderRadius: 10,
              background: "#eaf8ef",
              color: "#1f7a45",
              fontWeight: 600,
            }}
          >
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
        {error && <p className="mod-error">{error}</p>}

        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <label>
              Número de caso
              <input
                value={form.numero_caso}
                placeholder="Automático al guardar (ej. HX-2026-0001)"
                onChange={(e) => setField("numero_caso", e.target.value)}
                disabled={locked || isEdit}
              />
            </label>
            <label>
              Tipo de delito <span className="req">*</span>
              <select
                required
                value={form.tipo_delito}
                onChange={(e) => onTipoDelitoChange(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {delitos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Código IUCR
              <input readOnly className="readonly-input" value={form.codigo_iucr} placeholder="Automático" />
            </label>
            <label>
              Clasificación FBI
              <input
                readOnly
                className="readonly-input"
                value={form.clasificacion_fbi}
                placeholder="Automático según IUCR"
              />
            </label>

            <label className="full">
              Título <span className="req">*</span>
              <input
                required
                value={form.titulo}
                placeholder="Resumen breve del caso"
                onChange={(e) => setField("titulo", e.target.value)}
              />
            </label>

            <label>
              Fecha del hecho <span className="req">*</span>
              <input
                type="date"
                required
                value={form.fecha_hecho}
                onChange={(e) => setField("fecha_hecho", e.target.value)}
              />
            </label>
            <label>
              Hora del hecho <span className="req">*</span>
              <input
                type="time"
                required
                value={form.hora_hecho}
                onChange={(e) => setField("hora_hecho", e.target.value)}
              />
            </label>

            <label>
              Prioridad <span className="req">*</span>
              <select
                required
                value={form.prioridad}
                onChange={(e) => setField("prioridad", e.target.value)}
              >
                {prioridades.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nivel de riesgo <span className="req">*</span>
              <select
                required
                value={form.nivel_riesgo}
                onChange={(e) => setField("nivel_riesgo", e.target.value)}
              >
                {riesgos.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Lugar del hecho <span className="req">*</span>
              <input
                required
                value={form.lugar}
                placeholder="Ej. Vía pública, vivienda, local comercial"
                onChange={(e) => setField("lugar", e.target.value)}
              />
            </label>
            <label className="full">
              Sector / zona
              <input
                value={form.sector_zona}
                placeholder="Ej. Centro histórico, La Mariscal"
                onChange={(e) => setField("sector_zona", e.target.value)}
              />
            </label>

            <label className="full">
              Descripción <span className="req">*</span>
              <textarea
                required
                rows={4}
                value={form.descripcion}
                placeholder="Detalle de los hechos reportados"
                onChange={(e) => setField("descripcion", e.target.value)}
              />
            </label>

            <label>
              Fuente del reporte <span className="req">*</span>
              <select
                required
                value={form.fuente_reporte}
                onChange={(e) => setField("fuente_reporte", e.target.value)}
              >
                {fuentes.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ¿Hay heridos? <span className="req">*</span>
              <select
                required
                value={form.hay_heridos}
                onChange={(e) => setField("hay_heridos", e.target.value)}
              >
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
              <select
                required
                value={form.hay_armas}
                onChange={(e) => setField("hay_armas", e.target.value)}
              >
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
            <label>
              Oficial que registra
              <input readOnly className="readonly-input" value={form.oficial_registra} />
            </label>
          </div>

          <div className="gps-block">
            <div className="gps-head">
              <strong>
                Coordenadas GPS <span className="req">*</span>
              </strong>
              {!locked && (
                <button type="button" className="btn-ghost" onClick={usarUbicacionActual} disabled={geoBusy}>
                  {geoBusy ? "Obteniendo..." : "Usar ubicación actual"}
                </button>
              )}
            </div>
            <div className="form-grid">
              <label>
                Latitud
                <input
                  required
                  value={form.latitud}
                  onChange={(e) => setField("latitud", e.target.value)}
                />
              </label>
              <label>
                Longitud
                <input
                  required
                  value={form.longitud}
                  onChange={(e) => setField("longitud", e.target.value)}
                />
              </label>
            </div>
          </div>

          {!locked && (
            <label className="full stack-form" style={{ marginTop: "0.75rem" }}>
              Archivos iniciales
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,audio/*"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <span className="mod-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                Opcional: fotos, documentos o audio del reporte inicial (MinIO).
              </span>
            </label>
          )}
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          {!locked && (
            <button type="submit" className="btn-accent" disabled={saving}>
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
