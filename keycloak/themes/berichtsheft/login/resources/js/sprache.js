/*
 * Sprachwahl als zwei Umschalter „DE | EN“ statt des Klappmenüs von Keycloak.
 * Die Vorlage bleibt die von Keycloak: Das Skript liest die Links aus dem Menü und ersetzt
 * nur dessen Hülle. Ohne JavaScript bleibt das Menü stehen und funktioniert wie gewohnt.
 */
document.addEventListener("DOMContentLoaded", function () {
  var menue = document.getElementById("login-select-toggle");
  if (!menue) return;
  var huelle = menue.closest(".pf-v5-c-form-control") || menue;
  var leiste = document.createElement("div");
  leiste.className = "bh-sprache";
  leiste.setAttribute("role", "group");
  leiste.setAttribute("aria-label", "Sprache / Language");
  Array.prototype.forEach.call(menue.options, function (o) {
    var treffer = /kc_locale=([A-Za-z-]+)/.exec(o.value);
    var code = treffer ? treffer[1] : o.text.trim().slice(0, 2);
    var link = document.createElement("a");
    link.href = o.value;
    link.textContent = code.toUpperCase();
    link.lang = code;
    link.title = o.text.trim();
    if (o.selected) link.setAttribute("aria-current", "true");
    leiste.appendChild(link);
  });
  huelle.replaceWith(leiste);
});
