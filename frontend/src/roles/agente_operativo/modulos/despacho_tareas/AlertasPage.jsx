import { useCallback, useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../api";
import DespachoMapa from "./componentes/DespachoMapa";
import AlertasListaPanel from "./componentes/AlertasListaPanel";
import AlertaDetallePanel from "./componentes/AlertaDetallePanel";
import ParteFormulario from "../registro_operativo/componentes/ParteFormulario";
import "../../../../shared/styles/ModuloPage.css";
import "../registro_operativo/RegistroOperativo.css";
import "./DespachoTareas.css";

export default function AlertasPage() {
  const [unidad, setUnidad] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [delitos, setDelitos] = useState([]);
  const [meta, setMeta] = useState({});
  const [showParte, setShowParte] = useState(false);
  const [parteInitial, setParteInitial] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pack, m] = await Promise.all([
        agenteApi.listAlertas({ estado: "activas" }),
        agenteApi.meta(),
      ]);
      const list = pack.alertas || [];
      setUnidad(pack.unidad || null);
      setAlertas(list);
      setMeta(m);
      setDelitos(m.tipos_delito || []);
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 25000);
    return () => clearInterval(id);
  }, [load]);

  const selected = alertas.find((a) => a.id === selectedId) || null;

  async function run(action) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await action(selected.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAbrirParte() {
    if (!selected?.puede_abrir_parte) return;
    setBusy(true);
    setError("");
    try {
      if (selected.parte?.id) {
        const found = await agenteApi.getParte(selected.parte.id);
        setParteInitial(found || null);
      } else {
        setParteInitial(null);
      }
      setShowParte(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mod-page despacho-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Despacho y Tareas · Mi Turno</p>
          <h2>Alertas ECU-911</h2>
          <p className="mod-desc">
            Visualiza la ruta hacia el incidente, avanza el despacho y abre el parte solo al
            llegar al lugar.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" />
          Actualizar
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}

      {loading && !alertas.length ? (
        <p className="mod-muted">Cargando despacho...</p>
      ) : (
        <div className="despacho-layout">
          <div className="despacho-main">
            <DespachoMapa unidad={unidad} alerta={selected} />
            <div className="panel-card alertas-panel">
              <div className="alertas-panel-head">
                <h3>Alertas activas</h3>
                <span className="mod-muted">{alertas.length}</span>
              </div>
              <AlertasListaPanel
                alertas={alertas}
                selectedId={selectedId}
                onSelect={(a) => setSelectedId(a.id)}
              />
            </div>
          </div>

          <AlertaDetallePanel
            alerta={selected}
            busy={busy}
            onEnCamino={() => run(agenteApi.alertaEnCamino)}
            onLlegada={() => run(agenteApi.alertaLlegada)}
            onAbrirParte={handleAbrirParte}
          />
        </div>
      )}

      {showParte && (
        <ParteFormulario
          delitos={delitos}
          meta={meta}
          initial={parteInitial}
          alertaId={selected?.id}
          alertaContext={selected}
          onClose={() => setShowParte(false)}
          onSaved={() => {
            setShowParte(false);
            load();
          }}
        />
      )}
    </div>
  );
}
