# Broadcast

## Cameras

`riderEye(anatomy)` in `src/jockey/riderEye.js` is the jockey's eye
point in the racer's body frame, and `createLiveRiderCam({ eye })` in `src/camera/liveRiderCam.js`
frames a live racer from it. `createChaseCam({ span })` in `src/camera/chaseCam.js` frames one from behind and above
by multiples of its wingspan, trailing sideways and vertical moves. A shot's optional `near` overrides the renderer's near plane.

## Direction — `src/camera/createDirector.js`

`createDirector(recording, course, options?)` returns `{ shotAt(t) }`, which yields
`{ eye, target, up, fov, shot, subject, other, reason }`. `fov` is vertical, in radians. `subject`
and `other` (the second racer in a two-shot) are racer ids or null, `reason` a short human-readable caption for the cut. Direction is deterministic
for a recording and may look ahead at most 3 seconds, so cuts anticipate action without spoilers.
The director also exposes `timeline`, its planned shot list. Shots add `cut`, `speed`, `energy`,
`shake` and `roll`; `applyCameraFx(shot, t, { motion })` in `src/camera/cameraFx.js` applies shake, roll
and the speed FOV kick, reduced under `prefers-reduced-motion`. Shot types include `trackside`,
`flyby` (both with an `anchor`), `rider` (an onboard camera behind and above the subject's saddle,
framed by `riderCam` in `src/camera/riderCam.js`; the saddle offset scales with the racer's age
`size`, the lens distance does not) and `landing`, a camera standing on the ground ahead of a
`land` event (`anchor` carries its position, forward, time and surface); while the winner is still coming in to land, nobody else's touchdown is offered. Shots also add `thud`,
ground shake from touchdowns near a camera standing on the ground, which `applyCameraFx` adds as a
sharp jolt. `pace(t)` is the broadcast playback rate: 1, dipping to slow motion around the touchdown
a `landing` shot is waiting for. `riderShotAt(id, t)` frames the onboard shot of any racer outside the edit.
`shotAt` also accepts broadcast time before the start, down to `-LEAD_IN`: the opening `grid` shot
(`gridShot` in `src/camera/gridShot.js`) stands on the ground, about a dragon's height up, and creeps
forward through the lead-in to settle at the start; after Go it stays put and turns and tilts up after
the field, shaken by the launches. `shotAt(t, { aspect, focus })` takes the canvas width over height and the racer ids to frame, the owner's
(`raceShot` passes both on; without them it frames the two front-row racers on the camera's side): at least
square, it stands behind and beside that group, looking forward along the course, and frames it, carrying `span` for canvases narrower than 16:9; upright, it stands behind and
beside the group's outermost dragon and follows it. The `race.html` tool takes `focus=id,id`. Name tags sit 5 reference units above each racer, scaled by age.

## Playback

Both race screens replay a field through the same pieces: `buildRace(module, field)` in
`src/race/buildRace.js` (and `buildRace(module, field, ride)` with the owner's ride) returns `{ course, recording, director, entries, overviews, landings }`
(`raceKey(field, ride)` tells whether two fields replay the same race); `raceShot(race, t, { camera, rider,
free, follow, fixed, motion })` in `src/camera/raceShot.js` picks the director, rider or free camera and
the previous frame for motion blur; `createRaceView(module, canvas, { adaptive }).draw(race, t, { shot, previous,
style, blur, reducedMotion })` in `src/scene/raceView.js` poses, grounds and renders the racers and
returns `{ sample, viewProjection }` (`projectPoint` places HTML tags over them); with `adaptive`, used by
the game's broadcast screen, `createRenderScale` in `src/scene/renderScale.js` lowers the
render resolution to as little as 60% while frames run under 30 fps and raises it again after a calm spell. Every 3D
stage renders at `renderDensity()` (`src/renderDensity.js`) canvas pixels per CSS pixel: 1.5 on touch screens of 3× density
or more, 1 elsewhere. `createFrameLoop`
in `src/scene/frameLoop.js` runs the animation frames. `commentaryAt(recording, t, { owned, place })`
in `src/race/commentary.js` picks the event the commentator calls (the grid call before the start, the
start call after it) as data, and `commentaryLine(event, names)` in `src/ui/commentaryLine.js` words it
in the current language.

Broadcast time runs from `-LEAD_IN` (`src/race/countdown.js`, 4.5 s) to the recording's duration;
t = 0 is the start, so the lead-in is presentation only and never touches the simulation.
`countdownAt(t)` gives the step (`ready`, `3`, `2`, `1`, `go`, the last held 0.9 s after the start)
and `createCountdown()` in `src/ui/countdownOverlay.js` draws it over either race screen
(`styles/ui/countdown.css`), driven by broadcast time so pause, speed and seeking apply. Both screens
start, restart and replay from `-LEAD_IN`; `race.html?t=…` still starts where it says.
Its `place(tag, x, above, below)` keeps racers' name tags off the countdown (under the racer,
or hidden). Before the start the boards and position badges show no gaps.

The game's broadcast screen keeps the chrome to what a spectator follows: the leaderboard lists the
top three and the owner's dragon without gaps (an exhibition's full finishing order keeps its times),
the ribbon carries the title and the Autopilot or Riding chip (the season, course and race clock only
in the exhibition), the position badge shows the place, a bar of the course flown and the gap to the
next racer only while it is under a second, and the commentator's line fades five seconds after it
last changed.

