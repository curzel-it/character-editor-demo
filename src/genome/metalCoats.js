/**
 * The very rare metallic coats, one per `metal` gene value: a metal for the body (scales and underside)
 * and one for the wings, overriding the colour genes. `bonus` adds stat levels: gold carries top speed,
 * silver acceleration and handling, each metal half its share from the body and half from the wings.
 * Between them the four metal coats turn up once in a thousand dragons.
 */
export const metalCoats = [
  { id: "none", label: "None", weight: 3996 },
  { id: "gold", label: "Gold", body: "gold", wings: "gold", weight: 1 },
  { id: "silver", label: "Silver", body: "silver", wings: "silver", weight: 1 },
  { id: "goldSilver", label: "Gold and silver", body: "gold", wings: "silver", weight: 1 },
  { id: "silverGold", label: "Silver and gold", body: "silver", wings: "gold", weight: 1 },
];

const metalBonus = {
  gold: { topSpeed: 1.2 },
  silver: { acceleration: 0.9, handling: 0.9 },
};

for (const coat of metalCoats) {
  if (!coat.body) continue;
  coat.bonus = {};
  for (const metal of [coat.body, coat.wings])
    for (const [key, level] of Object.entries(metalBonus[metal])) coat.bonus[key] = (coat.bonus[key] ?? 0) + level / 2;
}

/** The metal coat of a `metal` gene value, or null for an ordinary coat. */
export function metalCoatOf(value) {
  const coat = metalCoats[Math.max(0, Math.min(metalCoats.length - 1, Math.floor(value) || 0))];
  return coat.body ? coat : null;
}
