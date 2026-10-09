/** Shot vocabulary. `sided` shots sit on one side of the line of travel. */
export const shotTypes = {
  grid: { label: "Grid wide", sided: true, hue: 0.12 },
  chase: { label: "Chase", sided: false, hue: 0.58 },
  leader: { label: "Long lens", sided: true, hue: 0.33 },
  battle: { label: "Battle two-shot", sided: true, hue: 0.02 },
  gate: { label: "Gate cam", sided: true, hue: 0.8 },
  aerial: { label: "Aerial pack", sided: false, hue: 0.5 },
  comeback: { label: "Comeback", sided: true, hue: 0.9 },
  finish: { label: "Photo finish", sided: true, hue: 0.15 },
  trackside: { label: "Trackside", sided: true, hue: 0.68 },
  flyby: { label: "Fly-by", sided: true, hue: 0.44 },
  rider: { label: "Rider cam", sided: false, hue: 0.06 },
  landing: { label: "Touchdown", sided: true, hue: 0.25 },
};

export const cutRules = {
  minShot: 2,
  preferredShot: 4.5,
  maxShot: 8,
};

export { ordinal } from "../ordinal.js";
