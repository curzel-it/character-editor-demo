/** Updates a meter or progress bar, flagging it low at `lowAt` and bumping its icon on demand. */
export function setMeter(el, value, { lowAt = 25, bump = false } = {}) {
  const v = Math.max(0, Math.min(100, value));
  el.style.setProperty("--value", v);
  el.setAttribute("aria-valuenow", Math.round(v));
  el.classList.toggle("is-low", v <= lowAt);
  if (bump) {
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
  }
}
