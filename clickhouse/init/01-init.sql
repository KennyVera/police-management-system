-- Base analítica para KPIs y métricas pre-calculadas
-- BD analítica del stack SGP (independiente de crimetrack)
CREATE DATABASE IF NOT EXISTS police_analytics;

CREATE TABLE IF NOT EXISTS police_analytics.kpi_resumen_diario
(
    fecha Date,
    distrito String,
    total_partes UInt32,
    total_evidencias UInt32,
    promedio_respuesta_min Float32,
    loaded_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (fecha, distrito);
