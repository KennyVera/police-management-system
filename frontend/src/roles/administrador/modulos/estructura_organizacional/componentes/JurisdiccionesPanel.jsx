import JurisdiccionesMapa from "./JurisdiccionesMapa";
import "./JurisdiccionesPanel.css";

export default function JurisdiccionesPanel({ items, refreshing = false, onChanged }) {
  return (
    <div className="grid gap-4">
      <p className="mod-muted m-0">
        Haga clic en una provincia para ver el mando y abrir{" "}
        <strong>Administrar Personal</strong>. La geografía maestra se carga con{" "}
        <code>python manage.py load_ecuador_map</code>.
      </p>
      <JurisdiccionesMapa items={items} refreshing={refreshing} />
    </div>
  );
}
