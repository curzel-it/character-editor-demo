import { createJockey, restoreJockey, riderNameLength } from "../jockey/createJockey.js";
import { restoreSilks } from "../jockey/jockeySilks.js";
import { restoreRiderLook } from "../jockey/riderLook.js";
import { ownTeam } from "./teams.js";

/** @typedef {import("../jockey/createJockey.js").Rider} Rider */

/** Every owner's look: only the name is theirs to pick. */
export const ownerLook = {
  build: "athletic",
  skin: "tan",
  ears: "round",
  eyes: "brown",
  hair: "short",
  hairColor: "chestnut",
  facialHair: "none",
  marks: "none",
  hat: "cap",
  goggles: "smoke",
  scarf: "short",
  gloves: "leather",
  boots: "brown",
  breeches: "white",
};

/** Every owner's silks, in neutral colours. */
export const ownerSilks = { pattern: "sash", colors: ["cream", "brown", "grey"] };

/** The owner, who rides every owned dragon: a seeded name in the shared look and silks. */
export const createOwner = (stableSeed) => ({ ...createJockey(`owner:${stableSeed}`), look: { ...ownerLook }, silks: { ...ownerSilks, colors: [...ownerSilks.colors] } });

/** @returns {Rider} */
export const restoreOwner = (saved, stableSeed) =>
  restoreJockey({ ...saved, look: { ...ownerLook, ...saved?.look }, silks: saved?.silks ?? ownerSilks }, `owner:${stableSeed}`);

/** Renames the owner; a blank name keeps the current one. */
export function renameOwner(stable, name) {
  const trimmed = String(name ?? "").trim().slice(0, riderNameLength);
  if (trimmed) stable.owner = { ...stable.owner, name: trimmed };
  return stable.owner;
}

/** Dresses the owner in `silks`; an unknown pattern or too few known colours fall back to the seeded ones. */
export function dressOwner(stable, silks) {
  stable.owner = { ...stable.owner, silks: restoreSilks(silks, stable.owner.seed) };
  return stable.owner;
}

/** An owned dragon as a race participant, ridden by the owner and racing for the owner's stable, named after them. */
export const riddenByOwner = (stable, dragon) => ({ ...dragon, jockey: stable.owner, team: ownTeam, teamName: stable.owner.name });

/** Changes the owner's look; an unknown choice falls back to the seeded one. */
export function restyleOwner(stable, look) {
  stable.owner = { ...stable.owner, look: restoreRiderLook({ ...stable.owner.look, ...look }, stable.owner.seed) };
  return stable.owner;
}
