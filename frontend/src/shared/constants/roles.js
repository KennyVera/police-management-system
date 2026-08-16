export const ROLES = {
  administrador: {
    slug: "administrador",
    code: "ADMIN_SISTEMA",
    title: "Administrador de Institución",
    subtitle: "Ingenieros de Software / Personal Técnico",
    icon: "shield",
    accent: "#7c5cbf",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "dashboard", path: "dashboard" },
      {
        slug: "identidad_accesos",
        label: "Identidad y Accesos",
        icon: "group",
        children: [
          {
            slug: "usuarios",
            label: "Usuarios",
            icon: "person",
            path: "identidad_accesos/usuarios",
          },
          {
            slug: "credenciales",
            label: "Credenciales",
            icon: "key",
            path: "identidad_accesos/credenciales",
          },
          {
            slug: "sesiones",
            label: "Sesiones",
            icon: "sensors",
            path: "identidad_accesos/sesiones",
          },
        ],
      },
      {
        slug: "estructura_organizacional",
        label: "Estructura Org.",
        icon: "account_tree",
        children: [
          {
            slug: "jurisdicciones",
            label: "Jurisdicciones",
            icon: "map",
            path: "estructura_organizacional/jurisdicciones",
          },
          {
            slug: "plazas",
            label: "Asignación a zonas",
            icon: "badge",
            path: "estructura_organizacional/plazas",
          },
        ],
      },
      {
        slug: "parametros_catalogos",
        label: "Parámetros y Catálogos",
        icon: "menu_book",
        children: [
          {
            slug: "tipos_delito",
            label: "Tipos de Delitos",
            icon: "gavel",
            path: "parametros_catalogos/tipos_delito",
          },
          {
            slug: "catalogos_operativos",
            label: "Catálogos Operativos",
            icon: "list_alt",
            path: "parametros_catalogos/catalogos_operativos",
          },
          {
            slug: "variables_globales",
            label: "Variables Globales",
            icon: "tune",
            path: "parametros_catalogos/variables_globales",
          },
        ],
      },
    ],
  },
  superadmin: {
    slug: "superadmin",
    code: "SUPERADMIN_SAAS",
    title: "SuperAdmin SaaS",
    subtitle: "Dueño de la plataforma CrimeTrack",
    icon: "admin_panel_settings",
    accent: "#6d4aff",
    modules: [
      { slug: "dashboard", label: "Overview Tenants", icon: "dashboard", path: "dashboard" },
      {
        slug: "planes_suscripciones",
        label: "Planes y suscripciones",
        icon: "sell",
        children: [
          {
            slug: "planes",
            label: "Planes",
            icon: "workspace_premium",
            path: "planes_suscripciones/planes",
          },
          {
            slug: "suscripciones",
            label: "Suscripciones",
            icon: "receipt_long",
            path: "planes_suscripciones/suscripciones",
          },
        ],
      },
      {
        slug: "usuarios_plataforma",
        label: "Usuarios de plataforma",
        icon: "manage_accounts",
        children: [
          {
            slug: "administradores",
            label: "Admins institucionales",
            icon: "badge",
            path: "usuarios_plataforma/administradores",
          },
          {
            slug: "gestion_acceso",
            label: "Gestión de acceso",
            icon: "security",
            path: "usuarios_plataforma/gestion_acceso",
          },
        ],
      },
      {
        slug: "facturacion",
        label: "Facturación",
        icon: "payments",
        children: [
          {
            slug: "suscripciones_fact",
            label: "Suscripciones",
            icon: "subscriptions",
            path: "facturacion/suscripciones",
          },
          {
            slug: "pagos",
            label: "Pagos",
            icon: "credit_card",
            path: "facturacion/pagos",
          },
          {
            slug: "facturas",
            label: "Facturas",
            icon: "description",
            path: "facturacion/facturas",
          },
          {
            slug: "vencimientos",
            label: "Vencimientos",
            icon: "event_busy",
            path: "facturacion/vencimientos",
          },
          {
            slug: "reportes_financieros",
            label: "Reportes financieros",
            icon: "monitoring",
            path: "facturacion/reportes",
          },
          {
            slug: "auditoria_financiera",
            label: "Auditoría financiera",
            icon: "policy",
            path: "facturacion/auditoria",
          },
        ],
      },
      {
        slug: "configuracion_global",
        label: "Configuración global",
        icon: "tune",
        children: [
          {
            slug: "identidad",
            label: "Identidad de la plataforma",
            icon: "badge",
            path: "configuracion_global/identidad",
          },
          {
            slug: "apariencia",
            label: "Apariencia",
            icon: "palette",
            path: "configuracion_global/apariencia",
          },
          {
            slug: "regional",
            label: "Configuración regional",
            icon: "public",
            path: "configuracion_global/regional",
          },
          {
            slug: "comunicaciones",
            label: "Comunicaciones",
            icon: "mail",
            path: "configuracion_global/comunicaciones",
          },
          {
            slug: "plataforma",
            label: "Plataforma",
            icon: "dns",
            path: "configuracion_global/plataforma",
          },
          {
            slug: "auditoria_config",
            label: "Auditoría de configuración",
            icon: "history",
            path: "configuracion_global/auditoria",
          },
        ],
      },
    ],
  },
  visor_ejecutivo: {
    slug: "visor_ejecutivo",
    code: "VISOR_EJECUTIVO",
    title: "Visor Ejecutivo",
    subtitle: "Comandante General / Generales",
    icon: "monitoring",
    accent: "#3d2a6d",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "space_dashboard", path: "dashboard" },
      { slug: "indicadores", label: "Ficha Técnica de Jurisdicción", icon: "map", path: "indicadores" },
      {
        slug: "reportes_estrategicos",
        label: "Reportes",
        icon: "summarize",
        path: "reportes_estrategicos",
      },
    ],
  },
  director_zona: {
    slug: "director_zona",
    code: "DIRECTOR_ZONA",
    title: "Director / Jefe de Zona",
    subtitle: "Coroneles / Mayores",
    icon: "map",
    accent: "#2f4d8a",
    modules: [
      {
        slug: "inteligencia_tactica",
        label: "Inteligencia Táctica",
        icon: "analytics",
        path: "inteligencia",
      },
      {
        slug: "supervision_casos",
        label: "Supervisión de Casos",
        icon: "folder_shared",
        path: "supervision",
      },
      {
        slug: "personal_regional",
        label: "Personal Regional",
        icon: "groups",
        path: "personal",
      },
      {
        slug: "reportes_zona",
        label: "Reportes de Zona",
        icon: "summarize",
        path: "reportes",
      },
      {
        slug: "comunicacion_vertical",
        label: "Comunicación Vertical",
        icon: "campaign",
        path: "comunicacion",
      },
    ],
  },
  supervisor_unidad: {
    slug: "supervisor_unidad",
    code: "SUPERVISOR_UNIDAD",
    title: "Supervisor de Unidad",
    subtitle: "Capitanes / Tenientes",
    icon: "supervisor_account",
    accent: "#7c5cbf",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "dashboard", path: "dashboard" },
      {
        slug: "logistica_turnos",
        label: "Gestión de Turnos",
        icon: "schedule",
        children: [
          {
            slug: "escuadras",
            label: "Escuadras",
            icon: "groups",
            path: "logistica_turnos/escuadras",
          },
          {
            slug: "vehiculos",
            label: "Flota de vehículos",
            icon: "local_shipping",
            path: "logistica_turnos/vehiculos",
          },
          {
            slug: "sectores",
            label: "Sectores / Rutas",
            icon: "map",
            path: "logistica_turnos/sectores",
          },
          {
            slug: "horarios",
            label: "Horarios y Novedades",
            icon: "event_available",
            path: "logistica_turnos/horarios",
          },
        ],
      },
      {
        slug: "despacho_operativo",
        label: "Despacho y Tareas",
        icon: "emergency",
        children: [
          {
            slug: "auxilios",
            label: "Asignación de Auxilios",
            icon: "sos",
            path: "despacho_operativo/auxilios",
          },
          {
            slug: "ordenes",
            label: "Órdenes Adicionales",
            icon: "assignment",
            path: "despacho_operativo/ordenes",
          },
        ],
      },
      {
        slug: "monitoreo_tactico",
        label: "Monitoreo Táctico",
        icon: "radar",
        children: [
          {
            slug: "rastreo_gps",
            label: "Rastreo GPS",
            icon: "my_location",
            path: "monitoreo_tactico/rastreo_gps",
          },
          {
            slug: "estadisticas",
            label: "Estadísticas de Unidad",
            icon: "analytics",
            path: "monitoreo_tactico/estadisticas",
          },
        ],
      },
      {
        slug: "control_calidad",
        label: "Control de Calidad",
        icon: "fact_check",
        children: [
          {
            slug: "pendientes",
            label: "Partes Pendientes",
            icon: "inbox",
            path: "control_calidad/pendientes",
          },
          {
            slug: "historial",
            label: "Historial",
            icon: "history",
            path: "control_calidad/historial",
          },
        ],
      },
    ],
  },
  detective: {
    slug: "detective",
    code: "DETECTIVE",
    title: "Detective / Investigador",
    subtitle: "Policía Judicial / Antinarcóticos",
    icon: "search",
    accent: "#5a3d1e",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "dashboard", path: "dashboard" },
      {
        slug: "expedientes",
        label: "Gestión de Expedientes",
        icon: "folder_open",
        children: [
          {
            slug: "casos",
            label: "Bandeja de Casos",
            icon: "folder_shared",
            path: "casos",
          },
        ],
      },
      {
        slug: "actividades",
        label: "Documentación Legal",
        icon: "gavel",
        children: [
          {
            slug: "actividades_doc",
            label: "Bitácora y Solicitudes",
            icon: "menu_book",
            path: "actividades",
          },
        ],
      },
    ],
  },
  fiscal: {
    slug: "fiscal",
    code: "FISCAL",
    title: "Fiscal de Turno",
    subtitle: "Ministerio Público / Fiscalía",
    icon: "balance",
    accent: "#1e3a5f",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "dashboard", path: "dashboard" },
      {
        slug: "fiscalia",
        label: "Fiscalía de Turno",
        icon: "gavel",
        children: [
          {
            slug: "bandeja",
            label: "Bandeja de partes",
            icon: "inbox",
            path: "bandeja",
          },
          {
            slug: "historial",
            label: "Historial de decisiones",
            icon: "history",
            path: "historial",
          },
        ],
      },
    ],
  },
  agente_operativo: {
    slug: "agente_operativo",
    code: "AGENTE_OPERATIVO",
    title: "Agente Operativo",
    subtitle: "Sargentos / Cabos / Policías (Servicio Urbano)",
    icon: "local_police",
    accent: "#7c5cbf",
    modules: [
      { slug: "dashboard", label: "Dashboard", icon: "dashboard", path: "dashboard" },
      {
        slug: "registro_operativo",
        label: "Registro Operativo",
        icon: "description",
        children: [
          {
            slug: "partes_aprehension",
            label: "Partes de Aprehensión",
            icon: "person_off",
            path: "registro_operativo/partes_aprehension",
          },
          {
            slug: "novedades",
            label: "Novedades e Incidentes",
            icon: "report",
            path: "registro_operativo/novedades",
          },
          {
            slug: "multimedia",
            label: "Captura Multimedia",
            icon: "photo_camera",
            path: "registro_operativo/multimedia",
          },
        ],
      },
      {
        slug: "despacho_tareas",
        label: "Despacho y Tareas",
        icon: "emergency",
        children: [
          {
            slug: "alertas",
            label: "Alertas ECU-911",
            icon: "notifications_active",
            path: "despacho_tareas/alertas",
          },
          {
            slug: "mi_turno",
            label: "Asignación Diaria",
            icon: "badge",
            path: "despacho_tareas/mi_turno",
          },
        ],
      },
    ],
  },
};

export function getRoleConfig(slug) {
  return ROLES[slug] || null;
}
