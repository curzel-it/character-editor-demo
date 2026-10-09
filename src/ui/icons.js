/** Inline 32×32 SVG icons: mono ones paint with currentColor, coloured ones read the theme tokens. */
const svg = (body) => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>`;
const OL = "stroke:var(--dz-navy);stroke-width:2;stroke-linejoin:round;stroke-linecap:round";
const fill = (c) => `fill:${c};${OL}`;

export const icons = {
  /* ---- Navigation (mono) ------------------------------------------------ */
  home: svg(`<path d="M3.5 15.5 16 5l12.5 10.5-2 2.3L25 16.6V27a1 1 0 0 1-1 1h-5.5v-7.5h-5V28H8a1 1 0 0 1-1-1V16.6l-1.5 1.2z" fill="currentColor"/>`),
  race: svg(`<rect x="5" y="3" width="2.6" height="26" rx="1.3" fill="currentColor"/>
    <g transform="rotate(-6 17 11)"><rect x="9" y="5" width="18" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
    <g fill="currentColor"><rect x="9" y="5" width="6" height="4.4"/><rect x="21" y="5" width="6" height="4.4"/><rect x="15" y="9.3" width="6" height="4.4"/><rect x="9" y="13.6" width="6" height="4.4"/><rect x="21" y="13.6" width="6" height="4.4"/></g></g>`),
  league: svg(`<path d="M9 4h14v7a7 7 0 0 1-14 0z" fill="currentColor"/>
    <path d="M9 6.5H5.5V8a5 5 0 0 0 4.5 5M23 6.5h3.5V8a5 5 0 0 1-4.5 5" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <path d="M14 17h4v5h-4zM10 26a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2H10z" fill="currentColor"/>`),
  altar: svg(`<g fill="currentColor"><rect x="3.5" y="5" width="25" height="5" rx="1.2"/><path d="M6 11.5h5.5l-.5 16.5H6.5zM20.5 11.5H26l-.5 16.5h-4.5z"/><rect x="12.5" y="23.5" width="7" height="4.5" rx="1"/>
    <path d="M16 12.5c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z"/></g>`),
  more: svg(`<g fill="currentColor"><circle cx="6.5" cy="16" r="3.2"/><circle cx="16" cy="16" r="3.2"/><circle cx="25.5" cy="16" r="3.2"/></g>`),
  settings: svg(`<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="4.3 4.34"/>
    <path fill="currentColor" fill-rule="evenodd" d="M16 7.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 1 1 0-17zm0 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7z"/>`),

  /* ---- UI (mono) -------------------------------------------------------- */
  plus: svg(`<path d="M16 6v20M6 16h20" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  close: svg(`<path d="M8 8l16 16M24 8 8 24" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  lock: svg(`<path d="M10 14v-3.5a6 6 0 0 1 12 0V14" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="6" y="13.5" width="20" height="15" rx="3" fill="currentColor"/>`),
  menu: svg(`<path d="M6 9h20M6 16h20M6 23h20" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`),
  play: svg(`<path d="M11 7.5v17a1 1 0 0 0 1.5.9l13.5-8.5a1 1 0 0 0 0-1.8L12.5 6.6A1 1 0 0 0 11 7.5z" fill="currentColor"/>`),
  playCircle: svg(`<circle cx="16" cy="16" r="13" style="fill:var(--dz-navy)"/><path d="M13 10v12l9.5-6z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`),
  pause: svg(`<g fill="currentColor"><rect x="8" y="6" width="5.5" height="20" rx="1.5"/><rect x="18.5" y="6" width="5.5" height="20" rx="1.5"/></g>`),
  video: svg(`<rect x="3" y="9" width="18" height="14" rx="3" fill="currentColor"/><path d="M22 14l7-4v12l-7-4z" fill="currentColor"/>`),
  arrowUp: svg(`<path d="M16 3.5 4.5 16H12v12.5h8V16h7.5z" fill="currentColor"/>`),
  evolve: svg(`<g fill="currentColor"><path d="M16 4 4 16.5h6.5V28.5h11V16.5H28z"/>
    <path d="M26 2c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4zM6 2.5c.35 1.8 1 2.45 2.8 2.8-1.8.35-2.45 1-2.8 2.8-.35-1.8-1-2.45-2.8-2.8 1.8-.35 2.45-1 2.8-2.8z"/></g>`),
  clock: svg(`<circle cx="16" cy="16" r="11.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 9.5V16l4.5 3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`),
  chevronLeft: svg(`<path d="M20.5 5 9.5 16l11 11" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRight: svg(`<path d="M11.5 5l11 11-11 11" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`),
  pencil: svg(`<path d="M5 27l1.5-6.2L21 6.3a2.1 2.1 0 0 1 3 0l1.7 1.7a2.1 2.1 0 0 1 0 3L11.2 25.5z" fill="currentColor"/><path d="M18.5 9l4.5 4.5" stroke="rgb(0 0 0 / .25)" stroke-width="1.6"/>`),
  mountain: svg(`<path d="M1.5 27 12 8.5l5.5 9 3.5-5L30.5 27z" fill="currentColor"/><path d="M12 8.5 9.2 13.4l2.8-1.2 2.6 1.6z" style="fill:var(--dz-surface)"/>`),
  pin: svg(`<path d="M16 29s-9-9.3-9-16a9 9 0 0 1 18 0c0 6.7-9 16-9 16z" fill="currentColor"/><circle cx="16" cy="13" r="3.5" style="fill:var(--dz-surface)"/>`),
  info: svg(`<circle cx="16" cy="16" r="13" fill="currentColor"/><path d="M16 14.5v8" style="stroke:var(--dz-navy)" stroke-width="3.2" stroke-linecap="round"/><circle cx="16" cy="9.5" r="2" style="fill:var(--dz-navy)"/>`),
  bed: svg(`<path d="M4.5 7v19M4.5 21h23v5M27.5 21v-4a4 4 0 0 0-4-4H13.5v8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.2" cy="16.2" r="2.6" fill="currentColor"/>`),
  female: svg(`<circle cx="16" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 19v10M11.5 24.5h9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`),
  male: svg(`<circle cx="13" cy="19" r="7.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18.5 13.5 27 5M19.5 5H27v7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`),
  mic: svg(`<rect x="11" y="3" width="10" height="16" rx="5" fill="currentColor"/><path d="M7 15a9 9 0 0 0 18 0M16 24v5M11 29h10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
  flagFinish: svg(`<rect x="5" y="3" width="2.6" height="26" rx="1.3" style="fill:var(--dz-navy)"/>
    <g transform="rotate(-6 17 11)"><rect x="9" y="5" width="18" height="13" fill="#fff" style="${OL}"/>
    <g style="fill:var(--dz-navy)"><rect x="9" y="5" width="6" height="4.4"/><rect x="21" y="5" width="6" height="4.4"/><rect x="15" y="9.3" width="6" height="4.4"/><rect x="9" y="13.6" width="6" height="4.4"/><rect x="21" y="13.6" width="6" height="4.4"/></g></g>`),

  /* ---- Stats (mono) ----------------------------------------------------- */
  speed: svg(`<path d="M3 20h8M6 14h7M9 26h5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M13 22c3-8 9-13 17-14-3 3-4 6-4 9l-6 2-2 5z" fill="currentColor"/>`),
  stamina: svg(`<path d="M1.5 27 11 10l5 8 4-6 10.5 15z" fill="currentColor"/><path d="M11 10l-2.5 4.5 2.5-1 2.3 1.5z" style="fill:var(--dz-surface)"/>`),
  maneuver: svg(`<path d="M3 16l7-6v4h8v4h-8v4z" fill="currentColor"/><path d="M29 16l-7 6v-4h-6v-4h6v-4z" fill="currentColor" opacity=".55"/><circle cx="23" cy="6" r="2" fill="currentColor"/><circle cx="9" cy="26" r="2" fill="currentColor"/>`),
  temperament: svg(`<path d="M16 3c1 5 7 7 7 14a7 7 0 0 1-14 0c0-3 1.5-5 3-6 0 3 1.5 4 3 4-1.5-4 0-8 1-12z" fill="currentColor"/><path d="M5 25l3-3M27 25l-3-3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),

  /* ---- Colored ---------------------------------------------------------- */
  meat: svg(`<circle cx="5.3" cy="24.2" r="2.7" style="${fill("#F6EBD6")}"/><circle cx="7.8" cy="26.7" r="2.7" style="${fill("#F6EBD6")}"/>
    <path d="M13 19 7 25" style="stroke:var(--dz-navy);stroke-width:5.5;stroke-linecap:round"/><path d="M13 19 7 25" style="stroke:#F6EBD6;stroke-width:2.2;stroke-linecap:round"/>
    <path d="M11 21c-3.2-3.6-2.6-10 2.6-14 5-3.8 11.6-3 13.2 1.4 1.6 4.6-1.4 11-7 13-3.6 1.4-6.6 1.9-8.8-.4z" style="${fill("#E0693A")}"/>
    <path d="M14.5 9.5c2.4-2 5.6-2.6 8-1.6" style="fill:none;stroke:#F8A77A;stroke-width:2.4;stroke-linecap:round"/>`),
  smile: svg(`<circle cx="16" cy="16" r="12.5" style="${fill("var(--dz-success)")}"/>
    <path d="M8 11a9 9 0 0 1 6-5" style="fill:none;stroke:#fff;opacity:.55;stroke-width:2;stroke-linecap:round"/>
    <g style="fill:var(--dz-navy)"><ellipse cx="12" cy="13.5" rx="1.7" ry="2.2"/><ellipse cx="20" cy="13.5" rx="1.7" ry="2.2"/></g>
    <path d="M10 18.5c1.8 3.8 10.2 3.8 12 0" style="fill:none;stroke:var(--dz-navy);stroke-width:2.2;stroke-linecap:round"/>`),
  sad: svg(`<circle cx="16" cy="16" r="12.5" style="${fill("#9CC3E8")}"/>
    <g style="fill:var(--dz-navy)"><ellipse cx="12" cy="14" rx="1.7" ry="2.2"/><ellipse cx="20" cy="14" rx="1.7" ry="2.2"/></g>
    <path d="M10.5 22.5c1.8-3.4 9.2-3.4 11 0" style="fill:none;stroke:var(--dz-navy);stroke-width:2.2;stroke-linecap:round"/>`),
  drop: svg(`<path d="M16 3S7 13.5 7 19.5a9 9 0 0 0 18 0C25 13.5 16 3 16 3z" style="${fill("color-mix(in oklab, var(--dz-info), #6FD3FF 45%)")}"/>
    <path d="M11.5 19a5 5 0 0 0 3.5 5" style="fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;opacity:.8"/>`),
  moon: svg(`<path d="M20.5 4A12.5 12.5 0 1 0 28 21.5 10 10 0 0 1 20.5 4z" style="${fill("var(--dz-purple)")}"/>
    <path d="M9 11a8 8 0 0 1 4-4" style="fill:none;stroke:#fff;opacity:.5;stroke-width:2;stroke-linecap:round"/>`),
  heart: svg(`<path d="M16 27.5C6.5 21 3 15.5 3 10.8A6.6 6.6 0 0 1 16 8.4a6.6 6.6 0 0 1 13 2.4c0 4.7-3.5 10.2-13 16.7z" style="${fill("var(--dz-primary)")}"/>
    <path d="M7 10.5a3 3 0 0 1 3-3" style="fill:none;stroke:#fff;opacity:.6;stroke-width:2;stroke-linecap:round"/>`),
  coin: svg(`<circle cx="16" cy="16" r="12.5" style="${fill("var(--dz-accent)")}"/>
    <circle cx="16" cy="16" r="8.5" style="fill:none;stroke:var(--dz-accent-dark);stroke-width:2"/>
    <path d="M12.5 17.5c1.5 2.4 5.5 2.4 7 0" style="fill:none;stroke:var(--dz-accent-dark);stroke-width:2;stroke-linecap:round"/>
    <g style="fill:var(--dz-accent-dark)"><circle cx="13.3" cy="13.5" r="1.1"/><circle cx="18.7" cy="13.5" r="1.1"/></g>`),
  gem: svg(`<path d="M16 2.5 27 9.5v13l-11 7-11-7v-13z" style="${fill("var(--dz-purple)")}"/>
    <path d="M16 2.5 27 9.5 16 16 5 9.5z" style="fill:var(--dz-purple-light)"/>
    <path d="M16 16v13.5L5 22.5V9.5z" style="fill:var(--dz-purple-dark);opacity:.55"/>
    <path d="M16 2.5 27 9.5v13l-11 7-11-7v-13z" style="fill:none;${OL}"/>`),
  crown: svg(`<path d="M4 25 5.5 10l6 6L16 6l4.5 10 6-6L28 25z" style="${fill("var(--dz-accent)")}"/>
    <path d="M4.6 21h22.8" style="${OL}"/>
    <g style="${fill("var(--dz-primary)")};stroke-width:1.5"><circle cx="16" cy="17" r="1.8"/></g>`),
  medal: svg(`<path d="M8 2.5h6l4 10h-6zM24 2.5h-6l-4 10h6z" style="${fill("var(--dz-primary)")}"/>
    <circle cx="16" cy="20.5" r="8.5" style="${fill("var(--metal, var(--dz-gold))")}"/>
    <circle cx="16" cy="20.5" r="4.6" style="fill:none;stroke:var(--dz-navy);stroke-width:1.5;opacity:.45"/>`),
  trophy: svg(`<path d="M9 7.5H5.5V10a5 5 0 0 0 5 5M23 7.5h3.5V10a5 5 0 0 1-5 5" style="fill:none;stroke:var(--dz-navy);stroke-width:4;stroke-linecap:round"/>
    <path d="M9 7.5H5.5V10a5 5 0 0 0 5 5M23 7.5h3.5V10a5 5 0 0 1-5 5" style="fill:none;stroke:var(--metal, var(--dz-gold));stroke-width:1.6;stroke-linecap:round"/>
    <path d="M8.5 4h15v7.5a7.5 7.5 0 0 1-15 0z" style="${fill("var(--metal, var(--dz-gold))")}"/>
    <path d="M14 18.5h4V23h-4zM10.5 28v-2.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V28z" style="${fill("var(--dz-wood)")}"/>`),
  gear: svg(`<circle cx="16" cy="16" r="10.5" style="fill:none;stroke:var(--dz-navy);stroke-width:7.5;stroke-dasharray:4.6 3.65"/>
    <circle cx="16" cy="16" r="10.5" style="fill:none;stroke:#7D8CA0;stroke-width:4.5;stroke-dasharray:3 5.25;stroke-dashoffset:-.8"/>
    <circle cx="16" cy="16" r="8.5" style="${fill("#7D8CA0")}"/><circle cx="16" cy="16" r="3.5" style="${fill("var(--dz-surface)")}"/>`),
  mail: svg(`<rect x="3.5" y="7.5" width="25" height="17" rx="2.5" style="${fill("var(--dz-surface)")}"/><path d="M4.5 9 16 18l11.5-9" style="fill:none;${OL}"/>`),
  brush: svg(`<g transform="rotate(-32 16 16)"><path d="M8 20v7M11 20v7M14 20v7M17 20v7M20 20v7M23 20v7" style="stroke:var(--dz-navy);stroke-width:2.2;stroke-linecap:round"/>
    <rect x="5" y="11" width="22" height="9" rx="3" style="${fill("#B7773A")}"/><path d="M8 14h16" style="stroke:#E3A868;stroke-width:2;stroke-linecap:round"/></g>`),
  ball: svg(`<circle cx="16" cy="16" r="12.5" style="${fill("color-mix(in oklab, var(--dz-info), #BDE8FF 55%)")}"/>
    <path d="M16 3.5v25M3.5 16h25M7 7c5 4 13 4 18 0M7 25c5-4 13-4 18 0" style="fill:none;stroke:var(--dz-navy);stroke-width:1.6;opacity:.6"/>`),
  book: svg(`<path d="M7 5.5A2.5 2.5 0 0 1 9.5 3H26v22H9.5A2.5 2.5 0 0 0 7 27.5z" style="${fill("var(--dz-purple)")}"/>
    <path d="M7 27.5A2.5 2.5 0 0 1 9.5 25H26v4H9.5A2.5 2.5 0 0 1 7 27.5z" style="${fill("#F6EBD6")}"/>
    <path d="M17 7.5l1.8 3.6 4 .6-2.9 2.8.7 4L17 16.6l-3.6 1.9.7-4-2.9-2.8 4-.6z" style="fill:var(--dz-accent);stroke:var(--dz-accent-dark);stroke-width:1;stroke-linejoin:round"/>`),
  egg: svg(`<path d="M16 2.5c-5.8 0-10.5 9.4-10.5 16.5a10.5 10.5 0 0 0 21 0C26.5 12 21.8 2.5 16 2.5z" style="${fill("var(--dz-purple)")}"/>
    <path d="M16 2.5 22 13 16 19 10 13z" style="fill:var(--dz-purple-light)"/><path d="M5.5 19 10 13l6 6-5 10z" style="fill:var(--dz-purple-dark);opacity:.5"/>
    <path d="M16 2.5c-5.8 0-10.5 9.4-10.5 16.5a10.5 10.5 0 0 0 21 0C26.5 12 21.8 2.5 16 2.5z" style="fill:none;${OL}"/>`),
  star: svg(`<path d="M16 3l3.9 8 8.8 1.3-6.4 6.2 1.5 8.8L16 23.1l-7.8 4.2 1.5-8.8-6.4-6.2 8.8-1.3z" style="${fill("var(--dz-accent)")}"/>
    <path d="M12 12.5l2.5-.4" style="stroke:#fff;stroke-width:1.8;stroke-linecap:round;opacity:.7"/>`),
  starReach: svg(`<path d="M16 3l3.9 8 8.8 1.3-6.4 6.2 1.5 8.8L16 23.1l-7.8 4.2 1.5-8.8-6.4-6.2 8.8-1.3z" style="fill:none;stroke:var(--dz-accent-dark);stroke-width:2.2;stroke-linejoin:round"/>`),
  starEmpty: svg(`<path d="M16 3l3.9 8 8.8 1.3-6.4 6.2 1.5 8.8L16 23.1l-7.8 4.2 1.5-8.8-6.4-6.2 8.8-1.3z" style="fill:#9AA3AF;stroke:#6B7684;stroke-width:1.6;stroke-linejoin:round"/>`),
  bolt: svg(`<path d="M19 2.5 6 18h8.5l-2.5 11.5L26 13h-8.5z" style="${fill("var(--dz-accent)")}"/>`),
  flame: svg(`<path d="M16 2.5c1 5 7.5 8.5 8.5 15.5A8.5 8.5 0 0 1 16 29.5 8.5 8.5 0 0 1 7.5 21c0-4 2.2-6 3.5-7.5.3 2.5 1.5 4 2.8 4.5C12.8 12 14 6.5 16 2.5z" style="${fill("var(--dz-warning)")}"/>
    <path d="M16 16.5c.7 2.5 4 4 4 7.2a4 4 0 0 1-8 0c0-2 1.5-3 2-4.2.6 1 1.4 1.4 2 1.4-.4-1.4-.4-3 0-4.4z" style="fill:var(--dz-accent)"/>`),
  leaf: svg(`<path d="M26.5 4.5C13 4.5 5.5 11 5.5 19.5c0 2.3.6 4.3 1.6 6C18 26 26.5 19 26.5 4.5z" style="${fill("var(--dz-success)")}"/>
    <path d="M4 28c4-6 9-10.5 16-14.5" style="fill:none;${OL}"/>`),
  rock: svg(`<path d="M3.5 25.5 7 14l7-6.5 8.5 2 6 8.5-1.5 7.5z" style="${fill("#C9A26B")}"/>
    <path d="M14 7.5 12.5 16l-5.5-2M12.5 16l7 2.5 9-.5" style="fill:none;stroke:var(--dz-navy);stroke-width:1.6;stroke-linejoin:round;opacity:.55"/>`),
  wave: svg(`<path d="M3 21c3-2.5 5.5-2.5 8 0s5 2.5 7.5 0 5-2.5 7.5 0 3 2 3 2V28H3z" style="${fill("color-mix(in oklab, var(--dz-info), #6FD3FF 45%)")}"/>
    <path d="M5 15c2.5-5 7-8 12-8 3.5 0 6.5 1.5 8 4-2.5-.5-4.5 0-5.5 2 2 0 3.5 1 4 2.5-3-1-6-.5-8 1.5" style="${fill("color-mix(in oklab, var(--dz-info), #fff 35%)")}"/>`),
  evolveColor: svg(`<path d="M16 3 4.5 15.5H11V28h10V15.5h6.5z" style="${fill("#fff")}"/>
    <path d="M25 2.2c.5 2.6 1.200 3.300 3.800 3.800-2.600.5-3.300 1.200-3.800 3.800-.5-2.600-1.200-3.300-3.800-3.800 2.600-.5 3.300-1.200 3.800-3.800z" style="${fill("var(--dz-accent)")}"/>
    <path d="M6.500 3.500c.3 1.700.8 2.200 2.500 2.500-1.700.3-2.200.8-2.500 2.500-.3-1.700-.8-2.200-2.500-2.500 1.700-.3 2.200-.8 2.500-2.500z" style="${fill("var(--dz-accent)")};stroke-width:1.6"/>`),
  dice: svg(`<rect x="4" y="4" width="24" height="24" rx="6" style="${fill("#fff")}"/>
    <g style="fill:var(--dz-navy)"><circle cx="10.5" cy="10.5" r="2.3"/><circle cx="21.5" cy="10.5" r="2.3"/><circle cx="16" cy="16" r="2.3"/><circle cx="10.5" cy="21.5" r="2.3"/><circle cx="21.5" cy="21.5" r="2.3"/></g>`),
  sparkle: svg(`<path d="M16 2c1.2 7.5 6.5 12.8 14 14-7.5 1.2-12.8 6.5-14 14-1.2-7.5-6.5-12.8-14-14 7.5-1.2 12.8-6.5 14-14z" style="fill:#fff;stroke:var(--dz-accent);stroke-width:1.5;stroke-linejoin:round"/>`),
  bedColor: svg(`<g style="fill:none;stroke:var(--dz-navy);stroke-width:6.4;stroke-linecap:round;stroke-linejoin:round"><path d="M4.5 7v19M4.5 21h23v5M27.5 21v-4a4 4 0 0 0-4-4H13.5v8"/></g><circle cx="9.2" cy="16.2" r="4.3" style="fill:var(--dz-navy)"/><path d="M4.5 7v19M4.5 21h23v5M27.5 21v-4a4 4 0 0 0-4-4H13.5v8" style="fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round"/><circle cx="9.2" cy="16.2" r="2.8" fill="#fff"/>`),
};

/** An icon wrapped in a sizing span; `size` is px or any CSS length. */
export function icon(name, size) {
  const style = size ? ` style="--size:${typeof size === "number" ? `${size}px` : size}"` : "";
  return `<span class="dz-icon"${style}>${icons[name] ?? ""}</span>`;
}