A race on air (`#/live/<league>`) is drawn from `createLiveRace` instead: the race object's
`recording` and `director` follow the live race, `debrisOf(recording)` refreshes the launches and
touchdowns as they happen, and `raceEntries(module, field, roster)` tacks the racers. While the owner
rides, or while the fork catches up after a hand-back, the camera is the chase or live rider camera
(`createRaceReins` in `src/ui/raceReins.js`, which also holds the controls, gauges and gate pointer);
a wait past a quarter of a second shows "Back to the broadcast…" with a bar of the fork's
`catchingUp` above the chased dragon (`createCatchUpCard` in `src/ui/catchUpCard.js`).
The owner's first-race onboarding is a coach-mark tour (`createReinsTour` in `src/ui/reinsTour.js`):
each step dims the screen, rings the real control it explains with a pulse and says what it does in
a card beside it, and the race holds while a step is up. Once `reinsInviteDue` and the director are
ready, on the grid before the countdown, it explains Autopilot on the mode chip, then Skip on the chequered flag (the rider flies the rest at once and the results follow), then points at Take the reins (Keep watching stays on
Autopilot); the first time the owner takes the reins it walks the stick, Breath (for a dragon old enough),
the gauges and the Autopilot button. Every step can be skipped (Escape too), and each tour marks the
stable (`markReinsInvited`, `markReinsTaught`) as it opens, so leaving mid-tour never repeats it. Broadcast time cannot run past the live recording, and the race is
recorded with `finishLeagueRace` when it ends or is skipped. Leaving it before then, or hiding the
app, leaves it to fly on by itself (`leaveLiveRace`), and coming back rejoins it where it has flown to
(`rejoinLiveRace`), unless it already finished and While you were away says so.

The game's broadcast plays a league race (`#/broadcast/…`, replayed with its `ride`, then its results) or the exhibition field
(`#/dev/field/race`, holding on the finish). The exhibition field is `loadField(module)` /
`saveField(field)` in `src/raceField.js`, kept apart from the stable; both UIs edit it through
`src/fieldEdits.js` (`addParticipant`, `removeParticipant`, `moveParticipant`, `shuffleGrid`,
`fieldAge`, `setFieldAge`, `reseedParticipant`, `withSilkColor`), which keeps the field within
`fieldLimits`. A one-age exhibition field races its league's course length; a mixed field the full length.
