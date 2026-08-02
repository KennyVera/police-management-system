import imgAutomovil from "../assets/vehiculos/automovil.png";
import imgBlindado from "../assets/vehiculos/blindado.png";
import imgCamioneta from "../assets/vehiculos/camioneta.png";
import imgFurgon from "../assets/vehiculos/furgon.png";
import imgHelicoptero from "../assets/vehiculos/helicoptero.png";
import imgMoto from "../assets/vehiculos/moto.png";

const STORAGE_KEY = "sgp_catalogo_tipos_unidad";

/** Imágenes semilla por id (no se serializan en localStorage). */
export const SEED_IMAGES = {
  automovil: imgAutomovil,
  camioneta: imgCamioneta,
  moto: imgMoto,
  blindado: imgBlindado,
  furgon: imgFurgon,
  helicoptero: imgHelicoptero,
};

/** Tipos del catálogo visual = opciones reales del select Tipo */
export const CATALOGO_SEED = [
  {
    id: "automovil",
    nombre: "Automóvil",
    tipo: "AUTOMOVIL",
    alias: "Patrullero sedán",
    imageKey: "automovil",
  },
  {
    id: "camioneta",
    nombre: "Camioneta",
    tipo: "CAMIONETA",
    alias: "Patrullero pickup",
    imageKey: "camioneta",
  },
  {
    id: "moto",
    nombre: "Motocicleta",
    tipo: "MOTO",
    alias: "Moto de patrulla",
    imageKey: "moto",
  },
  {
    id: "blindado",
    nombre: "Blindado",
    tipo: "BLINDADO",
    alias: "Unidad táctica blindada",
    imageKey: "blindado",
  },
  {
    id: "furgon",
    nombre: "Furgón",
    tipo: "FURGON",
    alias: "Furgón operativo",
    imageKey: "furgon",
  },
  {
    id: "helicoptero",
    nombre: "Helicóptero",
    tipo: "HELICOPTERO",
    alias: "Apoyo aéreo",
    imageKey: "helicoptero",
  },
];

/** @deprecated usar CATALOGO_SEED + loadCatalogo */
export const CATALOGO_FLOTA = CATALOGO_SEED.map((c) => ({
  ...c,
  descripcion: c.alias,
  src: SEED_IMAGES[c.imageKey],
}));

export function resolveItemSrc(item) {
  if (item?.srcData) return item.srcData;
  if (item?.imageKey && SEED_IMAGES[item.imageKey]) return SEED_IMAGES[item.imageKey];
  return item?.src || "";
}

export function hydrateCatalogItem(raw) {
  return {
    id: raw.id,
    nombre: raw.nombre || "",
    alias: raw.alias || raw.descripcion || "",
    tipo: raw.tipo || "OTRO",
    imageKey: raw.imageKey || null,
    srcData: raw.srcData || null,
    src: resolveItemSrc(raw),
    descripcion: raw.alias || raw.descripcion || "",
  };
}

export function loadCatalogo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return CATALOGO_SEED.map(hydrateCatalogItem);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return CATALOGO_SEED.map(hydrateCatalogItem);
    }
    return parsed.map(hydrateCatalogItem);
  } catch {
    return CATALOGO_SEED.map(hydrateCatalogItem);
  }
}

export function saveCatalogo(items) {
  const serializable = items.map((item) => ({
    id: item.id,
    nombre: item.nombre,
    alias: item.alias || item.descripcion || "",
    tipo: item.tipo || "OTRO",
    imageKey: item.srcData ? null : item.imageKey || null,
    srcData: item.srcData || null,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export function tiposFromCatalogo(items) {
  const seen = new Set();
  return items
    .map((c) => ({ value: c.tipo, label: c.nombre }))
    .filter((t) => {
      if (!t.value || seen.has(t.value)) return false;
      seen.add(t.value);
      return true;
    });
}

export const TIPOS_CATALOGO = tiposFromCatalogo(CATALOGO_SEED);

const TIPOS_CONOCIDOS = new Set(CATALOGO_SEED.map((c) => c.tipo));

export function tipoParaRegistro(item) {
  if (item?.tipo && TIPOS_CONOCIDOS.has(item.tipo)) return item.tipo;
  return "OTRO";
}

export function newCatalogId() {
  return `tipo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
