const GOOD = 0.1,
  SLACK = 0.28,
  SHARE = 0.4,
  GRACE = 0.15;

/**
 * The beat of a workout set: after `count` beats of count-in from `start`, every beat wants a tap.
 * A tap within `GOOD` seconds of the beat is "good", one further off but inside the beat's window is
 * "late" or "early"; each counts a rep and the beat after it comes `quicken` times sooner, down to
 * `fastest` seconds. A tap outside any window, or a beat let pass, is a "miss" and ends the set; a
 * second tap just after a counted one is let go.
 * @param {{ start: number, period: number, count?: number, quicken?: number, fastest?: number }} options
 */
export function createBeat({ start, period, count = 3, quicken = 0.97, fastest = 0.5 }) {
  let due = start + count * period,
    gap = period,
    reps = 0,
    tapAt = -Infinity,
    missAt = null;
  const slack = () => Math.min(SLACK, SHARE * gap);

  function miss(time) {
    missAt = time;
    return "miss";
  }

  return {
    get reps() {
      return reps;
    },
    /** When the next beat falls, in seconds. */
    get due() {
      return due;
    },
    /** Seconds from the last beat to the next. */
    get period() {
      return gap;
    },
    /** When the last rep was tapped, -Infinity before the first. */
    get tapAt() {
      return tapAt;
    },
    /** When the set ended in a miss, or null while it goes on. */
    get missAt() {
      return missAt;
    },
    /** The beats of count-in still to come before `time`'s next beat, 0 once the set is under way. */
    countIn(time) {
      return reps === 0 ? Math.max(0, Math.ceil((due - time) / gap - 1e-9) - 1) : 0;
    },
    /** Judges a tap at `time`: "good", "late", "early", "miss" or null when it is let go. */
    tap(time) {
      if (missAt !== null || time - tapAt < GRACE) return null;
      const off = time - due;
      if (reps === 0 && off < -slack()) return null;
      if (Math.abs(off) > slack()) return miss(time);
      reps++;
      tapAt = time;
      gap = Math.max(fastest, gap * quicken);
      due += gap;
      return Math.abs(off) <= GOOD ? "good" : off > 0 ? "late" : "early";
    },
    /** Moves the set to `time`: "miss" once a beat has gone by untapped, else null. */
    update(time) {
      return missAt === null && time > due + slack() ? miss(due + slack()) : null;
    },
  };
}
