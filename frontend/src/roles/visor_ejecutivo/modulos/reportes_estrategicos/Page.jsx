import { useCallback, useEffect, useState } from "react";
import { descargarReporteArchivo, visorReportesApi } from "../../api";
import "./ReportesEstrategicos.css";
import "./ReportesEstrategicosDark.css";

const FALLBACK = [
  {
    slug: "dossier-presidencial",
    titulo: "Dossier Presidencial",
    descripcion:
      "Resumen ejecutivo nacional, mapas de calor macro y tasa de criminalidad global para toma de decisión de gobierno.",
    icono: "account_balance",
    fuentes: ["ClickHouse", "PostgreSQL"],
    endpoint: "dossier-presidencial/",
    filename_stub: "dossier_presidencial.pdf",
  },
  {
    slug: "auditoria-comandantes",
    titulo: "Auditoría de Desempeño de Comandantes",
    descripcion:
      "Ranking de eficiencia cruzando fuerza logística (Postgres) vs. resolución de delitos (ClickHouse).",
    icono: "military_tech",
    fuentes: ["PostgreSQL", "ClickHouse"],
    endpoint: "auditoria-comandantes/",
    filename_stub: "auditoria_comandantes.pdf",
  },
  {
    slug: "impacto-presupuestario",
    titulo: "Análisis de Impacto Presupuestario",
    descripcion:
      "Relación costo-beneficio entre inversión logística y reducción porcentual de la criminalidad.",
    icono: "payments",
    fuentes: ["PostgreSQL", "ClickHouse"],
    endpoint: "impacto-presupuestario/",
    filename_stub: "impacto_presupuestario.pdf",
  },
  {
    slug: "cuellos-botella",
    titulo: "Informe de Cuellos de Botella (Impunidad)",
    descripcion:
      "Trazabilidad de tiempos muertos entre la creación del parte y su aprobación final.",
    icono: "hourglass_top",
    fuentes: ["PostgreSQL"],
    endpoint: "cuellos-botella/",
    filename_stub: "cuellos_botella_impunidad.pdf",
  },
  {
    slug: "desplazamiento-criminal",
    titulo: "Reporte de Desplazamiento Criminal",
    descripcion:
      "Análisis macro-espacial para detectar migración delictiva entre zonas colindantes.",
    icono: "moving",
    fuentes: ["ClickHouse"],
    endpoint: "desplazamiento-criminal/",
    filename_stub: "desplazamiento_criminal.pdf",
  },
];

export default function Page() {
  const [reportes, setReportes] = useState(FALLBACK);
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await visorReportesApi.catalogo();
        if (!cancelled && data?.results?.length) setReportes(data.results);
      } catch {
        /* usa FALLBACK local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onDescargar = useCallback(async (reporte) => {
    setBusy(reporte.slug);
    setError("");
    setFlash(null);
    try {
      await descargarReporteArchivo(
        reporte.endpoint,
        reporte.filename_stub || `${reporte.slug}.pdf`
      );
      setFlash({
        tone: "info",
        text: `PDF «${reporte.titulo}» descargado con contenido ejecutivo (datos demo).`,
      });
    } catch (err) {
      setError(err.message || "No se pudo descargar el reporte");
    } finally {
      setBusy("");
    }
  }, []);

  return (
    <div className="re-page">
      <header className="re-head">
        <div>
          <h2>Reportes Estratégicos</h2>
          <p className="re-sub">
            Documentos de alto nivel para Gobierno. Cada botón descarga un PDF
            (stub ReportLab) listo para conectar ClickHouse / PostgreSQL.
          </p>
        </div>
      </header>

      {flash && (
        <p className={`re-flash ${flash.tone}`} role="status">
          <span className="material-symbols-outlined">check_circle</span>
          {flash.text}
        </p>
      )}
      {error && <p className="re-error">{error}</p>}

      <div className="re-grid">
        {reportes.map((r) => (
          <article key={r.slug} className="re-card">
            <div className="re-card-top">
              <span className="re-icon">
                <span className="material-symbols-outlined">{r.icono}</span>
              </span>
              <div>
                <h3>{r.titulo}</h3>
                <p>{r.descripcion}</p>
              </div>
            </div>
            <div className="re-tags">
              {(r.fuentes || []).map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <button
              type="button"
              className="re-btn"
              disabled={!!busy}
              onClick={() => onDescargar(r)}
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              {busy === r.slug ? "Generando PDF…" : "Descargar PDF"}
            </button>
          </article>
        ))}
      </div>

      <p className="re-foot">
        Uso exclusivo del Alto Mando · CrimeTrack · Clasificado
      </p>
    </div>
  );
}
