/** Whether the owner has already been shown the riding controls, the first time they took the reins. */
export const reinsTaught = (stable) => stable.reinsTaught === true;

/** Remembers that the owner has seen the riding controls. */
export function markReinsTaught(stable) {
  stable.reinsTaught = true;
}

/** Whether the stable hand has already invited the owner to take the reins, or they found the reins on their own. */
export const reinsInvited = (stable) => stable.reinsInvited === true || reinsTaught(stable);

/** Remembers that the owner has been invited to take the reins. */
export function markReinsInvited(stable) {
  stable.reinsInvited = true;
}

/** Whether a race on air, with the owner on Autopilot, should explain Autopilot and invite them to take the reins: their first, on the grid. */
export const reinsInviteDue = (stable, riding) => !riding && !reinsInvited(stable);
