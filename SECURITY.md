# Sicherheit

## Lücke melden

Bitte **kein öffentliches Issue** für Sicherheitslücken. Melde sie über →
[GitHub Security Advisories](../../security/advisories/new). Das ist ein
privater Kanal zwischen uns.

Ich schaue in der Regel innerhalb einer Woche hinein und melde mich, auch
wenn ich noch keine Lösung habe. Hierbei handelt es sich um ein Freizeitprojekt, keine
Firma mit Bereitschaft. Plane bitte mit ein paar Tagen/Wochen.

Hilfreich in der Meldung sind u. a. die **betroffene Version, ob das Werkzeug ohne oder mit
Server lief, und wie sich die Lücke nachstellen lässt.**

## Was betroffen sein kann

| Teil | Betroffen |
| --- | --- |
| `src/`, `dist/Berichtsheft.html` | ja – läuft im Browser der Nutzerin oder des Nutzers |
| `server/`, `docker-compose.server.yml`, `nginx.conf.template` | ja – Anmeldung, Sitzungen, Datenbank |
| `keycloak/` | ja, soweit Realm-Vorlage oder Design betroffen sind |
| `test/`, `skripte/`, `docs/` | nur, wenn daraus ein Fehler im Betrieb folgt |

<br>

Unterstützt wird jeweils die neueste Version auf `main`.

## Was das Werkzeug selbst schützt

- **Ohne Server** verlassen die Daten den Browser nicht, d. h. keine Konten, keine
  Uploads, kein Netzwerkverkehr außer der optionalen lokalen KI über Ollama.

- **Mit Server** liegen auf dem Server selbst nur die Nachweisdaten (Tagestexte, Stunden,
  Status, Stammdaten). Der rohe Zeiterfassungs-Export mit Kundennamen und
  Uhrzeiten bleibt im Browser.

- Sitzungscookies sind signiert (HMAC-SHA256), `HttpOnly`, `SameSite=Lax`
  und bei https `Secure`. Rollen kommen ausschließlich aus dem ID-Token des
  Anmeldedienstes.

- Der Server-Container läuft schreibgeschützt, ohne Linux-Capabilities und
  ohne neue Rechte; die Datenbank hat keinen Port nach außen.

- `TESTANMELDUNG=1` umgeht die Anmeldung und ist nur für Tests. Das
  Server-Image startet damit gar nicht erst.

Details stehen in → [docs/SERVER.md](docs/SERVER.md), Abschnitt „Sicherheit“.

## Bekannte Grenzen

- Ausbilderinnen und Ausbilder sehen die Hefte ihrer Gruppe im Klartext

- Wer Zugriff auf den Browser-Speicher eines Geräts hat, sieht die Einträge.
  Das Werkzeug ersetzt keine Festplattenverschlüsselung.

- Die Sicherungsdateien aus `skripte/sicherung.sh` sind unverschlüsselt.
  Wer sie außer Haus kopieren möchte, verschlüsselt sie bitte selbst.
