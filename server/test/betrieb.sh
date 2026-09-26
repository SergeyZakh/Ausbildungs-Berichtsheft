#!/bin/bash
# Betriebstest: der ganze Stapel aus docker-compose.server.yml mit echtem Keycloak, wie im Betrieb.
#
#   1. Images bauen, Stapel „berichtsheft-betrieb“ frisch starten (leere Datenbank, eigener Keycloak).
#   2. In Keycloak Testkonten anlegen: zwei Azubis, zwei Ausbilder, eins ohne Gruppe.
#   3. test/betrieb.js meldet sich im Browser über Keycloak an und prüft Anmeldung, Abgleich,
#      Import, Ausbilder-Ansicht, Rechte, Grenzfälle, Belastung, Sicherung und Wiederherstellung.
#   4. Stapel samt Volumes entfernen.
#
#   bash server/test/betrieb.sh              # alles
#   bash server/test/betrieb.sh --bilder     # dazu die Bilder in docs/bilder/server/ erneuern
#   bash server/test/betrieb.sh --behalten   # Stapel stehen lassen (http://localhost:8090, Keycloak http://127.0.0.1:8180/admin)
#   KEYCLOAK_PORT=8190 bash server/test/betrieb.sh   # neben einem laufenden Stapel

set -euo pipefail
cd "$(dirname "$0")/../.."
export MSYS_NO_PATHCONV=1

# Nur für diesen Test, nie für den Betrieb.
export APP_URL=http://localhost:8090
export BERICHTSHEFT_PORT=127.0.0.1:8090
# Läuft auf dem Rechner schon ein Berichtsheft-Stapel, ist 8180 belegt und Keycloak käme
# nicht hoch: KEYCLOAK_PORT=8190 bash server/test/betrieb.sh
export KEYCLOAK_PORT="${KEYCLOAK_PORT:-8180}"
export DB_PASSWORD=betriebtestdatenbank
export SITZUNG_GEHEIMNIS=betrieb-test-sitzung-0123456789abcdef0123456789
export OIDC_ISSUER=http://keycloak:8080/realms/berichtsheft
export OIDC_CLIENT_ID=berichtsheft
export OIDC_CLIENT_SECRET=betrieb-test-geheimnis

STAPEL=(docker compose -p berichtsheft-betrieb -f docker-compose.server.yml -f server/test/docker-compose.betrieb.yml)
export BETRIEB_STAPEL="${STAPEL[*]}"

behalten=0
for arg in "$@"; do
  case "$arg" in
    --behalten) behalten=1 ;;
    # Bildschirmfotos von Anmeldung, Azubi und Ausbilder für docs/SERVER.md erneuern.
    --bilder) export BILDER=docs/bilder/server ;;
  esac
done

schritt() { echo; echo "== $*"; }
aufraeumen() {
  if [ "$behalten" -eq 0 ]; then
    schritt "Stapel entfernen"
    "${STAPEL[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  else
    echo "Stapel bleibt stehen. Berichtsheft: http://localhost:8090  Keycloak: http://127.0.0.1:$KEYCLOAK_PORT/admin (admin / betrieb-test-admin)"
    echo "Entfernen: ${STAPEL[*]} down -v"
  fi
}
trap aufraeumen EXIT

schritt "Werkzeug bauen (für die Browsertests)"
npm run build >/dev/null

schritt "Stapel frisch starten"
"${STAPEL[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${STAPEL[@]}" build
"${STAPEL[@]}" up -d --wait berichtsheft sicherung
"${STAPEL[@]}" up -d keycloak

schritt "Warten, bis Keycloak den Realm ausliefert"
for i in $(seq 1 90); do
  if curl -s --max-time 3 "http://127.0.0.1:$KEYCLOAK_PORT/realms/berichtsheft/.well-known/openid-configuration" | grep -q '"issuer"'; then
    echo "bereit nach $((i * 2)) s"; break
  fi
  [ "$i" -eq 90 ] && { echo "FEHLER: Keycloak kam nicht hoch"; "${STAPEL[@]}" logs --tail 40 keycloak; exit 1; }
  sleep 2
done

schritt "Testkonten in Keycloak anlegen"
kc() { "${STAPEL[@]}" exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"; }
kc config credentials --server http://localhost:8080 --realm master --user admin --password betrieb-test-admin >/dev/null
konto() { # benutzer vorname nachname gruppe(leer = keine)
  kc create users -r berichtsheft -s username="$1" -s enabled=true -s emailVerified=true \
    -s email="$1@betrieb.test" -s firstName="$2" -s lastName="$3" >/dev/null
  kc set-password -r berichtsheft --username "$1" --new-password "Test-Passwort-1" >/dev/null
  if [ -n "$4" ]; then
    local id gruppe
    id="$(kc get users -r berichtsheft -q username="$1" -q exact=true --fields id --format csv --noquotes | tr -d '\r')"
    gruppe="$(kc get groups -r berichtsheft -q search="$4" --fields id,name --format csv --noquotes | tr -d '\r' | grep ",$4\$" | cut -d, -f1)"
    kc update "users/$id/groups/$gruppe" -r berichtsheft -s realm=berichtsheft -s userId="$id" -s groupId="$gruppe" -n >/dev/null
  fi
  echo "✓ $1 ${4:-(ohne Gruppe)}"
}
konto joerg "Jörg" "Übermüller" berichtsheft-azubi
konto bea "Bea" "Neuling" berichtsheft-azubi
konto lena "Lena" "Langzeit" berichtsheft-azubi
konto carla "Carla" "Ausbilderin" berichtsheft-ausbilder
konto dirk "Dirk" "Fremd" berichtsheft-ausbilder
konto gast "Gustav" "Gast" ""

schritt "Betrieb testen"
node test/betrieb.js
