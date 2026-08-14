import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { facturacionApi } from "./api";
import FacturacionHeader from "./componentes/FacturacionHeader";
import ReportesFiltros from "./componentes/ReportesFiltros";
import {
  ReporteDiarioPanel,
  ReporteMensualPanel,
  ReporteAnualPanel,
} from "./componentes/ReportesPaneles";
import "../../../../shared/styles/ModuloPage.css";
import "../../../administrador/modulos/identidad_accesos/IdentidadAccesos.css";
import "./Facturacion.css";

const today = new Date();

export default function ReportesPage() {
  const [nivel, setNivel] = useState("diario");
  const [filtros, setFiltros] = useState({
    fecha: today.toISOString().slice(0, 10),
    anio: String(today.getFullYear()),
    mes: String(today.getMonth() + 1),
  });
  const [meta, setMeta] = useState({ planes: [], instituciones: [] });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const p = { ...filtros };
      let res;
      if (nivel === "diario") res = await facturacionApi.reporteDiario(p);
      else if (nivel === "mensual") res = await facturacionApi.reporteMensual(p);
      else res = await facturacionApi.reporteAnual(p);
      setData(res);
      setMeta({
        planes: res.planes || meta.planes,
        instituciones: res.instituciones || meta.instituciones,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [nivel]);

  async function exportPdf() {
    setExporting(true);
    setError("");
    try {
      await facturacionApi.reportePdf({ ...filtros, nivel });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mod-page">
      <FacturacionHeader
        title="Reportes financieros"
        desc="Diario, mensual y anual · exportación en PDF."
      >
        <button type="button" className="btn-ghost" onClick={load}>
          <MaterialIcon name="refresh" /> Actualizar
        </button>
        <button type="button" className="btn-accent" onClick={exportPdf} disabled={exporting}>
          <MaterialIcon name="picture_as_pdf" />
          {exporting ? "Generando…" : "Exportar PDF"}
        </button>
      </FacturacionHeader>

      <div className="mod-tabs">
        {[
          ["diario", "Diario"],
          ["mensual", "Mensual"],
          ["anual", "Anual"],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            className={nivel === k ? "active" : ""}
            onClick={() => setNivel(k)}
          >
            {l}
          </button>
        ))}
      </div>

      <ReportesFiltros
        value={filtros}
        onChange={setFiltros}
        planes={meta.planes}
        instituciones={meta.instituciones}
        nivel={nivel}
        onApply={load}
      />

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Generando reporte…</p>
      ) : (
        <>
          {nivel === "diario" && <ReporteDiarioPanel data={data} />}
          {nivel === "mensual" && <ReporteMensualPanel data={data} />}
          {nivel === "anual" && <ReporteAnualPanel data={data} />}
        </>
      )}
    </div>
  );
}
