#!/bin/bash
# Startet eine leere Postgres-Datenbank im Container, führt die Servertests aus und räumt auf.
#
#   bash server/test/testen.sh
#   bash server/test/testen.sh --behalten   # Datenbank stehen lassen (zum Nachsehen)

set -euo pipefail
cd "$(dirname "$0")/.."

NAME=berichtsheft-testdb
PORT=55432
behalten=0
[ "${1:-}" = "--behalten" ] && behalten=1

aufraeumen() {
  if [ "$behalten" -eq 0 ]; then
    docker rm -f "$NAME" >/dev/null 2>&1 || true
  else
    echo "Datenbank bleibt: docker rm -f $NAME"
  fi
}
trap aufraeumen EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=test -p "$PORT:5432" postgres:17-alpine >/dev/null

echo "Warte auf die Datenbank …"
for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -q -U postgres; then break; fi
  sleep 1
done

node test/anmeldung.js
export DATENBANK_URL="postgres://postgres:test@localhost:$PORT/postgres"
node test/server.js
# Browsertest gegen das gebaute Werkzeug auf dem laufenden Server.
(cd .. && npm run build >/dev/null && node test/konto.js)
