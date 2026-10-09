import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./icons.js";

/** Shows `mood` from `moodOf` as an icon and a line toned by `data-tone`, or hides it when there is none. */
export function showMood(line, mood) {
  line.hidden = !mood;
  if (!mood) return;
  const html = `${icon(mood.icon)}<span>${escapeHtml(mood.text)}</span>`;
  line.dataset.tone = mood.tone;
  if (line.dataset.html === html) return;
  line.dataset.html = html;
  line.innerHTML = html;
}
