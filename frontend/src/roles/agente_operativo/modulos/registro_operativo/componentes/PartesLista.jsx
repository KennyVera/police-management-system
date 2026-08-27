import { useState } from "react";
import MaterialIcon from "../../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../../api";

function estadoClass(estado) {
  if (estado === "BORRADOR") return "SUSPENDIDO";
  if (estado === "OBSERVADO") return "SUSPENDIDO";
  if (estado === "EN_REVISION") return "ACTIVO";
  if (estado === "APROBADO") return "ACTIVO";
  return "BAJA";
}

export default function PartesLista({ items, busyId, onEdit, onEnviar }) {
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [pdfError, setPdfError] = useState("");

  async function verPdf(row) {
    // Abrir la pestaña de inmediato (gesto del usuario) para evitar el bloqueo de popups.
    const win = window.open("about:blank", "_blank");
    setPdfBusyId(row.id);
    setPdfError("");
    try {
      const blob = await agenteApi.fetchPartePdf(row.id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (win) {
        win.location.href = url;
      } else {
        // Fallback si el navegador no permitió la pestaña.
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) {
      if (win && !win.closed) win.close();
      setPdfError(err.message);
    } finally {
      setPdfBusyId(null);
    }
  }

  async function descargarPdf(row) {
    setPdfBusyId(row.id);
    setPdfError("");
    try {
      const blob = await agenteApi.fetchPartePdf(row.id, { download: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.numero_caso || `parte-${row.id}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPdfError(err.message);
    } finally {
      setPdfBusyId(null);
    }
  }

  if (!items.length) {
    return (
      <div className="panel-card">
        <p className="mod-muted">
          No hay partes registrados. Ábrelos desde una alerta al marcar “Llegada al lugar”.
        </p>
      </div>
    );
  }

  return (
    <>
      {pdfError && <p className="mod-error">{pdfError}</p>}
      <div className="panel-card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nº caso</th>
              <th>Título</th>
              <th>Delito / IUCR</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.numero_caso || `P-${row.id}`}</td>
                <td>
                  <div>{row.titulo || "—"}</div>
                  <div className="mod-muted" style={{ fontSize: "0.78rem" }}>
                    {row.lugar}
                  </div>
                  {row.motivo_rechazo && row.estado_revision === "OBSERVADO" && (
                    <div style={{ color: "#b91c1c", fontSize: "0.78rem", marginTop: 4 }}>
                      Rechazo: {row.motivo_rechazo}
                    </div>
                  )}
                </td>
                <td>
                  <div>{row.tipo_delito_nombre || "—"}</div>
                  <div className="mod-muted" style={{ fontSize: "0.78rem" }}>
                    {row.codigo_iucr ? `IUCR ${row.codigo_iucr}` : ""}
                    {row.clasificacion_fbi ? ` · ${row.clasificacion_fbi}` : ""}
                  </div>
                </td>
                <td>
                  <span className={`badge-estado ${estadoClass(row.estado_revision)}`}>
                    {row.estado_revision_label || row.estado_revision}
                  </span>
                  {row.bloqueado && (
                    <div className="mod-muted" style={{ fontSize: "0.72rem" }}>
                      Bloqueado · PDF
                    </div>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {row.puede_editar && (
                      <button type="button" onClick={() => onEdit(row)}>
                        Editar
                      </button>
                    )}
                    {row.puede_enviar && (
                      <button
                        type="button"
                        onClick={() => onEnviar(row)}
                        disabled={busyId === row.id}
                      >
                        {busyId === row.id
                          ? "Enviando..."
                          : row.estado_revision === "OBSERVADO"
                            ? "Reenviar a Supervisor"
                            : "Enviar a Supervisor"}
                      </button>
                    )}
                    {row.estado_revision === "APROBADO" && (
                      <>
                        <button
                          type="button"
                          className="btn-icon-action"
                          title="Ver PDF en nueva pestaña"
                          disabled={pdfBusyId === row.id}
                          onClick={() => verPdf(row)}
                        >
                          <MaterialIcon name="visibility" />
                          Ver PDF
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action"
                          title="Descargar PDF"
                          disabled={pdfBusyId === row.id}
                          onClick={() => descargarPdf(row)}
                        >
                          <MaterialIcon name="download" />
                          Descargar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
