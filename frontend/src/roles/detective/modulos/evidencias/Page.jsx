import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { detectiveApi } from "../../api";
import "../../../../shared/styles/ModuloPage.css";

export default function EvidenciasPage() {
  const [expedientes, setExpedientes] = useState([]);
  const [meta, setMeta] = useState({ categorias_fisicas: [] });
  const [expedienteId, setExpedienteId] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("lista");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [digital, setDigital] = useState({ descripcion: "", archivo: null });
  const [fisica, setFisica] = useState({
    descripcion: "",
    categoria_fisica: "ARMA",
    numero_serie: "",
    peso: "",
    caracteristicas: "",
    ubicacion_actual: "Bodega de evidencias",
  });
  const [custodia, setCustodia] = useState({
    entregado_por: "",
    recibido_por: "",
    destino: "",
    motivo: "",
    observaciones: "",
  });

  async function loadBase() {
    setLoading(true);
    setError("");
    try {
      const [exps, m] = await Promise.all([
        detectiveApi.listExpedientes(),
        detectiveApi.evidenciasMeta(),
      ]);
      setExpedientes(exps);
      setMeta(m);
      if (!expedienteId && exps[0]) setExpedienteId(String(exps[0].id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvidencias(expId = expedienteId) {
    if (!expId) {
      setItems([]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const list = await detectiveApi.listEvidencias({ expediente: expId });
      setItems(list);
      if (selected) {
        const refreshed = list.find((x) => x.id === selected.id);
        setSelected(refreshed ? await detectiveApi.getEvidencia(refreshed.id) : null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (expedienteId) loadEvidencias(expedienteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  async function submitDigital(e) {
    e.preventDefault();
    if (!expedienteId || !digital.archivo) {
      setError("Selecciona expediente y archivo.");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const fd = new FormData();
      fd.append("expediente", expedienteId);
      fd.append("descripcion", digital.descripcion);
      fd.append("archivo", digital.archivo);
      await detectiveApi.uploadDigital(fd);
      setDigital({ descripcion: "", archivo: null });
      setOk("Evidencia digital cargada en MinIO.");
      setTab("lista");
      await loadEvidencias();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitFisica(e) {
    e.preventDefault();
    if (!expedienteId) {
      setError("Selecciona un expediente.");
      return;
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      await detectiveApi.createFisica({ ...fisica, expediente: Number(expedienteId) });
      setFisica({
        descripcion: "",
        categoria_fisica: "ARMA",
        numero_serie: "",
        peso: "",
        caracteristicas: "",
        ubicacion_actual: "Bodega de evidencias",
      });
      setOk("Evidencia física registrada.");
      setTab("lista");
      await loadEvidencias();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCustodia(e) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      await detectiveApi.registrarCustodia(selected.id, custodia);
      setCustodia({
        entregado_por: "",
        recibido_por: "",
        destino: "",
        motivo: "",
        observaciones: "",
      });
      setOk("Movimiento de custodia registrado.");
      setSelected(await detectiveApi.getEvidencia(selected.id));
      await loadEvidencias();
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
          <p className="mod-kicker">Evidencias y Cadena de Custodia</p>
          <h2>Registro estricto de evidencias</h2>
          <p className="mod-desc">
            Carga digital en MinIO, inventario físico y trazabilidad de entregas (laboratorio /
            fiscalía).
          </p>
        </div>
      </header>

      <div className="panel-card" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ flex: 1, minWidth: 220 }}>
          Expediente
          <select value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)}>
            <option value="">Seleccionar...</option>
            {expedientes.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.numero_expediente} · {ex.titulo}
              </option>
            ))}
          </select>
        </label>
        <div className="mod-tabs">
          <button type="button" className={tab === "lista" ? "active" : ""} onClick={() => setTab("lista")}>
            Inventario
          </button>
          <button type="button" className={tab === "digital" ? "active" : ""} onClick={() => setTab("digital")}>
            Cargar digital
          </button>
          <button type="button" className={tab === "fisica" ? "active" : ""} onClick={() => setTab("fisica")}>
            Registrar física
          </button>
        </div>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {ok && (
        <p className="mod-muted" style={{ background: "#eaf8ef", padding: "0.7rem 0.9rem", borderRadius: 10, color: "#1f7a45" }}>
          {ok}
        </p>
      )}

      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : tab === "digital" ? (
        <form className="panel-card form-grid" onSubmit={submitDigital}>
          <label className="full">
            Descripción
            <input
              required
              value={digital.descripcion}
              onChange={(e) => setDigital({ ...digital, descripcion: e.target.value })}
              placeholder="Foto escena / video / PDF..."
            />
          </label>
          <label className="full">
            Archivo
            <input
              required
              type="file"
              onChange={(e) => setDigital({ ...digital, archivo: e.target.files?.[0] || null })}
            />
          </label>
          <div className="full">
            <button type="submit" className="btn-accent" disabled={busy}>
              <MaterialIcon name="cloud_upload" />
              Subir a MinIO
            </button>
          </div>
        </form>
      ) : tab === "fisica" ? (
        <form className="panel-card form-grid" onSubmit={submitFisica}>
          <label>
            Categoría
            <select
              value={fisica.categoria_fisica}
              onChange={(e) => setFisica({ ...fisica, categoria_fisica: e.target.value })}
            >
              {(meta.categorias_fisicas || []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nº serie
            <input
              value={fisica.numero_serie}
              onChange={(e) => setFisica({ ...fisica, numero_serie: e.target.value })}
            />
          </label>
          <label>
            Peso
            <input
              value={fisica.peso}
              onChange={(e) => setFisica({ ...fisica, peso: e.target.value })}
              placeholder="ej. 0.85 kg"
            />
          </label>
          <label>
            Ubicación
            <input
              value={fisica.ubicacion_actual}
              onChange={(e) => setFisica({ ...fisica, ubicacion_actual: e.target.value })}
            />
          </label>
          <label className="full">
            Descripción
            <input
              required
              value={fisica.descripcion}
              onChange={(e) => setFisica({ ...fisica, descripcion: e.target.value })}
            />
          </label>
          <label className="full">
            Características
            <textarea
              rows={2}
              value={fisica.caracteristicas}
              onChange={(e) => setFisica({ ...fisica, caracteristicas: e.target.value })}
              style={{ border: "1px solid #e5e9f2", borderRadius: 10, padding: "0.6rem", font: "inherit" }}
            />
          </label>
          <div className="full">
            <button type="submit" className="btn-accent" disabled={busy}>
              <MaterialIcon name="inventory" />
              Registrar evidencia física
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "1rem" }}>
          <div className="panel-card" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Custodio</th>
                  <th>Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={async () => setSelected(await detectiveApi.getEvidencia(ev.id))}
                    style={{
                      cursor: "pointer",
                      background: selected?.id === ev.id ? "#f1ebff" : undefined,
                    }}
                  >
                    <td>{ev.codigo}</td>
                    <td>{ev.tipo_label}</td>
                    <td>{ev.descripcion}</td>
                    <td>{ev.custodio_actual || "—"}</td>
                    <td>{ev.ubicacion_actual || "—"}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={5} className="mod-muted">
                      Sin evidencias en este expediente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="panel-card" style={{ display: "grid", gap: "0.75rem", alignContent: "start" }}>
            {!selected ? (
              <p className="mod-muted">Selecciona una evidencia para ver custodia.</p>
            ) : (
              <>
                <div>
                  <p className="mod-kicker" style={{ margin: 0 }}>
                    {selected.tipo_label}
                  </p>
                  <h3 style={{ margin: "0.2rem 0" }}>{selected.codigo}</h3>
                  <p style={{ margin: 0 }}>{selected.descripcion}</p>
                </div>
                {selected.tipo === "DIGITAL" && selected.url && (
                  <a className="btn-ghost" href={selected.url} target="_blank" rel="noreferrer">
                    <MaterialIcon name="open_in_new" />
                    Abrir archivo
                  </a>
                )}
                {selected.tipo === "FISICA" && (
                  <p className="mod-muted" style={{ margin: 0 }}>
                    {selected.categoria_fisica_label}
                    {selected.numero_serie ? ` · Serie ${selected.numero_serie}` : ""}
                    {selected.peso ? ` · ${selected.peso}` : ""}
                  </p>
                )}

                <div>
                  <p className="mod-kicker">Cadena de custodia</p>
                  <div style={{ display: "grid", gap: "0.4rem", maxHeight: 180, overflow: "auto" }}>
                    {(selected.movimientos || []).map((m) => (
                      <div key={m.id} style={{ background: "#f7f8fc", borderRadius: 10, padding: "0.55rem 0.7rem" }}>
                        <strong>{m.destino}</strong>
                        <div className="mod-muted" style={{ fontSize: "0.82rem" }}>
                          {m.entregado_por} → {m.recibido_por}
                          <br />
                          {m.motivo}
                        </div>
                      </div>
                    ))}
                    {!selected.movimientos?.length && (
                      <p className="mod-muted" style={{ margin: 0 }}>
                        Sin movimientos registrados.
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={submitCustodia} className="form-grid" style={{ margin: 0 }}>
                  <label>
                    Entrega
                    <input
                      required
                      value={custodia.entregado_por}
                      onChange={(e) => setCustodia({ ...custodia, entregado_por: e.target.value })}
                    />
                  </label>
                  <label>
                    Recibe
                    <input
                      required
                      value={custodia.recibido_por}
                      onChange={(e) => setCustodia({ ...custodia, recibido_por: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    Destino
                    <input
                      required
                      value={custodia.destino}
                      onChange={(e) => setCustodia({ ...custodia, destino: e.target.value })}
                      placeholder="Lab. Criminalística / Fiscalía..."
                    />
                  </label>
                  <label className="full">
                    Motivo
                    <input
                      required
                      value={custodia.motivo}
                      onChange={(e) => setCustodia({ ...custodia, motivo: e.target.value })}
                    />
                  </label>
                  <div className="full">
                    <button type="submit" className="btn-accent" disabled={busy}>
                      <MaterialIcon name="swap_horiz" />
                      Registrar entrega
                    </button>
                  </div>
                </form>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
