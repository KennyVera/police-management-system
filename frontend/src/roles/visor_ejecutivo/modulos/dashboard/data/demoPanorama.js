/** Densidad de criminalidad (demo) por provincia — escala 0–100 */
export const DENSIDAD_CRIMEN_BY_PROV = {
  AZUAY: 38,
  BOLIVAR: 22,
  CAÑAR: 28,
  CARCHI: 18,
  COTOPAXI: 42,
  CHIMBORAZO: 35,
  "EL ORO": 48,
  ESMERALDAS: 72,
  GUAYAS: 95,
  IMBABURA: 32,
  LOJA: 26,
  "LOS RIOS": 58,
  MANABI: 68,
  "MORONA SANTIAGO": 20,
  NAPO: 15,
  PASTAZA: 12,
  TUNGURAHUA: 40,
  PICHINCHA: 82,
  "ZAMORA CHINCHIPE": 18,
  GALAPAGOS: 8,
  SUCUMBIOS: 45,
  ORELLANA: 30,
  "SANTO DOMINGO": 55,
  "SANTA ELENA": 50,
  "ZONAS NO DELIMITADAS": 25,
};

export const KPIS = [
  {
    id: "criminalidad",
    icon: "gavel",
    title: "Índice de Criminalidad Global",
    value: "125,430",
    unit: "Delitos registrados",
    badge: { text: "-8% vs. 2025", tone: "good", dir: "down" },
    spark: [18, 16, 17, 15, 14, 13, 12, 11],
    sparkColor: "#7c5cbf",
  },
  {
    id: "resolucion",
    icon: "verified",
    title: "Tasa de Resolución (Efectividad Judicial)",
    value: "45%",
    unit: "Casos resueltos",
    badge: { text: "+5% vs. trim. ant.", tone: "good", dir: "up" },
    spark: [32, 34, 36, 38, 40, 42, 43, 45],
    sparkColor: "#22c55e",
  },
  {
    id: "cierre",
    icon: "schedule",
    title: "Tiempo Medio de Cierre de Casos",
    value: "28",
    unit: "Días promedio",
    badge: { text: "+3 días vs. trim. ant.", tone: "warn", dir: "up" },
    spark: [22, 23, 24, 25, 26, 27, 28, 28],
    sparkColor: "#f59e0b",
  },
  {
    id: "fuerza",
    icon: "groups",
    title: "Costo / Despliegue de Fuerza",
    value: "8,500",
    unit: "Efectivos activos",
    badge: { text: "92% ocupación del talento humano", tone: "info", dir: null },
    spark: [7.2, 7.5, 7.8, 8.0, 8.1, 8.3, 8.4, 8.5],
    sparkColor: "#3b82f6",
  },
];

export const RANKING_ZONAS = {
  labels: [
    "Zona 8 - Guayaquil",
    "Zona 9 - Quito",
    "Zona 4 - Manabí",
    "Zona 5 - Guayas Int.",
    "Zona 1 - Esmeraldas",
    "Zona 7 - El Oro",
    "Zona 3 - Sto. Domingo",
    "Zona 6 - Azuay",
  ],
  values: [1245, 1102, 980, 875, 820, 710, 640, 520],
  deltas: [12, 5, -3, 8, 15, -2, 4, -6],
};

export const MATRIZ_DELITOS = {
  labels: [
    "Narcotráfico",
    "Sicariato/Homicidios",
    "Extorsión",
    "Secuestro",
    "Tráfico de Armas",
    "Otros Delitos Graves",
  ],
  values: [35, 28, 18, 10, 5, 4],
  colors: ["#7c5cbf", "#ef4444", "#f59e0b", "#eab308", "#38bdf8", "#94a3b8"],
  total: 125430,
};

export const EVOLUCION = {
  labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
  y2025: [11200, 10800, 12100, 11800, 12500, 13200, 12800, 13500, 14100, 13800, 14500, 14890],
  y2026: [9800, 9400, 10200, 9900, 10800, 11500, 11200, 11800, 12400, 12100, 12800, 13200],
};

export const FILTER_DEFAULTS = {
  rango: "ytd",
  anio: "2026",
  comparar: "2025",
  nivel: "nacional",
};
