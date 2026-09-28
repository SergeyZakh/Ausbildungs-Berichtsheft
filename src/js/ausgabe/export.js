/* ============================================================
 * Export: Word-Dateien und Druck, mit Kontrolle vorher
 * ========================================================== */

/** Montag der ersten Ausbildungswoche: Vertragsbeginn, sonst die älteste Woche. */
function startMontag(s) {
  if (s.beginn) return montagVon(vonIso(s.beginn));
  return wochen.length ? vonIso(wochen[wochen.length - 1]) : montagVon(new Date());
}

/** Die Montage aller Wochen vom Start bis zur neuesten Woche. */
function alleExportMontage(s) {
  var montag = new Date(startMontag(s));
  var letzter = wochen.length ? vonIso(wochen[0]) : montag;
  var out = [], wache = 0;
  while (montag <= letzter && wache++ < 400) {
    out.push(new Date(montag));
    montag = plus(montag, 7);
  }
  return out;
}

/**
 * Dateiname mit Nummer und Zeitraum – dieselben Angaben wie im Kopf des Blattes
 * ("Nr." und "Ausbildungswoche", Montag bis Sonntag).
 *
 * Wer ein Heft über drei Jahre führt, hat sonst zwanzig Mal "Berichtsheft.docx" im
 * Downloadordner und muss jede Datei öffnen. ISO-Daten, damit die Namen in der
 * Reihenfolge der Wochen stehen; `name` nur in der Ansicht für Ausbilder.
 */
function exportName(art, nummer, vonIsoTag, bisIsoTag, name) {
  return [art].concat(name ? [name] : [], ["Nr-" + nummer, vonIsoTag + "_bis_" + bisIsoTag])
    .join("_") + ".docx";
}

/** Nummer und Zeitraum eines ganzen Hefts: von der ersten bis zur letzten Woche. */
function heftSpanne(montage) {
  var letzter = montage[montage.length - 1];
  return {
    nummer: montage.length === 1 ? "1" : "1-" + montage.length,
    von: iso(montage[0]),
    bis: iso(plus(letzter, 6))
  };
}

/* ---------- Kontrolle vor dem Export ----------
   Was im Word-Dokument oder PDF steht, wird unterschrieben. Deshalb fragt
   das Werkzeug nach, wenn Text nicht übernommen ist oder nicht in den
   Vordruck passt. Blockiert wird nichts: "Trotzdem exportieren" geht
   immer. Ohne Befund erscheint kein Dialog. */

function exportBefunde(montage) {
  var offen = [], eng = [];
  montage.forEach(function (montag) {
    for (var i = 0; i < TAGE_JE_WOCHE; i++) {
      var datum = plus(montag, i), t = tage[iso(datum)];
      if (!t) continue;
      if (t.art && !istSchultag(t.art)) continue;
      if (!(t.text || "").trim()) continue;
      var wann = WOCHENTAGE[datum.getDay()] + ", " + dmy(datum);
      var stand = tagStand(t);
      if (stand !== "fertig") {
        offen.push(wann + " — " + (stand === "roh" ? "unveränderter Entwurf aus dem Import"
          : stand === "ki" ? "vom Sprachmodell, nicht gegengelesen"
          : "selbst geschrieben, nicht übernommen"));
      }
      var n = zeilenBedarf(t.text);
      if (n > stichpunkteJeTag()) eng.push(wann + " — " + n + " statt " + stichpunkteJeTag() + " Zeilen");
    }
    var block = wochenSchule(iso(montag));
    if (block && !block.schuleGeprueft) offen.push("Blockwoche " + kurzSpanne(montag) + " — Themen nicht übernommen");
  });
  // Ohne Ausbildungsbeginn und ohne Lehrjahr stünde im Kopf nur "2 /".
  var s = stammdaten();
  var kopf = montage.length && !ausbildungsjahr(s, montage[0]) && !String(s.jahr || "").trim()
    ? ["Ausbildungsbeginn unter „Deine Daten“ eintragen"] : [];
  return { offen: offen, eng: eng, kopf: kopf };
}

