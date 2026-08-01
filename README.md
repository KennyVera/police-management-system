# Sistema de Gestión Policial — Infraestructura base

Arquitectura de microservicios orquestada con **Docker Compose**: Django, React (Vite), MinIO (Data Lake), ClickHouse (Warehouse) y Apache Airflow (ETL).

## Arranque rápido

```bash
cd police-management-system

# 1) Revisar credenciales
#    Editar .env si es necesario (PostgreSQL ya viene con tus valores)

# 2) Construir imágenes y levantar todo en segundo plano
docker compose up -d --build

# 3) Ver estado de contenedores
docker compose ps

# 4) Seguir logs (opcional)
docker compose logs -f backend
docker compose logs -f airflow-webserver
```

Primera vez: `airflow-init` migra la metadata y crea el usuario web. Puede tardar 1–2 minutos.

## Aislamiento respecto a stacks antiguos

Este compose **no reutiliza** `departamentopolicial` ni `crimetrack`.

| Stack Docker Desktop | Contenedores | Volúmenes |
|----------------------|--------------|-----------|
| `departamentopolicial` (viejo) | `departamento-*` | `departamentopolicial_*` |
| `crimetrack` (viejo) | `crimetrack-*` | `crimetrack_*` |
| **`police-management` (NUEVO)** | **`sgp_*`** | **`sgp_*`** |

Puertos del host también están desplazados para poder convivir sin choques.

## URLs locales (stack SGP)

| Servicio        | URL                         | Credenciales (`.env`)      |
|-----------------|-----------------------------|----------------------------|
| Frontend React  | http://localhost:3001       | —                          |
| Backend Django  | http://localhost:8001/api/health/ | —                    |
| Airflow UI      | http://localhost:8081       | admin / AirflowPolicial2026 |
| MinIO Console   | http://localhost:9101       | minioadmin / MinIOPolicial2026 |
| MinIO API       | http://localhost:9100       | idem                       |
| ClickHouse HTTP | http://localhost:8124       | default / ClickHousePolicial2026 |
| ClickHouse Native | localhost:9010            | (mapeado; interno :9000)   |
| PostgreSQL      | localhost:5433              | postgres / DepPolicial2026 |

## Bases de datos en PostgreSQL (`sgp_postgres`)

- `gestion_policial` — operativa Django (BD nueva, volumen `sgp_postgres_data`)
- `airflow` — metadata del orquestador ETL (creada por `postgres/init`)

## Flujo ETL (auditoría)

```
MinIO (.parquet)
   → airflow/Datos/<etl>/Crudo
   → airflow/Datos/<etl>/Procesados
   → airflow/Datos/<etl>/Terminado
   → ClickHouse (KPIs)
```

DAG de ejemplo: `etl_partes_policiales_hourly` (cada hora).

## Comandos útiles

```bash
# Detener sin borrar volúmenes
docker compose down

# Detener y borrar volúmenes (reset total de datos)
docker compose down -v

# Shell en backend
docker compose exec backend python manage.py createsuperuser

# Reiniciar solo un servicio
docker compose restart backend
```

## Nota de puertos

ClickHouse nativo interno es **9000**; en el host SGP se publica como **9010**. MinIO SGP usa **9100/9101** para no chocar con `departamento-minio` (9000/9001).
