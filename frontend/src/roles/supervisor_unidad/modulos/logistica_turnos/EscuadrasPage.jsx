import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import EscuadrasLista from "./componentes/EscuadrasLista";
import EscuadraFormulario from "./componentes/EscuadraFormulario";
import AsignarVehiculoModal from "./componentes/AsignarVehiculoModal";
import "../../../../shared/styles/ModuloPage.css";

export default function EscuadrasPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ agentes: [] });
  const [vehiculos, setVehiculos] = useState([]);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [escuadraVehiculo, setEscuadraVehiculo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(f = fecha) {
    setLoading(true);
    setError("");
    try {
      const [list, m, veh] = await Promise.all([
        supervisorApi.listEscuadras({ fecha: f }),
        supervisorApi.meta(),
        supervisorApi.listVehiculos(),
      ]);
      setItems(list);
      setMeta(m);
      setVehiculos(veh);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Gestión de Turnos · Logística Diaria</p>
          <h2>Asignación de Escuadras</h2>
          <p className="mod-desc">
            Crea los grupos de trabajo diarios y asígnales el vehículo del turno.
          </p>
        </div>
        <button type="button" className="btn-accent" onClick={() => setShowForm(true)}>
          <MaterialIcon name="group_add" />
          Nueva escuadra
        </button>
      </header>

      <div className="panel-card" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 600 }}>
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <button type="button" className="btn-ghost" onClick={() => load(fecha)}>
          <MaterialIcon name="search" />
          Filtrar
        </button>
      </div>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <EscuadrasLista
          items={items}
          onAsignarVehiculo={setEscuadraVehiculo}
          onInactivar={async (id) => {
            await supervisorApi.inactivarEscuadra(id);
            load();
          }}
        />
      )}

      {showForm && (
        <EscuadraFormulario
          agentes={meta.agentes || []}
          fechaDefault={fecha}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {escuadraVehiculo && (
        <AsignarVehiculoModal
          escuadra={escuadraVehiculo}
          vehiculos={vehiculos}
          onClose={() => setEscuadraVehiculo(null)}
          onSaved={() => {
            setEscuadraVehiculo(null);
            load();
          }}
        />
      )}
    </div>
  );
}
