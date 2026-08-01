import { useEffect, useState } from "react";
import MaterialIcon from "../../../../shared/components/MaterialIcon";
import { agenteApi } from "../../api";
import MultimediaLista from "./componentes/MultimediaLista";
import MultimediaUploader from "./componentes/MultimediaUploader";
import "../../../../shared/styles/ModuloPage.css";

export default function MultimediaPage() {
  const [items, setItems] = useState([]);
  const [partes, setPartes] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [list, p, n] = await Promise.all([
        agenteApi.listMultimedia(),
        agenteApi.listPartes(),
        agenteApi.listNovedades(),
      ]);
      setItems(list);
      setPartes(p);
      setNovedades(n);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mod-page">
      <header className="mod-header">
        <div>
          <p className="mod-kicker">Registro Operativo</p>
          <h2>Captura Rápida de Multimedia</h2>
          <p className="mod-desc">
            Adjunta imágenes u evidencias del lugar, sospechoso o indicios. Se almacenan
            en MinIO (servidor institucional), no en la galería del teléfono.
          </p>
        </div>
        <button type="button" className="btn-accent" onClick={() => setShowUpload(true)}>
          <MaterialIcon name="upload" />
          Subir evidencia
        </button>
      </header>

      {error && <p className="mod-error">{error}</p>}
      {loading ? (
        <p className="mod-muted">Cargando...</p>
      ) : (
        <MultimediaLista items={items} />
      )}

      {showUpload && (
        <MultimediaUploader
          partes={partes}
          novedades={novedades}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            setShowUpload(false);
            load();
          }}
        />
      )}
    </div>
  );
}
