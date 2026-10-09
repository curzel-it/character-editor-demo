/**
 * The talk's slides as a deck: arrows, space or a click step through each slide's `data-step`
 * builds, then on to the next slide. `enter` hooks (by `data-name`) run when a slide shows, its videos
 * restart, and `p` opens the presenter pane with the slide's `aside.notes`.
 * @param {Record<string, (slide: HTMLElement) => void>} hooks
 */
export function startDeck(hooks = {}) {
  const frame = document.getElementById("frame");
  const slides = [...frame.querySelectorAll(".slide")];
  const builds = slides.map((slide) => [...slide.querySelectorAll("[data-step]")]);
  const steps = builds.map((list) => Math.max(0, ...list.map((el) => Number(el.dataset.step))));
  const entered = new Set();
  let at = -1,
    step = 0;

  slides.forEach((slide, i) => {
    const foot = document.createElement("div");
    foot.className = "foot";
    foot.textContent = `${i + 1} / ${slides.length}`;
    slide.append(foot);
  });

  function paint() {
    for (const el of builds[at]) el.classList.toggle("shown", Number(el.dataset.step) <= step);
    const slide = slides[at];
    document.getElementById("presenter-title").textContent = `${at + 1} / ${slides.length} · ${slide.querySelector("h1, h2")?.textContent ?? slide.dataset.name}`;
    document.getElementById("presenter-notes").textContent = slide.querySelector("aside.notes")?.textContent.trim().replace(/\n\s+/g, "\n") ?? "";
    const next = slides[at + 1];
    document.getElementById("presenter-next").textContent = step < steps[at] ? `Next: build ${step + 1} of ${steps[at]}` : next ? `Next: ${next.querySelector("h1, h2")?.textContent ?? next.dataset.name}` : "End of the deck";
  }

  function go(i, last = false) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (at >= 0) {
      slides[at].classList.remove("live");
      for (const video of slides[at].querySelectorAll("video")) video.pause();
    }
    at = i;
    const slide = slides[at];
    void slide.offsetWidth;
    slide.classList.add("live");
    step = last ? steps[at] : 0;
    for (const video of slide.querySelectorAll("video")) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
    if (!entered.has(at)) {
      entered.add(at);
      requestAnimationFrame(() => hooks[slide.dataset.name]?.(slide));
    }
    paint();
    history.replaceState(null, "", `#${at + 1}`);
  }

  const next = () => (step < steps[at] ? (step++, paint()) : go(at + 1));
  const prev = () => (step > 0 ? (step--, paint()) : go(at - 1, true));

  addEventListener("keydown", (e) => {
    if (["ArrowRight", " ", "PageDown"].includes(e.key)) next();
    else if (["ArrowLeft", "PageUp"].includes(e.key)) prev();
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else if (e.key === "r") go(at);
    else if (e.key === "p") {
      document.body.classList.toggle("presenter");
      fit();
    } else if (e.key === "f") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } else return;
    e.preventDefault();
  });
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("#presenter, button, a")) return;
    if (e.button === 0) next();
  });
  addEventListener("hashchange", () => {
    const n = Number(location.hash.slice(1)) - 1;
    if (Number.isInteger(n) && n !== at) go(n);
  });

  function fit() {
    const pane = document.body.classList.contains("presenter") ? document.getElementById("presenter").getBoundingClientRect().width : 0;
    frame.style.transform = `scale(${Math.min((innerWidth - pane) / 1600, innerHeight / 900)})`;
  }
  addEventListener("resize", fit);
  window.__deck = { go: (i, last = true) => go(i, last), slides };
  fit();
  go(Number(location.hash.slice(1)) - 1 || 0);
}
