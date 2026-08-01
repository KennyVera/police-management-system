#!/bin/bash
set -euo pipefail

# Crea la BD de metadata de Airflow sin alterar departamento_policial (Django).
AIRFLOW_DB_NAME="${AIRFLOW_DB:-airflow}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
SELECT 'CREATE DATABASE ${AIRFLOW_DB_NAME}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${AIRFLOW_DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${AIRFLOW_DB_NAME} TO ${POSTGRES_USER};
EOSQL

echo "Database '${AIRFLOW_DB_NAME}' ready for Airflow metadata."
