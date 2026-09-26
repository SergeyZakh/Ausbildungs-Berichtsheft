# KI mit Ollama

Das Werkzeug selbst braucht keine Einrichtung: die Demo auf GitHub Pages öffnen
oder `npm run build` und `dist/Berichtsheft.html` öffnen genügt. Diese Anleitung betrifft die beiden
optionalen Teile – das Sprachmodell zum Zusammenfassen der Tage und den
Betrieb im Netz.

- **Teil A** – Ollama auf dem eigenen Rechner ausprobieren (etwa zehn Minuten).
  Damit sieht man, ob das Modell brauchbar kürzt, bevor man mehr aufbaut.
- **Teil B** – Container auf einem einzelnen Rechner für alle im Netz, Ollama im Stapel.

Im Betrieb mit Konten für Azubis und einer Ansicht für Ausbilder:
[docs/SERVER.md](SERVER.md). Eine Anleitung ohne Fachbegriffe, mit Downloads und
Schritt für Schritt: [docs/START.md](START.md).

---

## Teil A – Ollama auf dem eigenen Rechner

### A1. Ollama installieren

Von <https://ollama.com/download> installieren. Unter Windows läuft Ollama
danach als Anwendung mit Symbol in der Taskleiste.

Prüfen in PowerShell:

```powershell
ollama list
```

Kommt eine Tabelle (auch eine leere), läuft der Dienst. Sonst der Reihe nach:

```powershell
Get-Process ollama -ErrorAction SilentlyContinue   # läuft der Prozess?
Test-NetConnection localhost -Port 11434           # antwortet der Port?
Invoke-WebRequest http://127.0.0.1:11434/api/tags  # antwortet die Schnittstelle?
```

Häufigste Ursache: **Ollama läuft nicht.** Unter Windows startet es nach einem
Neustart nicht zwingend von selbst – dann aus dem Startmenü öffnen. Weitere
Ursachen: Der Virenscanner hat `ollama.exe` in Quarantäne genommen, die
Firewall blockiert, oder man arbeitet in WSL bzw. einem Container, wo
`localhost` nicht der Windows-Rechner ist.

### A2. Ein Modell holen

```powershell
ollama pull qwen3.5:4b
ollama run qwen3.5:4b "Antworte nur mit dem Wort: bereit"
```

Rund 3,4 GB. Ein 4B-Modell reicht zum Kürzen, läuft ohne Grafikkarte und neigt
wenig dazu, kreativ zu werden. Kürzt es zu grob, sind `qwen2.5:7b-instruct` oder
`phi4-mini` die nächsten Kandidaten. Bleibt das Modellfeld im Werkzeug leer,
nimmt es das erste Modell, das in Ollama installiert ist.

### A3. Ollama für die Seite öffnen

Ollama nimmt Anfragen nur von erlaubten Herkünften an. **Am einfachsten gar nichts einstellen**
und die Seite über `localhost` ausliefern – das erlaubt Ollama von sich aus:

```powershell
npm run build
npm start          # http://localhost:8080, beenden mit Strg + C
npm start -- 8081  # anderer Port
```

`skripte/servieren.js` ist ein Server ohne Abhängigkeiten und nur für den eigenen Rechner
(`127.0.0.1`). Im Netz teilen geht über Teil B.

| Wie das Berichtsheft geöffnet wird | Einstellung |
| --- | --- |
| über `npm start` oder Docker | nichts, `localhost` ist von Haus aus erlaubt |
| `Berichtsheft.html` per Doppelklick | ohne KI, siehe unten |
| Demo auf GitHub Pages | `setx /M OLLAMA_ORIGINS "https://sergeyzakh.github.io"` in PowerShell **als Administrator**, danach Ollama beenden (Rechtsklick auf das Symbol → *Quit*) und neu öffnen |

Die Einzeldatei per Doppelklick erreicht Ollama nicht, gemessen an Ollama 0.34.2: Ohne Einstellung
und mit `file://*` antwortet der Dienst mit 403, mit `"null"` startet er gar nicht erst. Nur
`OLLAMA_ORIGINS="*"` würde helfen, und das erlaubt jeder geöffneten Webseite, das lokale Ollama zu
benutzen, Modelle zu laden und zu löschen. Davon raten wir ab. Wer die KI will, nimmt `npm start`
oder Teil B.

Mit der Demo ist das nicht erprobt: Browser schränken Anfragen von einer
öffentlichen Seite an `localhost` zunehmend ein. Klappt es nicht, `npm start`
oder den Container (Teil B) nehmen.

> Im Container-Betrieb (Teil B und mit Server) ist das nicht nötig und nicht erwünscht,
> dort geht alles über den Proxy `/ki`.

### A4. Im Werkzeug eintragen

**⋯ → Deine Daten → Sprachmodell**. Ist das Adressfeld leer, sucht das Werkzeug beim Öffnen
selbst: erst `/ki`, dann `http://localhost:11434`. Antwortet eines davon, stehen Adresse und die
installierten Modelle sofort da. Von Hand geht es weiterhin:

| Feld | Wert |
| --- | --- |
| Adresse | `http://localhost:11434` |
| Modell | `qwen3.5:4b` |

**Verbindung prüfen** zeigt, ob Ollama erreichbar ist und das Modell kennt.
Danach steht im Tag unten links der Knopf **Mit KI kürzen** und im
Wochenreiter unter der Vorschau **Ganze Woche mit KI kürzen**.

Unter **Eigene Anweisungen** lassen sich Wünsche ergänzen, etwa
„Fachbegriffe aus der Netzwerktechnik nicht umschreiben“. Sie kommen zu
den festen Regeln dazu und ersetzen sie nicht.

### A5. Ausprobieren

