import MaterialIcon from "./MaterialIcon";

export default function ModulePlaceholder({ title, icon, description }) {
  return (
    <article className="module-card">
      <h2>
        <MaterialIcon name={icon} />
        {title}
      </h2>
      <p>{description}</p>
      <span className="module-badge">Módulo listo — funcionalidad pendiente</span>
    </article>
  );
}
