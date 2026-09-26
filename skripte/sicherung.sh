#!/bin/sh
# Nächtliche Sicherung der Berichtsheft-Datenbank.
#
# Läuft als Dienst „sicherung“ in docker-compose.server.yml und wartet jeweils bis SICHERUNG_UHRZEIT.
# Sofort sichern (zum Beispiel vor einem Update):
#   docker compose -f docker-compose.server.yml exec sicherung sh /skripte/sicherung.sh jetzt
#
# Ergebnis je Lauf: /sicherungen/<JJJJ-MM-TT_HHMM>/{datenbank.dump,pruefsumme.sha256}
# Wiederherstellen: skripte/wiederherstellen.sh, Ablauf in docs/SERVER.md („Sicherung“).
#
# POSIX-sh, weil das Alpine-Image der Datenbank kein bash hat. Verbindung über PGHOST, PGUSER,
# PGPASSWORD und PGDATABASE.

set -eu

ZIEL=/sicherungen
UHRZEIT="${SICHERUNG_UHRZEIT:-02:30}"
TAGE="${SICHERUNG_TAGE:-14}"

protokoll() { echo "$(date '+%F %T') $*"; }

sichern() {
  stempel="$(date +%F_%H%M)"
  ordner="$ZIEL/$stempel"
  # Erst in einen versteckten Ordner schreiben und am Ende umbenennen, damit ein
  # abgebrochener Lauf nie wie eine vollständige Sicherung aussieht.
  tmp="$ZIEL/.laufend-$stempel"
  rm -rf "$tmp"
  mkdir -p "$tmp"

  protokoll "Sicherung $stempel beginnt"

  # Eigenes Format: komprimiert, und pg_restore kann damit Tabellen einzeln und sauber ersetzen.
  # pg_dump liest in einer Transaktion, der Server läuft währenddessen weiter.
  if ! pg_dump --format=custom --compress=6 --no-owner --file="$tmp/datenbank.dump"; then
    protokoll "FEHLER: pg_dump gescheitert"
    rm -rf "$tmp"
    return 1
  fi

  # Ein Dump ohne die Tabelle mit den Tagestexten wäre wertlos; lieber laut scheitern.
  if ! pg_restore --list "$tmp/datenbank.dump" | grep -q "TABLE public tage "; then
    protokoll "FEHLER: Dump enthält keine Tabelle tage, Sicherung verworfen"
    rm -rf "$tmp"
    return 1
  fi

  (cd "$tmp" && sha256sum datenbank.dump > pruefsumme.sha256)
  mv "$tmp" "$ordner"
  protokoll "Sicherung fertig: $ordner ($(du -sh "$ordner" | cut -f1))"

  find "$ZIEL" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$TAGE" | while read -r alt; do
    rm -rf "$alt"
    protokoll "Alte Sicherung entfernt: $alt"
  done
}

# Sekunden bis zur nächsten SICHERUNG_UHRZEIT. BusyBox-date kennt kein „tomorrow 02:30“,
# deshalb über die Sekunden seit Mitternacht.
sekunden_bis() {
  jetzt=$(( $(date +%H | sed 's/^0//') * 3600 + $(date +%M | sed 's/^0//') * 60 + $(date +%S | sed 's/^0//') ))
  stunde=$(echo "$UHRZEIT" | cut -d: -f1 | sed 's/^0//')
  minute=$(echo "$UHRZEIT" | cut -d: -f2 | sed 's/^0//')
  ziel=$(( ${stunde:-0} * 3600 + ${minute:-0} * 60 ))
  rest=$(( ziel - jetzt ))
  [ "$rest" -le 0 ] && rest=$(( rest + 86400 ))
  echo "$rest"
}

if [ "${1:-}" = "jetzt" ]; then
  sichern
  exit $?
fi

protokoll "Sicherungsdienst bereit, täglich um $UHRZEIT, Aufbewahrung $TAGE Tage"
while true; do
  sleep "$(sekunden_bis)"
  # Ein Fehlschlag soll den Dienst nicht beenden; die nächste Nacht versucht es erneut.
  sichern || protokoll "FEHLER: Sicherung fehlgeschlagen"
  # Verhindert einen Doppellauf in derselben Minute.
  sleep 61
done