Export laden, einen vollen Tag wählen, **Mit KI kürzen**. Der erste Aufruf dauert
länger, weil das Modell geladen wird. Dann gegenlesen: Das Modell fasst zusammen,
Nebenthemen können dabei wegfallen. Steht dort etwas, das so nicht gemacht wurde,
von Hand korrigieren; diesen Fall fängt keine Prüfung zuverlässig.

**Original zurück** stellt den vorherigen Text wieder her.

---

## Teil B – Container auf einem einzelnen Rechner

### B1. Voraussetzungen

[Docker Desktop](https://www.docker.com/products/docker-desktop/) installieren
und das Repository klonen:

```powershell
git clone https://github.com/SergeyZakh/berichtsheft.git
cd berichtsheft
```

### B2. Bauen und starten

```powershell
docker compose -f docker-compose.lokal.yml up -d --build   # bauen und starten
docker compose -f docker-compose.lokal.yml ps -a           # läuft er? ollama-modelle endet nach dem Laden
docker compose -f docker-compose.lokal.yml logs -f         # Protokoll
docker compose -f docker-compose.lokal.yml down            # anhalten
```

Der Stapel besteht aus drei Diensten:

| Dienst | Aufgabe |
| --- | --- |
| `berichtsheft` | die Seite und der Proxy `/ki` |
| `ollama` | das Sprachmodell, ohne Port nach außen |
| `ollama-modelle` | lädt beim Start das Modell aus `KI_MODELL` (Vorgabe `qwen3.5:4b`, rund 3,4 GB) und beendet sich |

Der Bau lädt einmal die Word-Bibliothek aus der npm-Registry, `ollama-modelle` beim
ersten Start das Modell von ollama.com. Danach braucht der Stapel kein Internet. Das
Modell liegt im Volume `ollama-modelle` und bleibt über Neustarts erhalten. Ein anderes
Modell: `KI_MODELL=qwen2.5:7b-instruct` in eine `.env` neben der Compose-Datei schreiben
und neu starten.

Erreichbar unter `http://localhost:8080`, im Netz unter `http://<IP-des-Rechners>:8080`
(IP mit `ipconfig`); dafür Port 8080 in der Firewall im privaten Netz freigeben. Unter
`/Berichtsheft.html` lässt sich die Einzeldatei herunterladen.

### B3. Vorhandenes Ollama statt Container

Läuft Ollama schon auf dem Rechner (Teil A) oder auf einem Rechner mit Grafikkarte, nur
das Berichtsheft starten und die Adresse setzen:

```powershell
$env:OLLAMA_HOST = "host.docker.internal:11434"   # derselbe Rechner
# $env:OLLAMA_HOST = "192.168.1.50:11434"         # anderer Rechner
docker compose -f docker-compose.lokal.yml up -d --build berichtsheft
```

Ein Ollama auf einem anderen Rechner muss dort auf alle Adressen hören (als
Administrator `setx /M OLLAMA_HOST "0.0.0.0:11434"`, danach Ollama neu starten), und
Port 11434 muss im privaten Netz offen sein.

Mit NVIDIA-Grafikkarte geht es auch im Container: den auskommentierten `deploy`-Block
beim Dienst `ollama` aktivieren. Ein Tag dauert dann Sekunden statt eher 10–20 Sekunden
auf der CPU.

### B4. Was im Werkzeug eingetragen wird

| Feld | Wert |
| --- | --- |
| Adresse | `/ki` |
| Modell | `qwen3.5:4b` |

Im Container geht **nur** `/ki`. Eine direkte Adresse wie
`http://rechner:11434` ist eine fremde Herkunft und wird von der
Content-Security-Policy abgewiesen – das ist Absicht.

### B5. Was der Container darf

| | |
| --- | --- |
| Dateisystem | schreibgeschützt; nginx schreibt nur in kleine tmpfs-Pfade im Arbeitsspeicher |
| Rechte | alle Linux-Capabilities entzogen bis auf die vier, die nginx braucht; `no-new-privileges` |
| Ressourcen | 128 MB Speicher, höchstens 64 Prozesse, Protokolle 3 × 5 MB |
| Netz | Die Seite darf per CSP nur mit der eigenen Herkunft sprechen, also mit `/ki/` |

Prüfen lässt sich das in den Entwicklerwerkzeugen unter *Netzwerk*: Außer der
Seite, `vendor/docx.js` und – beim Kürzen – `/ki/api/chat` taucht nichts auf.

### B6. Neue Fassung ausrollen

```powershell
git pull
docker compose -f docker-compose.lokal.yml up -d --build
```

Ein Neuladen der Seite genügt. Die Texte der Azubis bleiben in deren Browser.

---

## Wenn etwas klemmt

| Meldung im Werkzeug | Ursache | Abhilfe |
| --- | --- | --- |
| „… ist unter … nicht erreichbar“ | Ollama läuft nicht, falsche Adresse oder Herkunft abgewiesen | A1 prüfen; per Doppelklick geöffnet geht die KI nicht (A3) |
| „Modell … ist dort nicht installiert“ | Tippfehler, Modell noch nicht geladen oder anderer Name als `KI_MODELL` | `ollama list`; im Container `docker compose logs ollama-modelle` |
| „hat nicht rechtzeitig geantwortet“ | Antwort dauerte länger als 220 Sekunden | kleineres Modell oder Rechner mit Grafikkarte |
| Kein Knopf „Mit KI kürzen“ | Adressfeld leer | so gewollt: ohne Adresse keine Funktion |
| Container startet nicht | meist `OLLAMA_HOST` leer oder nicht auflösbar | `docker compose logs` |
| `ollama-modelle` endet mit Fehler | kein Internet beim ersten Start oder zu wenig Speicherplatz | `docker compose logs ollama-modelle`, danach `docker compose up -d ollama-modelle` |
