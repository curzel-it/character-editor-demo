import { encodeCharacter, decodeCharacter } from "../character/characterCode.js";
import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./editorIcons.js";

/**
 * Share and import: the character's code to copy, a field to paste someone else's, and downloads of
 * a portrait PNG and the character as JSON. `onImport(spec)` hears a valid pasted code.
 */
export function openShareDialog({ spec, snapshot, onImport, toast }) {
  const code = encodeCharacter(spec);
  const dialog = document.createElement("dialog");
  dialog.className = "ce-dialog ce-share";
  dialog.setAttribute("aria-label", "Share");
  dialog.innerHTML = `
    <header class="ce-dialog__head"><h2>${icon("share")} Share ${escapeHtml(spec.name)}</h2><button type="button" class="ce-iconbtn" data-close aria-label="Close">${icon("close")}</button></header>
    <label class="ce-share__label" for="ce-share-code">Character code</label>
    <div class="ce-share__row"><input id="ce-share-code" class="ce-input ce-share__code" readonly value="${code}" /><button type="button" class="ce-btn ce-btn--accent" data-copy>${icon("copy")}<span>Copy</span></button></div>
    <p class="ce-dialog__note">Anyone can paste this code into the editor to get this exact character.</p>
    <label class="ce-share__label" for="ce-share-paste">Wear a code</label>
    <div class="ce-share__row"><input id="ce-share-paste" class="ce-input" placeholder="CE1-…" spellcheck="false" autocomplete="off" /><button type="button" class="ce-btn ce-btn--primary" data-import>${icon("paste")}<span>Wear it</span></button></div>
    <p class="ce-share__error" data-error role="alert"></p>
    <div class="ce-share__downloads">
      <button type="button" class="ce-btn ce-btn--surface" data-png>${icon("camera")}<span>Portrait PNG</span></button>
      <button type="button" class="ce-btn ce-btn--surface" data-json>${icon("download")}<span>JSON</span></button>
    </div>`;
  const $ = (q) => dialog.querySelector(q);
  const download = (href, name) => Object.assign(document.createElement("a"), { href, download: name }).click();
  const file = (spec.name || "character").replace(/[^\w-]+/g, "-").toLowerCase();
  dialog.addEventListener("click", async (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) return dialog.close();
    if (e.target.closest("[data-copy]")) {
      try {
        await navigator.clipboard.writeText(code);
        toast("Code copied");
      } catch {
        $("#ce-share-code").select();
        toast("Select and copy the code");
      }
    }
    if (e.target.closest("[data-import]")) {
      const decoded = decodeCharacter($("#ce-share-paste").value);
      if (!decoded) {
        $("[data-error]").textContent = "That doesn't look like a character code. Codes start with CE1-.";
        return;
      }
      onImport(decoded);
      dialog.close();
    }
    if (e.target.closest("[data-png]")) download(await snapshot(), `${file}.png`);
    if (e.target.closest("[data-json]")) download(`data:application/json,${encodeURIComponent(JSON.stringify(spec, null, 2))}`, `${file}.json`);
  });
  $("#ce-share-paste").addEventListener("input", () => ($("[data-error]").textContent = ""));
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  $("#ce-share-code").select();
}
