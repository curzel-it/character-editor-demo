/** Hides the game's chrome for the trailer, keeping the logo and the reveal's flash and stamp; the yard's head and panel slide off so the yard frames the whole screen. */
export const trailerLook = `
  .dz-nav, .dz-toasts, .yard__roster, .stable-empty, .coach-marks, .race-hint, .breath-reveal, .catch-up, .dz-fps { display: none !important; }
  .yard__head, .topbar__back, .topbar__title { transform: translateY(-120vh) !important; }
  .yard__panel { transform: translateY(120vh) !important; }
  .yard__play, .play-bar, .play-float, #play-bar { visibility: hidden !important; }
  .yard__play { position: fixed !important; top: 100vh !important; }
  .broadcast__top, .broadcast__foot, .broadcast__tags, .broadcast__board { display: none !important; }
`;

/** Puts `trailerLook` on the page, or takes it off. */
export const lookScript = (on) => `(() => {
  document.getElementById("trailer-look")?.remove();
  if (${on}) document.head.insertAdjacentHTML("beforeend", "<style id=trailer-look>" + ${JSON.stringify(trailerLook)} + "</style>");
  return 0;
})()`;
