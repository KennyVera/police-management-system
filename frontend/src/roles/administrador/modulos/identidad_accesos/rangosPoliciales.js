/** Catálogo local: el rol define permisos; el rango es etiquetado estético. */
export const ROLES_ASIGNABLES = [
  { code: "VISOR_EJECUTIVO", label: "Visor Ejecutivo (Alto Mando)" },
  { code: "DIRECTOR_ZONA", label: "Director / Jefe de Zona" },
  { code: "SUPERVISOR_UNIDAD", label: "Supervisor de Unidad" },
  { code: "DETECTIVE", label: "Detective / Investigador" },
  { code: "AGENTE_OPERATIVO", label: "Agente Operativo" },
  { code: "FISCAL", label: "Fiscal de Turno" },
  { code: "ADMIN_SISTEMA", label: "Administrador de Institución" },
];

export const RANGOS_POR_ROL = {
  VISOR_EJECUTIVO: [
    "Comandante General",
    "General Superior",
    "General Inspector",
    "General de Distrito",
    "Subcomandante General",
  ],
  DIRECTOR_ZONA: [
    "Coronel de Policía",
    "Teniente Coronel de Policía",
    "Mayor de Policía",
    "Comandante de Subzona",
    "Jefe de Operaciones",
  ],
  SUPERVISOR_UNIDAD: [
    "Capitán de Policía",
    "Teniente de Policía",
    "Subteniente de Policía",
    "Suboficial Mayor",
    "Suboficial Primero",
  ],
  DETECTIVE: [
    "Agente de Policía Judicial (PJ)",
    "Investigador DINASED",
    "Agente Antinarcóticos",
    "Perito de Criminalística",
    "Analista de Inteligencia (DGI)",
  ],
  AGENTE_OPERATIVO: [
    "Sargento Primero",
    "Sargento Segundo",
    "Cabo Primero",
    "Cabo Segundo",
    "Policía Nacional",
  ],
  FISCAL: ["Agente Fiscal", "Fiscal de Flagrancia"],
  ADMIN_SISTEMA: ["Auditor de Sistemas"],
};

export function rangosDeRol(role) {
  return RANGOS_POR_ROL[role] || [];
}

export function normalizeRoles(data) {
  if (Array.isArray(data) && data.length) {
    return data
      .map((r) =>
        typeof r === "string"
          ? { code: r, label: r }
          : { code: r.code || r.value, label: r.label || r.code }
      )
      .filter((r) => r.code);
  }
  return ROLES_ASIGNABLES;
}
