import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function ParteRevisionPanel({
  parte,
  motivo,
  onMotivoChange,
  busy,
  onRechazar,
  onAprobar,
  onVerPdf,
  onDescargarPdf,
}) {
  if (!parte) {
    return <p className="mod-muted">Selecciona un parte para revisar.</p>;
  }

  const evidenciasCount = (parte.evidencias || []).length;

  return (
    <>
      <div>
        <p className="mod-kicker" style={{ margin: 0 }}>
          Revisión de calidad
        </p>
        <h3 style={{ margin: "0.25rem 0 0" }}>{parte.numero_caso || `Parte #${parte.id}`}</h3>
      </div>

      <p style={{ margin: 0 }}>
        <strong>{parte.titulo || "Sin título"}</strong>
      </p>
      <p className="mod-muted" style={{ margin: 0 }}>
        Agente: {parte.agente}
        {parte.tipo_delito_nombre ? ` · ${parte.tipo_delito_nombre}` : ""}
        {parte.codigo_iucr ? ` · IUCR ${parte.codigo_iucr}` : ""}
        {parte.clasificacion_fbi ? ` · FBI ${parte.clasificacion_fbi}` : ""}
      </p>
      <p className="mod-muted" style={{ margin: 0 }}>
        {parte.lugar || "Sin lugar"}
        {parte.sector_zona ? ` · ${parte.sector_zona}` : ""}
      </p>

      {(parte.detenido_nombres || parte.detenido_apellidos) && (
        <p style={{ margin: 0 }}>
          Detenido: {[parte.detenido_nombres, parte.detenido_apellidos].filter(Boolean).join(" ")}
          {parte.detenido_cedula ? ` · CI ${parte.detenido_cedula}` : ""}
        </p>
      )}

      <div
        style={{
          background: "#f7f8fc",
          borderRadius: 12,
          padding: "0.85rem 1rem",
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
          {parte.descripcion || parte.relato_hechos || "Sin relato."}
        </p>
      </div>

      {(parte.hay_heridos === "SI" || parte.hay_armas === "SI") && (
        <p className="mod-muted" style={{ margin: 0 }}>
          {parte.hay_heridos === "SI" ? "Hay heridos. " : ""}
          {parte.hay_armas === "SI" ? "Hay armas involucradas." : ""}
        </p>
      )}

      <p className="mod-kicker" style={{ margin: 0 }}>
        Evidencias del agente ({evidenciasCount})
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onVerPdf}>
          <MaterialIcon name="picture_as_pdf" />
          Ver PDF
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={onDescargarPdf}>
          <MaterialIcon name="download" />
          Descargar PDF
        </button>
      </div>

      <label className="stack-form">
        Comentario de corrección (si rechaza)
        <input
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder='Ej. "Corregir placa del vehículo"'
        />
      </label>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn-danger" disabled={busy} onClick={onRechazar}>
          <MaterialIcon name="undo" />
          Rechazar y devolver
        </button>
        <button type="button" className="btn-accent" disabled={busy} onClick={onAprobar}>
          <MaterialIcon name="verified" />
          Aprobar y bloquear
        </button>
      </div>
    </>
  );
}
