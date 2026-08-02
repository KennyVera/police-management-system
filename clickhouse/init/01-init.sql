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

-- Hechos de partes policiales (ETL Airflow etl_partes_policiales)
CREATE TABLE IF NOT EXISTS police_analytics.fact_partes_policiales
(
    parte_id UInt64,
    numero_caso String,
    titulo String,
    tipo_delito String,
    fecha_hecho Nullable(DateTime64(3, 'UTC')),
    fecha_hora DateTime64(3, 'UTC'),
    prioridad String,
    lugar String,
    sector_zona String,
    latitud Float64,
    longitud Float64,
    estado_revision String,
    aprobado_en Nullable(DateTime64(3, 'UTC')),
    agente String,
    source_file String,
    loaded_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
ORDER BY (fecha_hora, parte_id);
