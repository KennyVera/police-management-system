# KPIs de Dashboard — ¿Por qué se eligieron?

Cada rol ve solo indicadores que puede **decidir o corregir** con su autoridad. No se mezclan KPIs de otro nivel.

---

## 1. Supervisor de Unidad (nivel operativo)

| KPI | Qué mide | Por qué se eligió | Para qué sirve |
|-----|----------|-------------------|----------------|
| **Fuerza efectiva** | % personal activo / asignado hoy | El supervisor arma turnos y escuadras del día | Saber si hay gente suficiente para cubrir el turno |
| **Control de calidad** | Partes pendientes de revisión | Su función central es validar o devolver partes | Priorizar la bandeja y no acumular retrasos |
| **Operatividad de flota** | % vehículos disponibles | Sin móvil no hay patrullaje | Detectar unidades fuera de servicio |
| **Alertas críticas** | Novedades / avisos que requieren atención | Evita que un evento urgente se pierda en la operación | Entrar al detalle y actuar en el momento |

**Lógica:** el dashboard del supervisor responde a *“¿puedo operar hoy?”* (gente + flota + calidad + urgencias).

---

## 2. Jefe de Zona / Director (nivel táctico)

| KPI | Qué mide | Por qué se eligió | Para qué sirve |
|-----|----------|-------------------|----------------|
| **Índice delictivo global** | Total de incidentes en el periodo (zona) | Visión única del volumen delictivo bajo su jurisdicción | Comparar periodos y justificar refuerzos |
| **Efectividad operativa** | Detenidos / flagrancias vs periodo anterior | Cruza carga delictiva con resultado policial | Ver si la presión se traduce en capturas |
| **Delito de mayor impacto** | Tipología con más peso relativo | Enfoca recursos donde más duele | Priorizar tipología en operativos y campañas |
| **Zonas en alerta roja** | Distritos sobre umbral crítico | Señal geográfica de crisis | Desplegar supervisión o refuerzo territorial |
| **Fuerza efectiva desplegada** | Operatividad del personal de la zona (hoy) | Contexto de capacidad vs demanda | Decidir reasignación entre distritos |

**Lógica:** el dashboard del jefe responde a *“¿dónde y en qué concentrar la zona?”* (volumen + resultado + tipología + territorio + capacidad).

---

## 3. Detective (nivel táctico-investigativo)

| KPI | Qué mide | Por qué se eligió | Para qué sirve |
|-----|----------|-------------------|----------------|
| **Casos activos** | Expedientes abiertos a su cargo | Carga real de trabajo investigativo | Gestionar portafolio y prioridades |
| **Tasa de efectividad** | Casos cerrados en el periodo (+ Δ vs anterior) | Mide avance, no solo acumulación | Evaluar ritmo de cierre |
| **Tiempo promedio de resolución** | Días por caso resuelto | Detecta lentitud estructural | Acortar cuellos de botella |
| **Estancamiento** | Casos sin actividad > 15 días | Alerta temprana de abandono procesal | Reactivar bitácora / evidencias / diligencias |

**Lógica:** el dashboard del detective responde a *“¿avanzo o se me estancan los casos?”*.

---

## Criterio común de diseño

| Criterio | Aplicación |
|----------|------------|
| Un KPI = una decisión | Si no ayuda a decidir, no va en el tablero |
| Comparación temporal | Donde aplica, se muestra Δ vs periodo anterior |
| Aislamiento por rol | Supervisor no ve tipología zonal; detective no ve flota de unidad |
| Fuente de datos | Operativo: Postgres; táctico de zona: ClickHouse + Postgres (fuerza) |
