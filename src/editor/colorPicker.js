import { isHex } from "../character/characterColors.js";

const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
};

const hexToHsv = (hex) => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, max ? d / max : 0, max];
};

/**
 * A colour picker popover: a saturation and brightness square, a hue strip and a hex field, opened
 * next to `anchor` with `value`; `onInput(hex)` hears every move and `onCommit(hex)` the release.
 * Escape or a click outside closes it.
 */
export function openColorPicker(anchor, { value, onInput, onCommit, label = "Custom colour" }) {
  document.querySelector(".ce-picker")?.remove();
  let [h, s, v] = hexToHsv(isHex(value) ? value : "#808080");
  const el = document.createElement("div");
  el.className = "ce-picker";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", label);
  el.innerHTML = `
    <div class="ce-picker__square" data-square tabindex="0" aria-label="Saturation and brightness"><i class="ce-picker__knob" data-knob></i></div>
    <div class="ce-picker__hue" data-hue tabindex="0" aria-label="Hue"><i class="ce-picker__knob" data-hue-knob></i></div>
    <div class="ce-picker__row"><i class="ce-picker__chip" data-chip></i><input class="ce-picker__hex" data-hex maxlength="7" spellcheck="false" aria-label="Hex colour" /><button type="button" class="ce-btn ce-btn--small ce-btn--accent" data-done>Done</button></div>`;
  document.body.append(el);
  const $ = (q) => el.querySelector(q);
  const hex = () => hsvToHex(h, s, v);
  function paint() {
    $("[data-square]").style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(h, 1, 1)})`;
    Object.assign($("[data-knob]").style, { left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hex() });
    Object.assign($("[data-hue-knob]").style, { left: `${h * 100}%`, background: hsvToHex(h, 1, 1) });
    $("[data-chip]").style.background = hex();
    if (document.activeElement !== $("[data-hex]")) $("[data-hex]").value = hex();
  }
  function place() {
    const box = anchor.getBoundingClientRect();
    const w = el.offsetWidth,
      hgt = el.offsetHeight;
    const left = Math.min(innerWidth - w - 8, Math.max(8, box.left + box.width / 2 - w / 2));
    const top = box.bottom + hgt + 12 < innerHeight ? box.bottom + 8 : Math.max(8, box.top - hgt - 8);
    Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  }
  const dragOn = (target, apply) => {
    target.addEventListener("pointerdown", (e) => {
      target.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const box = target.getBoundingClientRect();
        apply(Math.max(0, Math.min(1, (ev.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (ev.clientY - box.top) / box.height)));
        paint();
        onInput(hex());
      };
      move(e);
      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        onCommit(hex());
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    });
  };
  dragOn($("[data-square]"), (x, y) => ((s = x), (v = 1 - y)));
  dragOn($("[data-hue]"), (x) => (h = Math.min(0.999, x)));
  const nudge = (target, keys) =>
    target.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      const change = keys[e.key];
      if (!change) return;
      e.preventDefault();
      change(step);
      paint();
      onCommit(hex());
    });
  nudge($("[data-square]"), {
    ArrowLeft: (d) => (s = Math.max(0, s - d)),
    ArrowRight: (d) => (s = Math.min(1, s + d)),
    ArrowUp: (d) => (v = Math.min(1, v + d)),
    ArrowDown: (d) => (v = Math.max(0, v - d)),
  });
  nudge($("[data-hue]"), { ArrowLeft: (d) => (h = Math.max(0, h - d)), ArrowRight: (d) => (h = Math.min(0.999, h + d)) });
  $("[data-hex]").addEventListener("input", (e) => {
    const text = e.target.value.trim().replace(/^([^#])/, "#$1");
    if (!isHex(text)) return;
    [h, s, v] = hexToHsv(text.toLowerCase());
    paint();
    onCommit(text.toLowerCase());
  });
  function close() {
    el.remove();
    removeEventListener("pointerdown", outside, true);
    removeEventListener("keydown", escape, true);
    anchor.focus?.();
  }
  const outside = (e) => {
    if (!el.contains(e.target) && e.target !== anchor) close();
  };
  const escape = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  };
  $("[data-done]").addEventListener("click", close);
  addEventListener("pointerdown", outside, true);
  addEventListener("keydown", escape, true);
  paint();
  place();
  $("[data-square]").focus();
  return { close };
}
