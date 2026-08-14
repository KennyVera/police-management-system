# Informes compuestos — Nivel táctico (Jefe de Zona)

Un **informe compuesto** cruza **varios indicadores y visualizaciones** del mismo periodo/filtros para apoyar una decisión táctica. En el sistema se exportan desde el Dashboard de zona (PDF por pestaña) o desde Reportes de zona (PDF/Excel de rendición).

> Nivel **estratégico** (Alto Mando): ver [04_Informes_Compuestos_Estrategico.md](./04_Informes_Compuestos_Estrategico.md).

| Característica | Descripción |
|----------------|-------------|
| Alcance | Jurisdicción del jefe + filtros (fechas, distrito, tipo de delito) |
| Fuentes | ClickHouse (hechos) + Postgres (fuerza / contexto) |
| Uso | Planeación de patrullaje, refuerzos, rendición al Alto Mando |
| Formato | PDF (y en algunos casos Excel) + análisis textual |

---

## 1. Mapa de calor delictivo sectorizado

| Campo | Detalle |
|-------|---------|
| **Nombre** | Mapa de calor · pestaña *Mapa de Calor* |
| **Rol** | Jefe de Zona |
| **Cómo actúa** | Carga focos georreferenciados + reloj criminológico (día/hora). El PDF incluye mapa con calles, top focos, radar, picos y párrafo de análisis. |
| **Para qué sirve** | Decidir **dónde** y **cuándo** concentrar patrullaje (territorio + franja horaria). |
| **Salida** | `Exportar PDF (Mapa)` |

---

## 2. Ranking de productividad interna (Top distritos)

| Campo | Detalle |
|-------|---------|
| **Nombre** | Ranking Distritos · matriz delitos × arrestos + leaderboard |
| **Rol** | Jefe de Zona |
| **Cómo actúa** | Ordena distritos por volumen; ubica cada uno en cuadrantes (crítico / efectivo / equilibrado); muestra tendencia 7 días. El PDF lleva matriz, tabla leaderboard, serie diaria y análisis. |
| **Para qué sirve** | Ver **quién rinde** (arrestos vs delitos) y a quién reforzar o reconocer. |
| **Salida** | `Exportar PDF (Ranking)` |

---

## 3. Estadística comparativa (mes actual vs mes anterior)

| Campo | Detalle |
|-------|---------|
| **Nombre** | Informe de zona / Reportes y rendición (resumen + exportación) |
| **Rol** | Jefe de Zona |
| **Cómo actúa** | En *Reportes* se previsualiza y exporta PDF/Excel con totales del periodo y contraste **mes actual / mes anterior**, tipología y ranking territorial (ClickHouse). Audiencia: Alto Mando o autoridades civiles. |
| **Para qué sirve** | Rendición: demostrar si la zona **subió o bajó** respecto al mes previo y en qué tipologías/distritos. |
| **Salida** | Módulo *Reportes* → Exportar PDF / Excel |

---

## Cómo se usan juntos

| Orden sugerido | Informe | Pregunta que responde |
|----------------|---------|------------------------|
| 1 | Estadística comparativa | ¿Mejoramos o empeoramos vs el mes pasado? |
| 2 | Mapa de calor | ¿Dónde y a qué hora actúo? |
| 3 | Ranking distritos | ¿Qué distrito necesita refuerzo o es modelo? |

---

## Relación con el dashboard

| Pestaña dashboard | Informe compuesto asociado |
|-------------------|----------------------------|
| Delitos Locales | Snapshot PDF del panel (KPIs + tipología + evolución + ranking barras) |
| Mapa de Calor | Mapa de calor delictivo sectorizado |
| Ranking Distritos | Ranking de productividad interna |
| Reportes (módulo aparte) | Estadística comparativa / rendición formal |
