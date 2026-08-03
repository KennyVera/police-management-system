import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { directorApi } from "../../../api";
import "leaflet/dist/leaflet.css";
import "./MapaCalor.css";

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

function heatColor(peso, max) {
  const t = max > 0 ? Math.min(1, peso / max) : 0.3;
  if (t > 0.7) return "#b91c1c";
  if (t > 0.4) return "#f59e0b";
  return "#22c55e";
}

function RadarChart({ dias, selectedDow, onSelect }) {
  const w = 280;
  const h = 280;
  const cx = w / 2;
  const cy = h / 2;
  const r = 95;
  const data = dias?.length ? dias : [];
  const max = Math.max(1, ...data.map((d) => d.total || 0));
  const n = Math.max(data.length, 1);

  const points = data.map((d, i) => {
    const ang = (-Math.PI / 2) + (i / n) * Math.PI * 2;
    const rr = (d.total / max) * r;
    return {
      ...d,
      x: cx + Math.cos(ang) * rr,
      y: cy + Math.sin(ang) * rr,
      lx: cx + Math.cos(ang) * (r + 22),
      ly: cy + Math.sin(ang) * (r + 22),
      ax: cx + Math.cos(ang) * r,
      ay: cy + Math.sin(ang) * r,
    };
  });

  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dz-radar-svg" role="img" aria-label="Reloj criminológico">
      {[0.33, 0.66, 1].map((t) => (
        <circle key={t} cx={cx} cy={cy} r={r * t} fill="none" stroke="#e8ecf3" />
      ))}
      {points.map((p) => (
        <line key={`a-${p.dia_semana}`} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#eef2f7" />
      ))}
      {points.length > 2 && (
        <polygon points={poly} fill="rgba(124,92,191,0.22)" stroke="#7c5cbf" strokeWidth="2" />
      )}
      {points.map((p) => (
        <g key={p.dia_semana}>
          <circle
            cx={p.x}
            cy={p.y}
            r={selectedDow === p.dia_semana ? 7 : 5}
            fill={selectedDow === p.dia_semana ? "#ef4444" : "#7c5cbf"}
            className="dz-radar-hit"
            onClick={() => onSelect?.(p)}
          />
          <text
            x={p.lx}
            y={p.ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`dz-radar-label${selectedDow === p.dia_semana ? " active" : ""}`}
            onClick={() => onSelect?.(p)}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function MapaCalor({ filters, radar, loading, onMapaChange }) {
  const [mapa, setMapa] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedDow, setSelectedDow] = useState(null);
  const [selectedHora, setSelectedHora] = useState(null);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError("");
    const params = {
      ...filters,
      limit: 2000,
    };
    if (selectedDow != null) params.dia_semana = selectedDow;
    if (selectedHora != null) params.hora = selectedHora;

    directorApi
      .mapaCalor(params)
      .then((d) => {
        if (!alive) return;
        setMapa(d);
        onMapaChange?.(d);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        onMapaChange?.(null);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [filters, selectedDow, selectedHora, onMapaChange]);

  const puntos = mapa?.puntos || [];
  const maxPeso = useMemo(
    () => puntos.reduce((acc, p) => Math.max(acc, p.peso || 0), 1),
    [puntos]
  );
  const mapPoints = useMemo(
    () => puntos.map((p) => [p.latitud, p.longitud]),
    [puntos]
  );

  const picos = radar?.picos || [];

  function onRadarSelect(punto) {
    if (selectedDow === punto.dia_semana && selectedHora == null) {
      setSelectedDow(null);
      return;
    }
    setSelectedDow(punto.dia_semana);
    setSelectedHora(null);
  }

  function onPicoClick(pico) {
    if (selectedDow === pico.dia_semana && selectedHora === pico.hora) {
      setSelectedDow(null);
      setSelectedHora(null);
      return;
    }
    setSelectedDow(pico.dia_semana);
    setSelectedHora(pico.hora);
  }

  function clearTemporal() {
    setSelectedDow(null);
    setSelectedHora(null);
  }

  return (
    <div className="dz-mapa">
      <article className="dz-card dz-mapa-main">
        <div className="dz-card-head">
          <h3>
            Mapa de calor · {mapa?.total_puntos ?? 0} focos
            {(busy || loading) && <small> actualizando…</small>}
          </h3>
          {(selectedDow != null || selectedHora != null) && (
            <button type="button" className="dz-clear-filter" onClick={clearTemporal}>
              <MaterialIcon name="filter_alt_off" />
              Quitar filtro temporal
            </button>
          )}
        </div>
        {error && <p className="dz-map-error">{error}</p>}
        <div className="dz-map-wrap">
          <MapContainer
            center={mapPoints[0] || [-0.18, -78.47]}
            zoom={12}
            className="dz-map"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={mapPoints} />
            {puntos.map((p, idx) => (
              <CircleMarker
                key={`${p.latitud}-${p.longitud}-${idx}`}
                center={[p.latitud, p.longitud]}
                radius={8 + Math.min(18, (p.peso / maxPeso) * 18)}
                pathOptions={{
                  color: heatColor(p.peso, maxPeso),
                  fillColor: heatColor(p.peso, maxPeso),
                  fillOpacity: 0.55,
                  weight: 1,
                }}
              >
                <Popup>
                  <strong>{p.tipo_delito || "Delito"}</strong>
                  <br />
                  Peso: {p.peso}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        {!puntos.length && !busy && (
          <p className="dz-empty-inline">No hay coordenadas para el filtro actual.</p>
        )}
        <div className="dz-heat-legend">
          <span><i className="h green" /> Baja</span>
          <span><i className="h orange" /> Media</span>
          <span><i className="h red" /> Alta densidad</span>
        </div>
      </article>

      <aside className="dz-card dz-radar-card">
        <div className="dz-card-head">
          <h3>Reloj criminológico</h3>
        </div>
        <p className="dz-radar-hint">
          Clic en un día del radar para filtrar el mapa. Clic en un pico (día + hora) para afinar.
        </p>
        <RadarChart
          dias={radar?.dias || []}
          selectedDow={selectedDow}
          onSelect={onRadarSelect}
        />
        <div className="dz-picos">
          <h4>Picos detectados</h4>
          {picos.length === 0 ? (
            <p className="dz-empty-inline">Sin picos en el rango.</p>
          ) : (
            picos.map((p, i) => (
              <button
                key={`${p.dia_semana}-${p.hora}-${i}`}
                type="button"
                className={`dz-pico${
                  selectedDow === p.dia_semana && selectedHora === p.hora ? " active" : ""
                }`}
                onClick={() => onPicoClick(p)}
              >
                <strong>
                  {p.dia_label} {String(p.hora).padStart(2, "0")}:00
                </strong>
                <span>{p.total} incidentes</span>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
