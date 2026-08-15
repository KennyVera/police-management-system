import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { supervisorApi } from "../../api";
import "./CuadranteMapaModal.css";

function FitBounds({ features }) {
  const map = useMap();
  useEffect(() => {
    if (!features?.length) return;
    const latLngs = [];
    for (const f of features) {
      const ring = f?.poligono?.coordinates?.[0];
      if (!ring) continue;
      for (const [lng, lat] of ring) {
        latLngs.push([lat, lng]);
      }
    }
    if (!latLngs.length) return;
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [map, features]);
  return null;
}

function ringToLatLngs(poligono) {
  const ring = poligono?.coordinates?.[0] || [];
  return ring.map(([lng, lat]) => [lat, lng]);
}

export default function CuadranteMapaModal({ open, onClose, onConfirm }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSelectedId(null);
      try {
        const res = await supervisorApi.cuadrantesMapa();
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || "No se pudo cargar el mapa");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const center = useMemo(() => {
    const c = data?.centro;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) {
      return [c.lat, c.lng];
    }
    return [-0.1807, -78.4678];
  }, [data]);

  const selected = useMemo(
    () => (data?.cuadrantes || []).find((c) => c.id === selectedId) || null,
    [data, selectedId]
  );

  if (!open) return null;

  function handleConfirm() {
    if (!selected) return;
    onConfirm({
      cuadrante: selected.nombre,
      sector_detalle: selected.detalle_ruta,
      poligono: selected.poligono,
      latitud: selected.centro?.lat,
      longitud: selected.centro?.lng,
      cuadrante_id: selected.id,
    });
  }

  return (
    <div className="modal-backdrop sector-map-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card sector-map-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sector-map-title"
      >
        <header className="sector-map-head">
          <div>
            <h3 id="sector-map-title">Seleccionar cuadrante en mapa</h3>
            <p className="mod-muted" style={{ margin: 0 }}>
              Zona: <strong>{data?.zona || "…"}</strong>. Haz clic en un bloque y confirma.
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar">
            <MaterialIcon name="close" />
          </button>
        </header>

        {error && <p className="mod-error">{error}</p>}
        {loading ? (
          <p className="mod-muted sector-map-loading">Cargando mapa de cuadrantes…</p>
        ) : (
          <>
            <div className="sector-map-canvas">
              <MapContainer
                center={center}
                zoom={data?.zoom || 14}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds features={data?.cuadrantes || []} />
                {(data?.cuadrantes || []).map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <Polygon
                      key={c.id}
                      positions={ringToLatLngs(c.poligono)}
                      pathOptions={{
                        color: active ? "#7c3aed" : "#2563eb",
                        weight: active ? 3 : 1.5,
                        fillColor: active ? "#a78bfa" : "#3b82f6",
                        fillOpacity: active ? 0.45 : 0.28,
                      }}
                      eventHandlers={{
                        click: () => setSelectedId(c.id),
                      }}
                    />
                  );
                })}
              </MapContainer>
            </div>

            <div className="sector-map-selection">
              {selected ? (
                <>
                  <p>
                    <strong>{selected.nombre}</strong>
                  </p>
                  <p className="mod-muted" style={{ margin: 0 }}>
                    {selected.detalle_ruta}
                  </p>
                </>
              ) : (
                <p className="mod-muted" style={{ margin: 0 }}>
                  Ningún cuadrante seleccionado. Toca un polígono semitransparente.
                </p>
              )}
            </div>
          </>
        )}

        <div className="modal-actions sector-map-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-accent"
            disabled={!selected || loading}
            onClick={handleConfirm}
          >
            <MaterialIcon name="check_circle" />
            Confirmar selección
          </button>
        </div>
      </div>
    </div>
  );
}
