# Racing

Races are simulated from a seed and the owner's inputs, recorded, and replayed by every viewer. `src/worldScale.js`
defines the scale: dragons average a 16 m wingspan (`creatureScale`), average top speed is 200 km/h
(`speedScale`), and the race world is Froude-scaled by `lengthScale` L = speedScale², so gravity-driven
flight keeps its tuned character. Speeds and times scale by √L, distances by L, accelerations not at all. Simulation, course
generation and direction are pure and deterministic: no wall clock, no `Math.random`, seeded by
`makeRng`. Positions use the world axes in [README.md](README.md). A course runs along +X from the start at x = 0.
For a forward vector `f`, the lateral vector is `[-f.z, 0, f.x]` (+Z when `f` is +X). Code calls it
`left`; corridor widths, lateral offsets and positive bank are all measured towards it.

## Course — `src/course/createCourse.js`

`createCourse(seed, { type, share, length })` returns plain data. `type` is `valley` (the default) or `canyon`, and is
recorded as `course.type`. `share` (default 1) shortens the seeded length to that share, with gates
cut in proportion (at least 6) so their spacing holds; `length` sets it outright in metres. `placeGates`
keeps every gate within a climb (0.18) or dive (0.3) of its neighbours, gates fixed by a landmark aside.
`fieldCourse(field)` in `src/fieldCourse.js` builds a race field's course with its league's
`courseShare` (`src/stable/leagues.js`) when every racer is one age, the longest league's when ages mix:

```
{
  seed, length,                        // metres along the centreline
  path: [{ s, position, forward, halfWidth, floor, ceiling }],   // every 10·L m; floor/ceiling are absolute Y
  gates: [{ index, s, position, forward, radius }],               // ordered; the last gate is the finish
  start: { grid: [{ position, forward }] },                       // 12 slots
  terrain: { origin: [x, z], cellSize, columns, rows, heights },  // row-major Y values, rows along Z
  thermals: [{ position, radius, lift }],                         // lift in m/s upward
  type, signature, features: [{ type, ... }]   // canyon: slot, arch, spires; valley: castle, spurs,
                                               // gorge, lake, col, river
}
```

A thermal is a vertical column; its `position` is at mid-corridor height. Castles are built at real
scale (towers 20–30 m, keep 35–40 m); the corridor excludes their volume, never the heightfield.
`environmentOf(course)` in `src/palette.js` gives the course's colour set. `halfWidth` is measured
along the lateral vector.

`path` is the flyable corridor the simulation respects. Visual meshes (canyon walls, rocks, gates,
sky) are derived from course data by the scene renderer and do not affect the simulation.

## Race recording — `src/race/raceSim.js`, `src/race/simulateRace.js`, `src/race/sampleRace.js`

`createRaceSim({ seed, course, roster, hz = recordingHz, pilots = {} })` is the race advanced one
1/`simulationHz` s `step()` at a time; its `recording` grows a frame every 1/`hz` s and is complete
(events sorted, `results` filled) once `done`. `pilots` maps a racer id to a function that replaces
the racer AI's `decide(racer, ctx)` and returns `{ uWish, yWish, events }`.
`simulateRace({ seed, course, roster, ride })` steps it to the end; a pilot's `ctx` carries the race
time `t`. `ride` (`{ racer, log }`, null by default) is the owner's part in a league race,
replayed through `ridePilots(ride)`.

`createOwnerPilot({ log })` in `src/race/ownerPilot.js` flies the owner's racer: on
Autopilot it is the racer AI's `decide`, and the racer AI's breath attacks go on (the pilot function
carries `autopilot`, which `createBreathAttacks` reads), so a race left on Autopilot is exactly the
race without a pilot. `reins(on)` takes the reins, flying the commands through a fresh
`createRiderPilot`, or hands back; `give(command)` passes a `RiderCommand` while riding. Every input
goes into `log` stamped with the next simulation step: `[step, "r", 1|0]` (reins), `[step, "s", x, y]`
(the stick, in steps of 0.05, at most one every 4 steps so a long ridden race stays small in the save) and `[step, "f"]`
(breath); `inputCommand(entry)` reads one back. A pilot made with an earlier log replays it step for
step, so the seed and the log are the race.

