#!/bin/sh
# Spielt eine Sicherung aus /sicherungen zurück. Die Datenbank wird dabei vollständig ersetzt.
#
# Vorher den Server stoppen, damit niemand während des Rückspielens schreibt:
#   docker compose -f docker-compose.server.yml stop server
#   docker compose -f docker-compose.server.yml exec sicherung sh /skripte/wiederherstellen.sh                  # listet Sicherungen
#   docker compose -f docker-compose.server.yml exec sicherung sh /skripte/wiederherstellen.sh 2026-09-16_0230
#   docker compose -f docker-compose.server.yml start server
#
# Ablauf und Prüfung: docs/SERVER.md („Sicherung“).

set -eu

ZIEL=/sicherungen

if [ $# -eq 0 ]; then
  echo "Vorhandene Sicherungen:"
  ls -1 "$ZIEL" | grep -E '^20' || echo "  (keine)"
  echo
  echo "Aufruf: wiederherstellen.sh <Name der Sicherung>"
  exit 1
fi

quelle="$ZIEL/$1"
[ -d "$quelle" ] || { echo "Sicherung $quelle nicht gefunden"; exit 1; }

echo "Prüfe Prüfsumme …"
(cd "$quelle" && sha256sum -c pruefsumme.sha256)

# Läuft der Server noch, antwortet er im Container-Netz; dann lieber abbrechen.
if wget -q -T 2 -O /dev/null "http://${SERVER_HOST:-server:8080}/gesund" 2>/dev/null; then
  echo "Der Dienst „server“ läuft noch. Erst stoppen: docker compose -f docker-compose.server.yml stop server"
  exit 1
fi

echo "Datenbank $PGDATABASE wird ersetzt …"
# --clean --if-exists löscht jede Tabelle aus der Sicherung vor dem Einspielen; eine Transaktion,
# damit ein Fehler nichts halb ersetzt zurücklässt.
pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error \
  --dbname="$PGDATABASE" "$quelle/datenbank.dump"

echo "Fertig. Jetzt: docker compose -f docker-compose.server.yml start server"
