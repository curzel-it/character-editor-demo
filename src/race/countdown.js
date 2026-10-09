/** Broadcast seconds before the start (t = 0) spent on the grid; the recording begins at Go. */
export const LEAD_IN = 4.5;
const GO_HOLD = 0.9;

const steps = [
  { id: "ready", from: -LEAD_IN, to: -3, label: "On the grid" },
  { id: "3", from: -3, to: -2, label: "3" },
  { id: "2", from: -2, to: -1, label: "2" },
  { id: "1", from: -1, to: 0, label: "1" },
  { id: "go", from: 0, to: GO_HOLD, label: "Go!" },
];

/**
 * The countdown at broadcast time `t`: its step and how far through it (0..1), or null outside
 * the lead-in and the Go call.
 * @returns {{ id: string, label: string, progress: number } | null}
 */
export function countdownAt(t) {
  const step = steps.find((s) => t >= s.from && t < s.to);
  return step ? { id: step.id, label: step.label, progress: (t - step.from) / (step.to - step.from) } : null;
}