`createLiveRace({ seed, course, roster, ride, step })` in `src/race/liveRace.js` flies a race live:
the sim with the owner's pilot (appending to `ride.log` in place) and, on Autopilot, a forked sim
that replays the log and runs up to 5 s ahead assuming Autopilot, for the director. `advance(t,
budget)` steps the live sim a frame past race time `t` and the fork ahead, spending at most `budget`
ms on the fork, and rebuilds the director from the fork whenever `t` passes the last cut it planned
for good (`buildTimeline` is causal within its 3 s lookahead). `recording` and `director` are the
fork's on Autopilot once the director is ready, else the live sim's and null. The fork's pilot reads
`ride.log` itself: taking the reins restarts the fork only if it ran past the live sim, and while
riding it replays from the seed a little a frame, never past the live sim's step (the last whose
inputs are final), so on the hand-back it only has to run ahead again; `catchingUp` is how far it
has come (0 to 1) while the director waits for it, else null. A long race replays at about 2 ms of
desktop CPU per race second, so a hand-back right after taking the reins late in a race still waits;
`complete()` hands back and flies the rest at once (Skip). A race resumed at `step` replays to it
and opens on Autopilot, a hand-back logged at the next step if the owner was riding.
`createRiderPilot({ script, from })` in `src/race/riderPilot.js` returns
`{ pilot, give, state, log }`: the owner flies the dragon directly; `from` is the race time of the
step before the first it flies, for a rider taking over mid-race. Left alone it flies the racer AI's
`decide` line, so a ridden dragon with no input matches Autopilot except for the AI's breath
attacks, which only a rider's `breath` command sets off. The dragon always flies at the pace its
stats allow; the rider's edge is the line and when to breathe. `give` hands it a command:
`{ type: "stick", x, y }` (-1..1 each: across the course, positive towards `left`, and climb or
dive) bends the AI's heading and climb at once towards the steepest the dragon can fly (30° across
the course, its dive and climb limits), by the square of the stick so small moves stay gentle;
neutral is the AI's line again. `{ type: "breath" }` breathes once the breath has recharged
(`racer.breathReady`). Commands are stamped with the race time into `log`; passing a log as `script`
replays the flight exactly. A daze leaves the dragon flying on its own until it clears. The AI lands the racer after the finish. Shared gate and thermal geometry is
`raceGeometry(course)` in `src/race/raceGeometry.js`.

