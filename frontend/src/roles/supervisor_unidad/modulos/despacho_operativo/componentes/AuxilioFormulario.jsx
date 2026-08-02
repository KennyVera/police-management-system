import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function AuxilioFormulario({ meta, form, setForm, saving, onSubmit }) {
  return (
    <form className="auxilio-registro-form" onSubmit={onSubmit}>
      <h3>Registrar alerta entrante</h3>
      <div className="form-grid">
        <label className="full">
          Título
          <input
            required
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Robo en progreso"
          />
        </label>
        <label>
          Origen
          <select
            value={form.origen}
            onChange={(e) => setForm({ ...form, origen: e.target.value })}
          >
            {(meta.origenes || ["ECU-911"]).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select
            value={form.prioridad}
            onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
          >
            {(meta.prioridades || []).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          Dirección
          <input
            required
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Selecciona un punto en el mapa"
          />
        </label>
        <label className="full">
          Referencia <span className="mod-muted">(opcional)</span>
          <input
            value={form.referencia}
            onChange={(e) => setForm({ ...form, referencia: e.target.value })}
            placeholder="Se completa si el mapa detecta un lugar cercano"
          />
        </label>
        <label className="full">
          Descripción
          <textarea
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            style={{
              border: "1px solid #e5e9f2",
              borderRadius: 10,
              padding: "0.6rem",
              font: "inherit",
            }}
          />
        </label>
        <label>
          Latitud
          <input
            value={form.latitud}
            onChange={(e) => setForm({ ...form, latitud: e.target.value })}
            readOnly
          />
        </label>
        <label>
          Longitud
          <input
            value={form.longitud}
            onChange={(e) => setForm({ ...form, longitud: e.target.value })}
            readOnly
          />
        </label>
        <div className="full">
          <button type="submit" className="btn-accent" disabled={saving}>
            <MaterialIcon name="emergency" />
            {saving ? "Guardando..." : "Ingresar a bandeja"}
          </button>
        </div>
      </div>
    </form>
  );
}
