# Matriz: objetivos estratégicos e informes compuestos

Nivel **Estratégico**. Solo informes **compuestos** del modelo de negocio:  
**(1)** Alto Mando / Visor Ejecutivo · **(2)** SuperAdmin SaaS / Plataforma CrimeTrack.

| Departamento | Objetivos Estratégicos | Nombre del Informe | Módulo | Tipo de Informe | Origen de Datos |
|--------------|------------------------|--------------------|--------|-----------------|-----------------|
| Alto Mando / Visor Ejecutivo | Contar con una foto institucional del volumen delictivo y su variación entre periodos | Cuadro de mando institucional (multi-zona) | Dashboard Ejecutivo | Compuesto | ClickHouse (agregado institucional) + Postgres (contexto de fuerza) |
| Alto Mando / Visor Ejecutivo | Priorizar tipologías críticas a escala institución | Índice delictivo institucional por tipología | Dashboard Ejecutivo / Indicadores | Compuesto | ClickHouse (`fact_partes_policiales` agregado) |
| Alto Mando / Visor Ejecutivo | Medir si la presión policial se traduce en resultados | Efectividad operativa institucional (detenidos / flagrancias vs periodo) | Indicadores | Compuesto | ClickHouse + Postgres |
| Alto Mando / Visor Ejecutivo | Identificar zonas en crisis para reforzar mando | Semáforo de zonas en alerta | Dashboard Ejecutivo | Compuesto | ClickHouse (umbrales por zona/distrito) |
| Alto Mando / Visor Ejecutivo | Comparar desempeño entre jefaturas de zona | Ranking de zonas (productividad / efectividad) | Indicadores / Reportes estratégicos | Compuesto | ClickHouse (delitos × resultados por zona) |
| Alto Mando / Visor Ejecutivo | Orientar despliegue territorial a escala macro | Mapa macro de calor interzonal | Reportes estratégicos / Inteligencia | Compuesto | ClickHouse (focos georreferenciados agregados) |
| Alto Mando / Visor Ejecutivo | Detectar patrones temporales de largo plazo | Tendencia institucional (trimestre / semestre) | Indicadores | Compuesto | ClickHouse (series temporales 90–180 días) |
| Alto Mando / Visor Ejecutivo | Preparar la reunión de mando con evidencia formal | Informe consolidado de rendición al mando | Reportes estratégicos | Compuesto | ClickHouse + insumos PDF de zonas (Postgres/MinIO) |
| Alto Mando / Visor Ejecutivo | Comunicar seguridad a autoridades civiles sin detalle táctico sensible | Paquete agregado para autoridades civiles | Reportes estratégicos | Compuesto | ClickHouse (agregado tipología/territorio) |
| Alto Mando / Visor Ejecutivo | Consumir la rendición de cada jefe de zona con audiencia de mando | Estadística comparativa de zona (audiencia Alto Mando) | Reportes de zona → consumo Visor | Compuesto | ClickHouse filtrado por jurisdicción del jefe |
| Alto Mando / Visor Ejecutivo | Anexar evidencia territorial (dónde / quién / cuánto) a la lectura de mando | Paquete de snapshots tácticos (Mapa · Ranking · Delitos Locales) | Dashboard Jefe de Zona → anexo Visor | Compuesto | ClickHouse + análisis PDF por pestaña |
| Alto Mando / Visor Ejecutivo | Seguir indicadores institucionales en pantalla de mando | Tablero de indicadores institucionales | Indicadores | Compuesto | ClickHouse + Postgres |
| Alto Mando / Visor Ejecutivo | Exportar el documento oficial periódico del Alto Mando | Reporte estratégico institucional (PDF / Excel) | Reportes estratégicos | Compuesto | ClickHouse + Postgres |
| Alto Mando / Visor Ejecutivo | Contrastar capacidad institucional vs demanda delictiva | Fuerza efectiva vs carga delictiva (institucional) | Dashboard Ejecutivo | Compuesto | Postgres (personal) + ClickHouse (hechos) |
| Alto Mando / Visor Ejecutivo | Evaluar evolución interanual de seguridad ciudadana | Comparativo institucional año actual vs año anterior | Indicadores / Reportes estratégicos | Compuesto | ClickHouse (agregaciones anuales) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Monitorear la salud del negocio recurrente y la pérdida de clientes | Informe de Salud Financiera, MRR y Tasa de Abandono (Churn Rate) | Dashboard SuperAdmin / Facturación | Compuesto | Postgres (`saas_core`: Institucion, PlanSuscripcion, estado_pago) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Detectar tenants cerca del tope de su licencia o con sobreuso | Informe de Utilización de Recursos vs. Límites de Plan | Dashboard SuperAdmin / Tenants | Compuesto | Postgres (usuarios por institución, cuotas del plan) + MinIO (almacenamiento) + ClickHouse (volumen analítico) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Ordenar inquilinos por valor comercial y actividad real en el sistema | Ranking de Rentabilidad y Actividad Operativa por Inquilino (Tenant) | Dashboard SuperAdmin / Tenants | Compuesto | Postgres (`saas_core` + perfiles) + ClickHouse (partes/expedientes por institución) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Anticipar ingresos y priorizar retención de cuentas valiosas | Proyección de Ingresos y Valor del Ciclo de Vida del Cliente (LTV) | Facturación / Reportes plataforma | Compuesto | Postgres (planes, precios, antigüedad, churn) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Controlar el gasto de infraestructura frente al margen del SaaS | Análisis de Eficiencia y Costos de Infraestructura en la Nube (MinIO / ClickHouse) | Plataforma / Observabilidad | Compuesto | Métricas MinIO + ClickHouse + costos cloud (telemetría / billing) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Ver patrones delictivos agregados entre instituciones clientes (anonimizado) | Mapa Global de Macro-Tendencias Delictivas Inter-Institucional | Inteligencia plataforma | Compuesto | ClickHouse multi-tenant (agregado anonimizado por tipología/territorio) |
| SuperAdmin SaaS / Plataforma CrimeTrack | Saber qué módulos adoptan más los clientes para roadmap y upsell | Análisis de Adopción de Funcionalidades (qué módulos usan más los clientes) | Producto / Analytics plataforma | Compuesto | Postgres (auditoría / sesiones) + logs de uso por módulo y tenant |
| SuperAdmin SaaS / Plataforma CrimeTrack | Verificar que la plataforma cumple disponibilidad y tiempos de respuesta contratados | Auditoría de Cumplimiento de Acuerdos de Nivel de Servicio (SLA) | Plataforma / Soporte | Compuesto | Métricas de uptime, latencia API, incidentes de soporte + contratos SLA |

---

## Leyenda

| Columna | Significado |
|---------|-------------|
| **Departamento** | Área del modelo de negocio que usa el informe |
| **Objetivos Estratégicos** | Decisión o necesidad que cubre el informe |
| **Nombre del Informe** | Nombre del informe compuesto |
| **Módulo** | Dónde se genera o consume en CrimeTrack |
| **Tipo de Informe** | Siempre **Compuesto** |
| **Origen de Datos** | Fuente(s) técnicas principales |
