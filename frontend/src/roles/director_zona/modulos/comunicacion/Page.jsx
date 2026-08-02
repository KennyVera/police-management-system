import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { directorApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";
import "../DirectorZona.css";

const emptyForm = {
  tipo: "DISPOSICION",
  prioridad: "URGENTE",
  titulo: "",
  cuerpo: "",
};

export default function ComunicacionPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await directorApi.listDisposiciones();
      setItems(data.disposiciones || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");
    try {
      const created = await directorApi.createDisposicion(form);
      setItems((prev) => [created, ...prev]);
      setForm(emptyForm);
      setOk(
        `Disposición enviada a ${created.destinatarios_count} efectivos de la zona (notificación prioritaria).`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mod-page dir-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Comunicación Vertical</p>
          <h2>Disposiciones directas</h2>
          <p className="mod-desc">
            Memorandos e instrucciones obligatorias para Supervisores, Detectives y Agentes de su
            zona. Aparecen como notificación prioritaria. No registra partes policiales.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {ok && <p className="mod-success">{ok}</p>}

      <div className="dir-split">
        <form className="panel-card form-grid" onSubmit={submit}>
          <h3 style={{ margin: 0, gridColumn: "1 / -1" }}>Nueva disposición</h3>
          <label>
            Tipo
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="DISPOSICION">Disposición directa</option>
              <option value="MEMORANDO">Memorando</option>
              <option value="INSTRUCCION">Instrucción operativa</option>
              <option value="COMUNICADO">Comunicado</option>
            </select>
          </label>
          <label>
            Prioridad
            <select
              value={form.prioridad}
              onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
            >
              <option value="URGENTE">Urgente / prioritaria</option>
              <option value="ALTA">Alta</option>
              <option value="NORMAL">Normal</option>
            </select>
          </label>
          <label className="full">
            Título
            <input
              required
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ej. Intensificar patrullaje Sector 12 — fin de semana"
            />
          </label>
          <label className="full">
            Cuerpo / instrucción
            <textarea
              required
              rows={6}
              value={form.cuerpo}
              onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
              placeholder="Texto obligatorio que recibirán los efectivos de su zona…"
            />
          </label>
          <button type="submit" className="btn-accent full" disabled={busy}>
            <MaterialIcon name="send" />
            {busy ? "Enviando…" : "Enviar a la zona"}
          </button>
        </form>

        <section className="panel-card">
          <h3 style={{ marginTop: 0 }}>Historial emitido</h3>
          {loading ? (
            <p className="mod-muted">Cargando…</p>
          ) : (
            <div className="dir-eval-list">
              {items.map((d) => (
                <article key={d.id} className="dir-eval-card">
                  <div className="dir-eval-top">
                    <strong>{d.titulo}</strong>
                    <span
                      className={`dir-badge ${
                        d.prioridad === "URGENTE" ? "tone-danger" : "tone-info"
                      }`}
                    >
                      {d.prioridad_label}
                    </span>
                  </div>
                  <p className="mod-muted">
                    {d.tipo_label} · {d.destinatarios_count} destinatarios · {d.jurisdiccion}
                  </p>
                  <p>{d.cuerpo}</p>
                </article>
              ))}
              {!items.length && (
                <p className="mod-muted">Aún no ha emitido disposiciones.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
