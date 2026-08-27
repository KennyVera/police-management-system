#!/bin/bash
set -e

echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
until python - <<'PY'
import os, socket, sys
host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
try:
    with socket.create_connection((host, port), timeout=2):
        sys.exit(0)
except OSError:
    sys.exit(1)
PY
do
  sleep 2
done

echo "PostgreSQL is up. Applying migrations..."
python manage.py migrate --noinput
python manage.py load_ecuador_map
python manage.py seed_demo_users
python manage.py seed_catalogos
python manage.py seed_despacho_demo
python manage.py seed_flota
python manage.py seed_detective_demo
python manage.py seed_saas

echo "Starting Django..."
exec "$@"
