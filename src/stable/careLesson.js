/** Whether the owner has already been walked through the stable: care, reminders and saving. */
export const careTaught = (stable) => stable.careTaught === true;

/** Remembers that the owner has been walked through the stable. */
export function markCareTaught(stable) {
  stable.careTaught = true;
}
