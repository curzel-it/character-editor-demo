/** "+40"-style text rising from `from`, positioned inside `container`. */
export function floatText(from, text, color, container) {
  const a = from.getBoundingClientRect(),
    b = container.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "dz-float";
  el.textContent = text;
  if (color) el.style.setProperty("--c", color);
  el.style.left = `${a.left - b.left + a.width / 2}px`;
  el.style.top = `${a.top - b.top - 6}px`;
  container.append(el);
  el.addEventListener("animationend", () => el.remove());
}
