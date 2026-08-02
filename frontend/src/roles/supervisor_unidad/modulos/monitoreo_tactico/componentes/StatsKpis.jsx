import MaterialIcon from "../../../../../shared/components/MaterialIcon";

export default function StatsKpis({ stats }) {
  const aux = stats?.auxilios || {};
  const tiempos = stats?.tiempos || {};

  const cards = [
    {
      label: "Auxilios hoy",
      value: String(aux.asignados_hoy ?? 0),
      hint: `${aux.atendidos ?? 0} atendidos · ${aux.en_curso ?? 0} en curso`,
      icon: "sos",
      tone: "purple",
    },
    {
      label: "Tiempo respuesta",
      value:
        tiempos.promedio_minutos != null ? `${tiempos.promedio_minutos} min` : "—",
      hint:
        tiempos.muestras > 0
          ? `Promedio de ${tiempos.muestras} llegadas`
          : "Sin muestras aún",
      icon: "timer",
      tone: "blue",
    },
    {
      label: "Novedades",
      value: String(stats?.novedades_hoy ?? 0),
      hint: "Generadas hoy por la unidad",
      icon: "report",
      tone: "green",
    },
    {
      label: "Unidades en turno",
      value: String(stats?.unidades_en_turno ?? 0),
      hint: `${stats?.partes_hoy ?? 0} partes · ${stats?.ordenes_hoy ?? 0} órdenes`,
      icon: "local_police",
      tone: "violet",
    },
  ];

  return (
    <div className="monitoreo-kpi-grid">
      {cards.map((k) => (
        <article key={k.label} className={`monitoreo-kpi tone-${k.tone}`}>
          <div className="monitoreo-kpi-icon">
            <MaterialIcon name={k.icon} />
          </div>
          <div>
            <p className="monitoreo-kpi-label">{k.label}</p>
            <p className="monitoreo-kpi-value">{k.value}</p>
            <p className="monitoreo-kpi-hint">{k.hint}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
