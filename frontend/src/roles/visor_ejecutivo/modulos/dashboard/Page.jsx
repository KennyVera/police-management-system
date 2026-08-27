import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../../../../shared/theme/ThemeContext";
import {
  FILTER_DEFAULTS,
  KPIS,
} from "./data/demoPanorama";
import MapaChoropleth from "./componentes/MapaChoropleth";
import RankingZonasChart from "./componentes/RankingZonasChart";
import MatrizDelitosChart from "./componentes/MatrizDelitosChart";
import EvolucionDelitosChart from "./componentes/EvolucionDelitosChart";
import "./VisorEjecutivo.css";
import "./VisorEjecutivoDark.css";

function Sparkline({ values, color }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 88;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="ve-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" points={pts} />
    </svg>
  );
}

function KpiCard({ kpi }) {
  const { badge, spark, sparkColor } = kpi;
  const tone = badge.tone || "info";
  return (
    <article className="ve-kpi">
      <div className="ve-kpi-top">
        <span className={`ve-kpi-icon tone-${tone}`}>
          <span className="material-symbols-outlined">{kpi.icon}</span>
        </span>
        <h3>{kpi.title}</h3>
      </div>
      <p className="ve-kpi-value">
        {kpi.value}
        <small>{kpi.unit}</small>
      </p>
      <div className="ve-kpi-foot">
        <span className={`ve-badge ${tone}`}>
          {badge.dir === "up" && <span className="material-symbols-outlined">arrow_upward</span>}
          {badge.dir === "down" && <span className="material-symbols-outlined">arrow_downward</span>}
          {badge.text}
        </span>
        <Sparkline values={spark} color={sparkColor} />
      </div>
    </article>
  );
}

const GEO_URL = "/geo/provincias_ecuador.geojson";

export default function Page() {
  const { isDark } = useTheme();
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [geojson, setGeojson] = useState(null);
  const [geoError, setGeoError] = useState("");
  const [selectedProv, setSelectedProv] = useState(null);
  const [agrupacion, setAgrupacion] = useState("mensual");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(GEO_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setGeojson(data);
      } catch (err) {
        if (!cancelled) setGeoError(err.message || "No se pudo cargar el GeoJSON");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearFilters = () => setFilters(FILTER_DEFAULTS);

  const onSelectProvince = useCallback((feature) => {
    setSelectedProv({
      nombre: feature.properties?.nombre || feature.properties?.dpa_despro,
      densidad: feature.properties?.densidad_crimen,
    });
  }, []);

  const exportPdf = () => {
    document.body.classList.add("ve-printing");
    window.print();
    setTimeout(() => document.body.classList.remove("ve-printing"), 500);
  };

  return (
    <div className="ve-dash" id="ve-dash-print">
      <header className="ve-head">
        <div>
          <h2>Panorama Estratégico Nacional</h2>
          <p className="ve-sub">
            Inteligencia consolidada para la toma de decisiones de alto nivel.
          </p>
        </div>
        <div className="ve-head-utils">
          <button type="button" className="ve-btn-export" onClick={exportPdf}>
            <span className="material-symbols-outlined">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>
      </header>

      <section className="ve-filters">
        <label>
          Rango de tiempo
          <select
            value={filters.rango}
            onChange={(e) => setFilters((f) => ({ ...f, rango: e.target.value }))}
          >
            <option value="ytd">YTD (Año a la Fecha)</option>
            <option value="trimestre">Último trimestre</option>
            <option value="mes">Último mes</option>
            <option value="anio">Año completo</option>
          </select>
        </label>
        <label>
          Año
          <select
            value={filters.anio}
            onChange={(e) => setFilters((f) => ({ ...f, anio: e.target.value }))}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </label>
        <label>
          Comparar con
          <select
            value={filters.comparar}
            onChange={(e) => setFilters((f) => ({ ...f, comparar: e.target.value }))}
          >
            <option value="2025">2025 (Año Anterior)</option>
            <option value="2024">2024</option>
            <option value="promedio">Promedio 3 años</option>
          </select>
        </label>
        <label>
          Nivel geográfico
          <select
            value={filters.nivel}
            onChange={(e) => setFilters((f) => ({ ...f, nivel: e.target.value }))}
          >
            <option value="nacional">Nacional</option>
            <option value="zona">Por Zona</option>
            <option value="provincia">Por Provincia</option>
          </select>
        </label>
        <button type="button" className="ve-btn-clear" onClick={clearFilters}>
          Limpiar filtros
        </button>
      </section>

      {selectedProv && (
        <p className="ve-selection">
          Provincia seleccionada: <strong>{selectedProv.nombre}</strong>
          {" · "}Índice {selectedProv.densidad}
          <button type="button" onClick={() => setSelectedProv(null)}>
            Cerrar
          </button>
        </p>
      )}

      <section className="ve-kpis">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <section className="ve-body">
        <article className="ve-card ve-map-card">
          <div className="ve-card-head">
            <h3>Mapa de Criminalidad por Provincia</h3>
          </div>
          {geoError ? (
            <p className="ve-error">Error al cargar GeoJSON: {geoError}</p>
          ) : (
            <MapaChoropleth
              geojson={geojson}
              isDark={isDark}
              onSelectProvince={onSelectProvince}
            />
          )}
        </article>

        <div className="ve-side">
          <article className="ve-card">
            <div className="ve-card-head">
              <h3>Ranking de Zonas</h3>
              <button type="button" className="ve-link-btn">
                Ver detalle por zona
              </button>
            </div>
            <RankingZonasChart isDark={isDark} />
          </article>

          <article className="ve-card">
            <div className="ve-card-head">
              <h3>Matriz de Delitos de Alto Impacto</h3>
            </div>
            <MatrizDelitosChart isDark={isDark} />
          </article>
        </div>
      </section>

      <section className="ve-card ve-evolucion">
        <div className="ve-card-head">
          <h3>Evolución de Delitos</h3>
          <div className="ve-evolucion-actions">
            <label>
              Agrupación
              <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)}>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="semanal">Semanal</option>
              </select>
            </label>
            <button type="button" className="ve-icon-btn" title="Descargar" onClick={exportPdf}>
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>
        <EvolucionDelitosChart
          isDark={isDark}
          anioActual={filters.anio}
          anioCompare={filters.comparar === "promedio" ? "Promedio" : filters.comparar}
        />
      </section>

      <footer className="ve-footer">
        Información clasificada — Uso exclusivo del Alto Mando Policial — Ley de
        Seguridad Pública y del Estado.
      </footer>
    </div>
  );
}
