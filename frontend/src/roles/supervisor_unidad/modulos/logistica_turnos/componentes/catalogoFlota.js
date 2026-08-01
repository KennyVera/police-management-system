import imgAutomovil from "../assets/vehiculos/automovil.png";
import imgBlindado from "../assets/vehiculos/blindado.png";
import imgCamioneta from "../assets/vehiculos/camioneta.png";
import imgFurgon from "../assets/vehiculos/furgon.png";
import imgHelicoptero from "../assets/vehiculos/helicoptero.png";
import imgMoto from "../assets/vehiculos/moto.png";

/** Tipos del catálogo visual = opciones reales del select Tipo */
export const CATALOGO_FLOTA = [
  {
    id: "automovil",
    nombre: "Automóvil",
    tipo: "AUTOMOVIL",
    descripcion: "Patrullero sedán",
    src: imgAutomovil,
  },
  {
    id: "camioneta",
    nombre: "Camioneta",
    tipo: "CAMIONETA",
    descripcion: "Patrullero pickup",
    src: imgCamioneta,
  },
  {
    id: "moto",
    nombre: "Motocicleta",
    tipo: "MOTO",
    descripcion: "Moto de patrulla",
    src: imgMoto,
  },
  {
    id: "blindado",
    nombre: "Blindado",
    tipo: "BLINDADO",
    descripcion: "Unidad táctica blindada",
    src: imgBlindado,
  },
  {
    id: "furgon",
    nombre: "Furgón",
    tipo: "FURGON",
    descripcion: "Furgón operativo",
    src: imgFurgon,
  },
  {
    id: "helicoptero",
    nombre: "Helicóptero",
    tipo: "HELICOPTERO",
    descripcion: "Apoyo aéreo",
    src: imgHelicoptero,
  },
];

export const TIPOS_CATALOGO = CATALOGO_FLOTA.map((c) => ({
  value: c.tipo,
  label: c.nombre,
}));
