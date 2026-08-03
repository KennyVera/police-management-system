# Informes simples

Un **informe simple** responde a **un hecho o un listado acotado**: un parte, un listado de personal, un extracto. Se genera desde un módulo concreto, con pocos filtros, y se lee de punta a punta sin cruzar muchas fuentes.

| Característica | Descripción |
|----------------|-------------|
| Alcance | Un objeto o una lista homogénea |
| Fuentes | Generalmente una (Postgres / MinIO PDF) |
| Uso | Evidencia operativa, archivo, supervisión puntual |
| Formato típico | PDF (o vista previa en pantalla) |

---

## 1. PDF del Parte Policial — Nivel operativo

| Campo | Detalle |
|-------|---------|
| **Nombre** | PDF del Parte Policial |
| **Nivel** | Operativo |
| **Quién lo usa** | Agente (emisión), Supervisor (revisión), Jefe de Zona (auditoría / supervisión de casos) |
| **Cómo actúa en el sistema** | Se genera desde el parte registrado (datos + evidencias). Se abre en navegador o se descarga. En supervisión del jefe se consulta por ID desde la bandeja de auditoría. |
| **Para qué sirve** | Dejar constancia formal del hecho, facilitar revisión de calidad y respaldo institucional sin alterar el registro original. |
| **Contenido típico** | Identificación del parte, hechos, tipología, ubicación, agentes, evidencias adjuntas. |

---

## 2. Reporte de Novedades del Personal Regional — Jefe de Zona (táctico)

| Campo | Detalle |
|-------|---------|
| **Nombre** | Novedades del personal (módulo Personal regional) |
| **Nivel** | Táctico |
| **Quién lo usa** | Jefe de Zona / Director |
| **Cómo actúa en el sistema** | Lista el personal de la jurisdicción (estado, rol, unidad). Permite buscar/paginar, evaluar supervisores y **exportar Informe PDF** de disponibilidad del día. |
| **Para qué sirve** | Saber quién está activo, franco, con novedad o bajo evaluación; apoyar decisiones de mando sobre personal (no sobre tipología criminal). |
| **Contenido típico** | Nombre, rol, unidad/distrito, estado, detalle; resumen Activos / Franco / Vacaciones / Calamidad / Arresto. |

---

## 3. Reporte de Zona — Nivel táctico

| Campo | Detalle |
|-------|---------|
| **Nombre** | Reporte de Zona (módulo *Reportes y rendición*) |
| **Nivel** | Táctico |
| **Quién lo usa** | Jefe de Zona / Director |
| **Cómo actúa en el sistema** | Filtra por periodo y audiencia (Alto Mando o autoridades civiles). Muestra vista previa (totales, tipología, distritos) desde ClickHouse **solo lectura** de su jurisdicción. Exporta **PDF** o **Excel**. |
| **Para qué sirve** | Entregar un extracto táctico de la zona: volumen delictivo del periodo, tipos de delito y carga por distrito, para rendición o coordinación sin armar un análisis compuesto. |
| **Contenido típico** | Jurisdicción, fechas, total de partes, mes actual vs anterior, tabla por tipo de delito, tabla por distrito (partes / críticos). |

---

## Diferencia rápida: simple vs compuesto

| | Informe simple | Informe compuesto |
|--|----------------|-------------------|
| Pregunta | “¿Qué dice este parte / este listado / este extracto de zona?” | “¿Qué patrón hay en la zona?” |
| Fuentes | 1 principal | Varias (KPIs + gráficos + tablas + análisis) |
| Ejemplo | PDF de un parte · Novedades personal · Reporte de Zona | Mapa de calor + radar + análisis PDF |
