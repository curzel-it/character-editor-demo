/** Slots in a stable, shared by eggs, dragons of every age and wild dragons called home; an egg holds its slot from the moment it is laid. */
export const stableSlots = 6;

/** Wild dragons called home and still flying back; each already holds a slot. */
export const slotsBooked = (stable) => (stable.wild ?? []).filter((w) => w.wild?.homeAt != null).length;

export const slotsUsed = (stable) => stable.eggs.length + stable.dragons.length + slotsBooked(stable);

export const slotsFree = (stable) => Math.max(0, stableSlots - slotsUsed(stable));

/** How many of the wild dragons `ids` could be called home right now, given the free slots. */
export function callable(stable, ids) {
  const waiting = (stable.wild ?? []).filter((w) => ids.includes(w.id) && w.wild?.homeAt == null).length;
  return Math.min(waiting, slotsFree(stable));
}