`simulateRace({ seed, course, roster })` takes `roster: [{ id, name, subject, genome, strength?,
harness?, age? }]`. `harness` is a look-only flag carried through to the recording. `strength` is
the dragon's stars (1 to 5, 1 when omitted; `raceRoster` gives tool fields 3): `deriveStats(subject,
genome, age, strength)` turns the build's shares (`buildOf` in `src/dragonBuild.js`) times the stars
into flight stats (`flightStats`): `topSpeed` and `climb` (m/s), `acceleration` and `handling`
(m/s²), `weight` (relative) and `breath` (power) with `recharge` (s). `age` scales them (speed classes
in even steps: kids fly and accelerate at 0.82 of an adult, teens at 0.9), the flap rate and the
standing height `standHeight(genome, age)`; `raceRoster` omits it for adults. Every racer's form is
rolled from the race's seed (`raceForm` in `src/race/racerTraits.js`): `perfect` and `off` one race
in ten each, lifting or trimming top speed and acceleration by 0.5% (`applyForm`), `usual` otherwise;
a roster entry's `form` replaces the roll (the owner's dragon on the game's first day, `raceDayForm`).
A roster entry's `edge` lifts its top speed, acceleration, climb and handling by that share (`applyEdge`):
league races give the owner's dragon `edgeOf(season, dragon)` (`ownerEdge` in `src/stable/leagueRace.js`),
5% in bronze, 3% in silver and 2% in gold, plus 3.5% in bronze for every star it is short of the
division's strongest rivals.
Riders never race: every racer flies on its dragon's stats alone, and a field participant's `jockey`
(`{ seed, name, silks: { pattern, colors } }`, `createJockey(seed)` in `src/jockey/createJockey.js`)
only dresses it in the scene.

There is no stamina. A racer flies at its top speed unless something slows it: a missed gate (it
aims 25% below top speed for 2.5 s), a breath hit, a bump, a turn tighter than its handling (lateral
load over `handling` bleeds speed) and the takeoff. `speedChange` (`src/race/flightModel.js`) brings it
back at its acceleration, easing off near the target, and bleeds speed over it (a dive, a slingshot)
slower for heavier racers. Slipstream raises the speed a chaser aims for by up to 8% and the gain
lingers 3 s after it pulls out, the slingshot past; a clean pass within 40% of a gate's radius from
its centre gives a 5% burst the same way. Two racers that touch `bump`: they lose 3.5 m/s between them,
split by the square of their weights so the lighter loses more, all of it to one being shoved by a
breath. The racer AI (`decide` in `src/race/pilot.js`) steers from the racer's build and a seeded lane:
high handling cuts tighter inside lines, high top speed takes the wide, smooth line, heavy racers
pass close and light ones go wide round a rival; it follows a slower rival's line for the
slipstream and detours for thermals in reach. Wing `effort` (`wingEffort`) only shows how hard the
wings work: beating hard while accelerating or climbing, gliding in a dive.

Roster order is the starting grid: `roster[i]` starts on the ground below `course.start.grid[i]`, so index 0 is pole.
Every slot stands on dry ground or mud, so no dragon of any age starts in water: where the river
crosses the grid, `startGrid` (`src/course/startGrid.js`) slides the whole grid sideways by the
fewest whole reference metres that clear it, keeping its shape so no slot gains on another.
It returns:

```
{
  seed, hz, duration,
  roster: [{ id, name, subject, genome, strength, stats, form }],
  frames: [{ t, racers: [{ id, position, forward, bank, flap, speed, effort,
                           progress, gate, place, finished }] }],
  events: [{ t, type, racer, other?, place?, detail? }],
  results: [{ id, place, time }]
}
```

A racer's `position` is its anatomy's root bone (the torso). `forward` is a unit vector; `bank` is
roll in radians, positive tilting the body's up towards the lateral vector, so racers lean into turns. `flap` is the
wingbeat phase in [0, 1) and is passed to the subject's `pose(anatomy, flap)`. `progress` is metres
along the course; `gate` is the index of the next gate. `place` starts at 1. Event types include
`launch`, `airborne`, `overtake`, `gate`, `miss`, `bump`, `thermal`, `dnf`, `finish`, `land`, `breath` and `hit`. Event times and
places agree with the frames. Racers start standing on the ground (`src/race/takeoff.js`): after a seeded
reaction time each jumps off with a push set by leg shape, leg length and weight (`launchPush`), the
`launch` event carrying the same `surface`, `position`, `forward`, `speed` and `heft` as a `land`, then beats its
wings flat out until it flies at `minSpeed` inside the corridor band (`airborne`, the first one flagged
`first`), and climbs flat out to its grid slot's altitude. Frame racers carry `takeoff` until airborne and `grounded` before the jump; the race view
stands them on the grid, crouches them just before the jump (`launchFromEvents`) and throws up debris
from `launch` events as from touchdowns. A `breath` event (`src/race/breathAttacks.js`) is the racer AI breathing its
`element` at the rival `other`, `ahead` or alongside to its `left` or `right`: as soon as its breath
is ready (`racer.breathReady`, seeded at the start, then `breathLength` plus its `recharge` after each
breath) and a rival ahead of it is in reach, after a short seeded hesitation, preferring rivals it is
strong against and sparing the ones that resist it. Kids never breathe (`canBreathe(age)` in
`src/dragonAge.js`): the AI skips them and a rider's `breath` command does nothing. Elements form one
cycle (`breathElements` in `src/breath/breathElements.js`: fire, nature, earth, storm, water), each
beating the next; `matchup(from, to)` is 2 super effective, 0.5 resisted (an element resists itself
and the one before it) and 1 otherwise. While the plume pours, the first time it touches a rival it
lands a hit (`landHit` in `src/race/breathHits.js`), scaled by the breather's `breath` times the
matchup and by the element's `lean`: a slowdown (the rival aims up to `cut` below top speed for a
moment, the `slow` status), a knockback (shoved back and off its line over half a second, less by the
square of its weight) and a daze (stick and line taken away for under 0.5 s, shorter for higher
handling, the `daze` status, twitching and sinking). Nature's knockback and water's slowdown are
smaller and last longer (`linger`). When the breath is spent each rival it hit gets a `hit` event
stamped at the hit, with the breather as `other`, `element`, `matchup`, `slow`, `knock`, `daze`,
`until` and `amount` (how hard overall, 0..1). Frame racers under a status carry
`effects: [{ id, until }]`; the field is absent otherwise. The target flinches (`hitFromEvents`), the
broadcast calls the hit over it ("Super effective!" big for ×2, "Resisted" small for ×0.5, "Hit!"
otherwise), and while a status lasts the dragon sheds spray or crackles and the broadcast badges it
(`effectBadges`). In a league race the game's broadcast calls only the hits on the owner's dragon and
on rivals it hit, and badges only the owner's dragon. The race view plays it
(`breathFromEvents`), turning the neck and a little of the body to aim at the rival. A ridden
dragon breathes on the rider's `breath` command instead (`breathTarget` picks the rival in reach);
with none in reach `other` is null and the breath goes straight ahead. The last gate is the finish line and cannot be missed. Finished racers
land on the run-out beyond it (`src/race/landing.js`): each glides to its own lane, flares and
touches down, then stands. Only an adult sets down in water, and only where it is very shallow
(`footing(spot, stand, age)`: at most 0.3 of its standing height deep, so it wades and never swims);
kids and teens land on dry ground or mud, and the skid after touchdown stops at the edge of water
the dragon may not stand in. Frame racers carry `landing` (0 while racing, rising to 1 at touchdown)
and `grounded`. The `land` event adds `surface` (`water`, `mud`, `sand` or `dirt`, from
`surfaceAt(course, x, z)` in `src/course/surfaceAt.js`), the ground `position`, a flat `forward`,
`speed` and `heft` (the age's `heft`: 1 for adults, 0.75 for teens, 0.45 for kids). The recording ends once every finisher has stood for `landingSettle` seconds; DNF racers
fly on and never land. `results[].time` is null for a DNF. Genes and stars affect results only
through `stats`, derived by the race module and recorded in the roster in real units. Wingbeat rate depends on effort and real wingspan.
`scaleCourse(course, k)` scales any course geometrically (thermal lift by √k); `tools/race/batch.mjs
--scale-course` uses it to compare against the pre-scale baseline.

`sampleRace(recording, t)` returns `{ t, racers }` interpolated between frames, wrapping `flap`. Before
the start (t < 0) the racers hold their first frame, standing on the grid.
