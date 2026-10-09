const ART = "/styles/ui/img";

/**
 * The Dragons! logo art: the lockup with the mountains and tagline, or the title alone.
 * @param {boolean} [full]
 */
export const logoHtml = (full = true) =>
  `<img class="dz-logo__art" src="${ART}/${full ? "logo-peaks" : "logo"}.png" alt="Dragons!" draggable="false" />`;