/** Fragt nach, wenn etwas auffällt. Liefert ein Promise: true = exportieren. */
function exportFreigabe(alleWochen) {
  var montage = alleWochen ? alleExportMontage(stammdaten())
    : aktiveWoche ? [vonIso(aktiveWoche)] : [];
  var b = exportBefunde(montage);
  if (!b.offen.length && !b.eng.length && !b.kopf.length) return Promise.resolve(true);

  var dlg = $("dlg-pruefung");
  if (!dlg || !dlg.showModal) return Promise.resolve(true);

  var gruppen = [];
  if (b.offen.length) {
    gruppen.push({
      titel: b.offen.length === 1 ? "1 Tag ist noch nicht übernommen"
                                  : b.offen.length + " Tage sind noch nicht übernommen",
      zeilen: b.offen, klasse: "offen"
    });
  }
  if (b.eng.length) {
    gruppen.push({
      titel: b.eng.length === 1 ? "1 Tag wird im Vordruck eng"
                                : b.eng.length + " Tage werden im Vordruck eng",
      zeilen: b.eng, klasse: "eng"
    });
  }

  if (b.kopf.length) {
    gruppen.push({ titel: "Im Kopf fehlt das Ausbildungsjahr", zeilen: b.kopf, klasse: "eng" });
  }

  var wo = alleWochen ? "Im Gesamtheft" : "In dieser Woche";
  $("pruef-vorwort").textContent = b.offen.length
    ? wo + " steht noch Text, den niemand bestätigt hat."
    : b.eng.length ? wo + " braucht ein Tag mehr Platz, als der Vordruck hergibt."
    : "Im Kopf des Nachweises bliebe das Ausbildungsjahr leer.";

  var liste = $("pruef-liste");
  liste.innerHTML = "";
  gruppen.forEach(function (gruppe) {
    var box = document.createElement("div");
    box.className = "pruefgruppe " + gruppe.klasse;
    var h = document.createElement("h3");
    h.textContent = gruppe.titel;
    box.appendChild(h);
    var ul = document.createElement("ul");
    // Beim Gesamtheft wäre die volle Liste seitenlang.
    gruppe.zeilen.slice(0, 12).forEach(function (z) {
      var li = document.createElement("li");
      li.textContent = z;
      ul.appendChild(li);
    });
    if (gruppe.zeilen.length > 12) {
      var rest = document.createElement("li");
      rest.className = "pruefrest";
      rest.textContent = "… und " + (gruppe.zeilen.length - 12) + " weitere";
      ul.appendChild(rest);
    }
    box.appendChild(ul);
    liste.appendChild(box);
  });

  return new Promise(function (fertig) {
    function schliessen(antwort) {
      $("pruef-ja").removeEventListener("click", ja);
      $("pruef-nein").removeEventListener("click", nein);
      dlg.removeEventListener("close", zu);
      if (dlg.open) dlg.close();
      fertig(antwort);
    }
    function ja() { schliessen(true); }
    function nein() { schliessen(false); }
    function zu() { schliessen(false); }   // Escape heißt nein
    $("pruef-ja").addEventListener("click", ja);
    $("pruef-nein").addEventListener("click", nein);
    dlg.addEventListener("close", zu);
    dlg.showModal();
  });
}

/* ---------- Word ---------- */

/** Die Datei als Download anbieten. */
async function ausliefern(doc, name) {
  dateiAnbieten(await D.Packer.toBlob(doc), name);
}

/** Eine Datei zum Herunterladen anbieten. */
function dateiAnbieten(blob, name) {
  try {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    sage(name + " heruntergeladen.", "gut");
  } catch (e) {
    sage("Speichern nicht möglich: " + ((e && e.message) || "unbekannter Fehler"), "warn");
  }
}

async function wochenblattSpeichern() {
  if (!aktiveWoche) return;
  if (!(await exportFreigabe(false))) return;
  sage("Wochenblatt wird erzeugt …");
  try {
    var s = stammdaten(), montag = vonIso(aktiveWoche);
    var nr = wochenNummer(montag, startMontag(s));
    var doc = dokument([wochenSeite(nr, montag, s)], s, true);
    await ausliefern(doc, exportName("Wochenblatt", nr, aktiveWoche, iso(plus(montag, 6))));
  } catch (e) { sage("Fehler: " + e.message, "warn"); }
}

async function gesamtheftSpeichern() {
  if (!wochen.length) return;
  if (!(await exportFreigabe(true))) return;
  sage("Gesamtheft wird erzeugt …");
  try {
    var s = stammdaten();
    var abschnitte = [{ kinder: deckblatt(s) }, { kinder: ausbildungsgang(s) }];
    var montage = alleExportMontage(s);
    montage.forEach(function (montag, i) {
      abschnitte.push(wochenSeite(i + 1, montag, s));
    });
    var spanne = heftSpanne(montage);
    await ausliefern(dokument(abschnitte, s, false),
      exportName("Berichtsheft", spanne.nummer, spanne.von, spanne.bis));
  } catch (e) { sage("Fehler: " + e.message, "warn"); }
}

$("btn-wochenblatt").addEventListener("click", function () {
  menueSchliessen(); wochenblattSpeichern();
});
$("btn-heft").addEventListener("click", function () {
  menueSchliessen(); gesamtheftSpeichern();
});

/* Auch der Druck geht durch die Kontrolle: Ein PDF ist so endgültig wie eine Word-Datei. */
$("btn-pdf-woche").addEventListener("click", async function () {
  if (!(await exportFreigabe(false))) return;
  drucken(false);
});
$("btn-pdf-heft").addEventListener("click", async function () {
  if (!(await exportFreigabe(true))) return;
  drucken(true);
});
