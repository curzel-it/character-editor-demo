const PINCH_EVENTS = ["gesturestart", "gesturechange", "gestureend"];

/** Keeps iOS Safari from zooming the page and the long-press menu from opening over the game. */
export function guardPageGestures(target = document) {
  for (const type of PINCH_EVENTS) target.addEventListener(type, (event) => event.preventDefault());
  target.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  target.addEventListener("contextmenu", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("input, textarea")) event.preventDefault();
  });
}
