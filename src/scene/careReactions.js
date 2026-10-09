import { feed } from "./care/feed.js";
import { play } from "./care/play.js";
import { clean } from "./care/clean.js";
import { exercise } from "./care/exercise.js";
import { groom } from "./care/groom.js";

/**
 * How a dragon reacts to each care action (`careActions` ids) in the yard, and how the keeper's hand
 * gives it. Each reaction has its `length` in seconds and, `since` seconds in:
 * - `motion(since)`, layered on the dragon's resting pose, with `lift` its hop in body sizes
 * - `particles(out, since, { centre, size, color })`, drawn into billboards
 * - `hand(since)`, the keeper's hand miming the care before the camera, or null when out of view:
 *   `reach` (0 below the view, 1 raised), `at` [across, up] its wrist in the view (`careView`'s `place`),
 *   `roll` in radians, the `item` it holds (`keeperItems`) and the `keeperHandPose` fields
 * - optionally `objects(since, view)`, more scene racers `{ anatomy, pose, position, forward, bank }`
 *   such as something thrown, placed with the yard's `careView`
 */
export const careReactions = { feed, play, clean, exercise, groom };
