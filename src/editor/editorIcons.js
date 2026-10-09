/** The editor's 32×32 line icons, painted with currentColor. */
const svg = (body) => `<svg class="ce-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>`;
const line = (d, w = 2.4) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const editorIcons = {
  body: svg(`<circle cx="16" cy="7" r="3.6" fill="currentColor"/>${line("M9 13.5c4.5-1.6 9.5-1.6 14 0M16 13v8M16 21l-4 7.5M16 21l4 7.5M10 13.5l-2.5 8M22 13.5l2.5 8")}`),
  face: svg(`<circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="14" r="1.9" fill="currentColor"/><circle cx="20" cy="14" r="1.9" fill="currentColor"/>${line("M11.5 19.5c2.5 2.6 6.5 2.6 9 0")}`),
  eye: svg(`${line("M3.5 16C7 9.5 11.5 7 16 7s9 2.5 12.5 9c-3.5 6.5-8 9-12.5 9S7 22.5 3.5 16z")}<circle cx="16" cy="16" r="4.6" fill="currentColor"/><circle cx="17.6" cy="14.4" r="1.4" fill="var(--ce-icon-glint, #fff)"/>`),
  hair: svg(`<path d="M6 19c-1.5-8 3.5-14 10-14s11.5 6 10 14c-1.4-3-3.3-5-5.6-6-1.8 2.3-5.5 3.8-10.4 3.5C8.4 17 7 17.8 6 19z" fill="currentColor"/>${line("M7.5 20c.4 3.6 1.5 6.1 3 7.5M24.5 20c-.4 3.6-1.5 6.1-3 7.5")}`),
  shirt: svg(`<path d="M11 4.5 4 8.5l2.5 6 3-1.3V27.5h13V13.2l3 1.3 2.5-6-7-4c-.6 2.2-2.6 3.6-5 3.6s-4.4-1.4-5-3.6z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>`),
  hat: svg(`<path d="M9 19.5c0-7 2.8-12 7-12s7 5 7 12z" fill="currentColor"/><ellipse cx="16" cy="21" rx="13" ry="3.6" fill="currentColor"/>`),
  undo: svg(line("M9 11h11a6.5 6.5 0 0 1 0 13h-7M13.5 6.5 9 11l4.5 4.5", 2.8)),
  redo: svg(line("M23 11H12a6.5 6.5 0 0 0 0 13h7M18.5 6.5 23 11l-4.5 4.5", 2.8)),
  dice: svg(`<rect x="5" y="5" width="22" height="22" rx="5.5" fill="none" stroke="currentColor" stroke-width="2.4"/><g fill="currentColor"><circle cx="11" cy="11" r="2"/><circle cx="21" cy="11" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="11" cy="21" r="2"/><circle cx="21" cy="21" r="2"/></g>`),
  lock: svg(`<rect x="7" y="14" width="18" height="13" rx="3" fill="currentColor"/>${line("M11 14v-3.5a5 5 0 0 1 10 0V14")}`),
  unlock: svg(`<rect x="7" y="14" width="18" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>${line("M11 14v-3.5a5 5 0 0 1 9.6-2")}`),
  share: svg(`<circle cx="23" cy="8" r="3.6" fill="currentColor"/><circle cx="9" cy="16" r="3.6" fill="currentColor"/><circle cx="23" cy="24" r="3.6" fill="currentColor"/>${line("M12 14.3l8-4.6M12 17.7l8 4.6")}`),
  hanger: svg(line("M16 9.5a3 3 0 1 1 3-3M16 9.5v2.5L4.5 21.5a1.6 1.6 0 0 0 1 2.9h21a1.6 1.6 0 0 0 1-2.9L16 12")),
  save: svg(`<path d="M8 4.5h16a1.5 1.5 0 0 1 1.5 1.5v21.5L16 21.5l-9.5 6V6A1.5 1.5 0 0 1 8 4.5z" fill="currentColor"/>`),
  camera: svg(`<path d="M5 10.5a2 2 0 0 1 2-2h3.5L12.5 5h7l2 3.5H25a2 2 0 0 1 2 2V24a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="16" cy="17" r="4.6" fill="currentColor"/>`),
  target: svg(`<circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="16" cy="16" r="4" fill="currentColor"/>${line("M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4")}`),
  close: svg(line("M8 8l16 16M24 8 8 24", 3)),
  check: svg(line("M6.5 16.5l6 6L26 9", 3.2)),
  copy: svg(`<rect x="10" y="10" width="16" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>${line("M7 21.5V8a3 3 0 0 1 3-3h10")}`),
  download: svg(line("M16 4.5v15M10 14l6 6 6-6M6 26.5h20", 2.8)),
  paste: svg(`<rect x="7" y="6.5" width="18" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="11.5" y="4" width="9" height="5" rx="1.5" fill="currentColor"/>${line("M12 16h8M12 21h5")}`),
  trash: svg(line("M6 9h20M12.5 9V6h7v3M8.5 9l1.3 17.5h12.4L23.5 9M13.5 13.5v9M18.5 13.5v9")),
  plus: svg(line("M16 6v20M6 16h20", 3)),
  minus: svg(line("M6 16h20", 3)),
  sparkle: svg(`<path d="M16 3c.9 6 3.6 8.8 9.6 9.7-6 .9-8.7 3.6-9.6 9.6-.9-6-3.6-8.7-9.6-9.6C12.4 11.8 15.1 9 16 3z" fill="currentColor"/><path d="M25 20c.4 2.6 1.6 3.8 4.2 4.2-2.6.4-3.8 1.6-4.2 4.2-.4-2.6-1.6-3.8-4.2-4.2 2.6-.4 3.8-1.6 4.2-4.2z" fill="currentColor"/>`),
  wave: svg(`<path d="M12 27c-3-2-5-5.5-5.5-9l-.8-5a1.6 1.6 0 0 1 3.1-.7l1.4 4.2V7.5a1.7 1.7 0 0 1 3.4 0V14V5.5a1.7 1.7 0 0 1 3.4 0V14V6.5a1.7 1.7 0 0 1 3.4 0V15V9a1.7 1.7 0 0 1 3.4 0v9c0 5-3.5 9-8 9z" fill="currentColor"/>`),
  smile: svg(`<circle cx="16" cy="16" r="12" fill="currentColor"/><g fill="var(--ce-icon-glint, #fff)"><circle cx="11.8" cy="13.5" r="1.8"/><circle cx="20.2" cy="13.5" r="1.8"/></g><path d="M10.5 18.5c3 3.4 8 3.4 11 0" fill="none" stroke="var(--ce-icon-glint, #fff)" stroke-width="2.2" stroke-linecap="round"/>`),
  palette: svg(`<path d="M16 4C9 4 4 9 4 15.5S9.5 28 15 28c2.2 0 2.8-1.6 2-3-1-1.8.2-3.5 2.2-3.5H23c3 0 5-2.4 5-5.5C28 9 22.5 4 16 4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><g fill="currentColor"><circle cx="10" cy="15" r="2.1"/><circle cx="13" cy="9.5" r="2.1"/><circle cx="19.5" cy="9" r="2.1"/><circle cx="23.5" cy="14" r="2.1"/></g>`),
  rotate: svg(line("M26 16a10 10 0 1 1-3-7.1M26 5v6h-6", 2.8)),
  zoomIn: svg(`<circle cx="14" cy="14" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/>${line("M20.5 20.5 27 27M14 10v8M10 14h8")}`),
  zoomOut: svg(`<circle cx="14" cy="14" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/>${line("M20.5 20.5 27 27M10 14h8")}`),
  more: svg(`<g fill="currentColor"><circle cx="7" cy="16" r="2.8"/><circle cx="16" cy="16" r="2.8"/><circle cx="25" cy="16" r="2.8"/></g>`),
};

export const icon = (name) => editorIcons[name] ?? "";
