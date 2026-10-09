import { applyPalette } from "./palette.js";
import { loadSubject, styles } from "./subjects.js";
import { loadCozyDetail, setCozyDetail } from "./cozyDetailPreference.js";
import { createRaceScreen } from "./raceScreen.js";

applyPalette();
setCozyDetail(loadCozyDetail());
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const module = await loadSubject("dragon");
let style = styles.some((s) => s.id === params.get("style")) ? params.get("style") : "cozy",
  blur = params.get("blur") !== "off";

const race = createRaceScreen(module, { params, style, blur, onStyle: setStyle });
window.__race = race.api;

function showStyle() {
  $("style-toggle").innerHTML = styles
    .map((s) => `<button type="button" data-style="${s.id}" aria-pressed="${s.id === style}">${s.label}</button>`)
    .join("");
}

function showBlur() {
  for (const b of $("blur-toggle").querySelectorAll("button"))
    b.setAttribute("aria-pressed", String((b.dataset.blur === "on") === blur));
}

function setStyle(id) {
  if (!styles.some((s) => s.id === id)) return;
  style = id;
  showStyle();
  showBlur();
  race.setStyle(id);
}

$("style-toggle").addEventListener("click", (e) => setStyle(e.target.closest("button")?.dataset.style));
$("blur-toggle").addEventListener("click", (e) => {
  const value = e.target.closest("button")?.dataset.blur;
  if (!value) return;
  blur = value === "on";
  showBlur();
  race.setBlur(blur);
});

showStyle();
showBlur();
await race.show(null);
window.__race.ready = true;
