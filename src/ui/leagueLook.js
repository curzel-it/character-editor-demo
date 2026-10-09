import { ordinal } from "../ordinal.js";
import { divisionOf } from "../stable/divisions.js";
import { ages } from "../dragonAge.js";
import { leagueOf } from "../stable/leagues.js";
import { t } from "../i18n.js";

/** Each league's colour on its cards and banners. */
export const leagueLook = {
  kids: { color: "var(--dz-info)" },
  teens: { color: "var(--dz-primary)" },
  adults: { color: "var(--dz-accent-dark)" },
};

/** Each division's colour on its tags. */
export const divisionLook = {
  bronze: { color: "var(--dz-bronze)" },
  silver: { color: "var(--dz-silver)" },
  gold: { color: "var(--dz-gold)" },
};

/** A league's name, such as `Kids League`. @param {string} id */
export const leagueName = (id) => (leagueOf(id) ? t(`leagueLook.leagues.${id}`) : id);

/** A division's name, such as `Silver`. @param {string} id */
export const divisionName = (id) => t(`leagueLook.divisions.${divisionOf(id).id}`);

/** A course's name, `Canyon` or `Valley`. @param {string} type */
export const courseLabel = (type) => t(`leagueLook.courses.${type === "canyon" ? "canyon" : "valley"}`);

/** An age as a noun, such as `kid` or, with `count`, `kids`. @param {string} age @param {number} [count] */
export const ageNoun = (age, count = 1) => t(`leagueLook.ageNouns.${age}`, { count });

/** The notice that a league's next season began, such as `Kids League: season 3 begins in Silver!`. */
export const seasonBeginsText = (leagueId, season) => t("leagueLook.seasonBegins", { league: leagueName(leagueId), number: season.number, division: divisionName(season.division) });

/** A division's tag, `Silver` on its colour. */
export const divisionTagHtml = (id) => `<span class="dz-tag division-tag" style="--c:${divisionLook[divisionOf(id).id].color}">${divisionName(id)}</span>`;

/** `3rd Ember · 6th Sol`, the owner's finishers of a race. */
export const placingsText = (placings) => placings.map((p) => t("leagueLook.placing", { place: ordinal(p.place), name: p.name })).join(" · ");

const wing = "M16 19c3-6.5 8.5-10 14.5-9.5-1.8 2-2.2 4-1.5 6.3-2.2-.3-4 .4-5 2.2-2.2-1-5-1.1-8 1z";
const wings = (k, y) =>
  `<g transform="translate(16 ${y}) scale(${k}) translate(-16 -16)"><path d="${wing}"/><path d="${wing}" transform="matrix(-1 0 0 1 32 0)"/><ellipse cx="16" cy="18.5" rx="2.4" ry="4"/></g>`;
const glyphs = {
  kids: wings(0.62, 17),
  teens: wings(0.9, 16.5),
  adults: `${wings(0.9, 19)}<path d="M10.5 11 11.4 4.5l2.6 2.6L16 2.8l2 4.3 2.6-2.6.9 6.5z"/>`,
};

/** A league's badge: a shield in its colour with wings that grow from the Kids League to the Main Event, crowned for the Main Event. */
export const leagueEmblemHtml = (id) => `<span class="league-emblem" style="--c:${leagueLook[id].color}"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <path class="league-emblem__shield" d="M16 1.8 28.5 6v10.5c0 7-5.6 12.2-12.5 14-6.9-1.8-12.5-7-12.5-14V6z"/>
  <g class="league-emblem__glyph">${glyphs[id]}</g></svg></span>`;

/** Why a league with no owned dragon of its age is locked: the stable's dragons are too young, have grown past it, or there are none. */
export function lockedText(stable, leagueId) {
  const league = leagueOf(leagueId);
  const rank = (age) => ages.findIndex((a) => a.id === age);
  const at = rank(league.age);
  const vars = { league: leagueName(leagueId), age: ageNoun(league.age), ages: ageNoun(league.age, 2), theAges: t(`leagueLook.theAges.${league.age}`) };
  if (stable.dragons.some((w) => rank(w.age) < at)) return t("leagueLook.locked.tooYoung", vars);
  if (stable.dragons.some((w) => rank(w.age) > at)) return t("leagueLook.locked.outgrown", vars);
  return t(at === 0 ? "leagueLook.locked.noKid" : "leagueLook.locked.none", vars);
}
