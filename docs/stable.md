# Stable

`src/stable/` holds the game rules as pure functions over one plain, serialisable stable:

```
{
  seed, welcomed: boolean,                     // true once the welcome's kid is adopted
  owner: { seed, name, silks: { pattern, colors }, look: { build, skin, ears, eyes, hair, facialHair, hairColor, marks, hat, goggles, scarf, gloves, boots, breeches } },   // the rider of every owned dragon
  clock: { game, real, speed },                // game ms, last wall-clock ms, dev speed
  eggs: [{ id, seed, laidAt, incubation, incubationTime, warms, warmedAt, stars, parents: null | [{ id, name, genome, generation, strength, parents }] }],
  dragons: [{ id, name, seed, genome, harness, age, growth, hatchedAt,
              care: { fullness, happiness, cleanliness, exercise, affection }, bond, strength,
              starsCelebrated, fatigue, injury: null | { id, label, until },
              slumberUntil?, seenAt?, parents: null | [{ id, name, genome, generation, parents: null | [{ id, name }] }], from, generation,
              record: { starts, wins, podiums }, history: [{ league, division, season, race, place, of, at }] }],
  wild: [{ ...dragon, wild: { since, homeAt: null | number } }],   // adults sent off the roster
  leagues: { kids | teens | adults: { league, number, division, seed, rivals, races: [{ index, division, at, field, ride?, results: [{ id, name, place, time, owned }] }],
             live: null | { dragon, at, field, ride: { racer, log }, step, left?, end?: null | { step, results } }, end: null | SeasonEnd } },
  reinsInvited?: boolean,                      // true once the first race invited the owner to take the reins
  reinsTaught?: boolean,                       // true once the riding controls were shown
  careTaught?: boolean,                        // true once the first stable visit walked care, reminders and saving
  raceHint?: "due" | "done",                   // due from the first care until a race is entered or the hint dismissed
  festeAt?: number,                            // real ms of the last greeting in the yard
  seasons: [SeasonEnd],                        // every finished season, newest first
  trophies: [{ league, season, division, id, name, at }], rituals?,
  highscores: { [minigame]: number }           // the stable's best score at each minigame
}
```

Owned dragons and rivals are race participants, so `raceRoster(field)` takes them unchanged. Times
(`laidAt`, `until`, `slumberUntil`, `since`, `homeAt`, `at`, `left`) are game ms. `advanceStable(stable, dt, now)` moves it on and
returns the `raced` events of `finishUnwatchedRaces` (below), then `{ type: "arrived" | "ready" | "evolve" | "healed" | "rested" | "woke", id, age? }` events (`arrived`: a
wild dragon called home landed, first in the step; `evolve`: a dragon
that finished its stage and waits, `readyToEvolve(dragon)`, until `evolve(stable, dragon)` moves it into
`age`; `rested`: a tired dragon fit to race again; `woke`: a dragon whose `slumberUntil` passed in the step); `summariseAway(stable, events, now = stable.clock.game)` in `src/stable/awaySummary.js` turns the
events of an absence into the While you were away entries (`raced`, `ready`, `care`, `evolve`, `arrived`, `woke`, `healed`,
`rested`, most urgent first, dropping what no longer holds: hatched eggs, dragons back in the wild,
asleep or hurt again, races of a season that moved on). `entryBlock(stable, dragon, league, now)` says why a dragon cannot race (wrong age,
on air, unfit, slumbering). `onAirBlock(stable, id)` in `src/stable/onAir.js` says "On air" while the
dragon flies a league race that has not finished, in any league; until then it cannot enter another
race, evolve, go to the wild or join a ritual (`evolve`, `wildBlock` and `ritualBlock` refuse it). League races run live: `startLeagueRace(stable, league, dragonId, now)` puts the
next race on air as `season.live` with the owner riding that dragon (the field fixed at the start,
and an empty input log) and returns it, or null without a dragon
fit to enter, after the last race, or while a race of the league is already on air, so no race runs
without one of the owner's dragons and none starts twice. The race screen flies it from the same
seeds and course (`fieldCourse`, at the league's `courseShare`: kids 0.5, teens 0.72, adults 1),
keeping `live.step` and the log up to date (`liveRaceOf(stable, league)`). A race left before its finish
(the screen left, the app hidden or closed) flies on by itself on Autopilot in game time, in
`src/stable/unwatchedRace.js`: `leaveLiveRace(stable, league, step, now)` hands the reins back and keeps
when it was left (`live.left`); `settleUnwatched(live, recording)` keeps its finish (`live.end`: the
finishing step and results of the race replayed from its seed and log, which `createUnwatchedRaces` in
`src/ui/unwatchedRaces.js` works out in the background a few ms at a time); `liveStep(live, now)` is
the step it has flown to and `unwatchedFinish(live)` the game time it finishes. `finishUnwatchedRaces(stable, now)`
records each one past its finish, at that time, with the same results watching it on Autopilot to the end
would give, and returns `{ type: "raced", id, league, season, race, left }` events. `rejoinLiveRace(stable, league, now)`
takes the owner back to it where it has flown to, watched again.
`finishLeagueRace(stable, league, results, now)` records it with the finished recording's results,
keeps the `ride` on the race when the owner took the reins (so Watch again replays the same) and
returns `{ race, field, injuries, seasonEnd }` (`seasonEnd` is null but after the last race).
`runLeagueRace(stable, league, dragonId, now)` does all three at once on Autopilot. A field (`ownerField(stable,
league, dragon)`, `raceField(season, entrant)` with the dragon dressed by `riddenByOwner`) is every
one of the season's `rivalCount` (7) rivals plus the one owned entrant, on a seeded grid,
so everyone starts all `seasonLength` (16) races. A race adds 0.5 fatigue, a dragon above
`fatigueLimit` (0.1) is tired and rest takes 1.8 an hour off, so a race needs about 13 minutes of rest
from fresh and 17 when entered the moment it was fit again; the owner's first ever race (no season
closed, no race recorded) adds no fatigue, so that dragon does not sleep after it; an injury (2% plus 10% of the fatigue at
the start) lasts 1 to 3 hours.

`src/stable/owner.js` holds the owner: `createOwner(stableSeed)` (a seeded name in `ownerLook` and `ownerSilks`, neutral and the
same for every owner), `restoreOwner`, `renameOwner(stable, name)`, `restyleOwner(stable, look)` and `dressOwner(stable, silks)`.
The rider maker (`src/ui/riderMaker.js`, under More > Profile with `?dev=true` only) splits the look and silks into Body, Face, Gear
and Silks tabs of pickers and colour rows over a live preview, which closes in bareheaded on the face while the Face tab is open.
The rider's name and silks never change a race. `bond` (0..1) is the dragon's bond with the owner; it
never changes a race.

Seasons are ranked. `src/stable/divisions.js` holds each league's `divisions` (Bronze, Silver, Gold),
`zoneOf(division, rank, size)` (`promote` for the top `promotionPlaces` (2) but in Gold, `relegate` for the
bottom `relegationPlaces` (2) but in Bronze, else null) and `divisionAfter(division, zone)`. A new stable
starts every league in Bronze. `src/stable/teams.js` holds the rival stables (`teams`); `divisionTeams(stableSeed,
league, division, count)` deals each league its own seeded draw of them across the divisions, so a
stable sits in one division of a league for good but may race in every league.
`createSeason(genes, league, number, stableSeed, division)` seeds one dragon for each of the
division's seven rival stables at the league's age, ridden by that stable's own rider and with seeded stars in the league's and division's `rivalStars`
(kids Bronze 1–1.4, Silver 1.3–1.9, Gold 1.8–2.5; teens 1.1–1.7, 1.6–2.3, 2.2–3; adults 1.5–2.6, 2.5–3.7,
3.6–5), so the owner's division sets the rivals' strength. Points are
10-8-6-5-4-3-2-1 and go to the dragon's stable (`team`; the owner's is `ownTeam`, named after the
owner), so every dragon the owner races adds to one row; `standings(season)` ranks stables by points,
then wins, then the best finish, each row keeping its scoring `dragons` and its `lead` (top scorer),
whose look the ceremony stages and who keeps the owner's medal and trophy, and
`zonedStandings(season)` in `src/stable/seasonEnd.js` adds each row's `rank` and `zone`.

After the last race `closeSeason(stable, league, now)` (called by `runLeagueRace`) sets `season.end`,
adds it to `stable.seasons`, pushes its trophy and lays the prize egg (`awardPrizeEgg` in
`src/stable/prizeEgg.js`): an owned dragon on the podium wins an egg of a fresh seeded genome, with no
parents, hatching at `prizeStars(division, place)` (Bronze 1, 1.25, 1.5 for third, second and first;
Silver 1.5, 1.75, 2; Gold 2, 2.25, 2.5). In a full stable the oldest dragon not on air
(`oldestDragon`, earliest `hatchedAt`, whatever its age) leaves for the wild (`goWild`) to make room,
and can be called home as usual. `seasonEnd(season, now)` is pure and returns:

```
SeasonEnd = {
  league, season, division, at,
  standings: [{ id, name, points, wins, starts, best, owned, rank, zone }],   // final, best first
  podium: [row, row, row],
  champion: row,                     // the division champion; in Gold the league champion
  owner: row | null,                 // the owner's best-placed dragon, null when none started
  outcome: "promoted" | "relegated" | "stayed",
  next,                              // the owner's division next season
  trophy: null | { league, season, division, id, name, at },   // an owned Gold champion only
  prize: null | { stars, egg, left },   // the owner's podium prize egg: its stars, its id once laid, the dragon that left for it
}
```

The podium rows, the champion and the owner's row also carry `look: { genome, age, harness, jockey }`
(or null), how the dragon last raced in the season, ridden by its rider in its silks, so the ceremony
can stage them once the season's rivals are gone. The awards ceremony reads the end with
`findSeasonEnd(stable, league, number)`: `stable.leagues[league].end` while the finished season waits,
then `stable.seasons` once `startNextSeason` replaced it with season `number + 1` in `end.next`.
`src/stable/honours.js` derives the owner's honours: `medalsOf(stable, id?)` gives a medal (`gold`,
`silver`, `bronze` by `medalOf(place)`, ids for its colour only: the UI names a medal by its place,
never by a metal, which names the divisions) to the lead dragon of the owner's stable on a finished
season's podium, in any division, newest first; `trophiesOf(stable, id?)` reads `stable.trophies`; `honoursOf(stable, id)`
returns a dragon's `{ trophies, medals, best, count }`, `best` being `trophy` or its best medal. `inheritGenome(genes, parents, seed)` in
`src/genome/inheritGenome.js` takes two or more parent genomes and returns `{ genome, from }`: choice
genes (parts, the element and the three colours) come whole from one parent picked evenly, or mutate
into a variant no parent shows with `mutationChance(shown, parents)`, 5% when the parents agree plus
15% × (distinct variants − 1) / (parents − 1), so 20% when they all differ; a `rare` gene (`metal`) instead comes from
one parent, or turns up anew at its own weighted odds whatever the parents show; shape genes blend across all of them
with random weights plus a little noise, and `from` maps each gene to a parent index (for
a shape gene, the heaviest weight) or null for a mutation. An egg keeps every parent in `parents`. `lineageOf(stable, genes, dragon)` in
`src/stable/lineage.js` reads an altar-born dragon's parents (as laid, with renamed and still owned ones from
the stable) and, per part and colour, its side and what each parent carried, plus its `mutations`, which the
lineage screen celebrates above them. `createStable` returns an empty stable;
`src/stable/starters.js` offers `starterKids(genes, stable)`, three seeded kids at 1 star, each built
for a different stat (`standout` in `src/dragonBuild.js`, which the welcome names), and
`adoptStarter(stable, genes, index)` moves one in, hungry (fullness 25) so the first care is a feed, with a gift egg (`giftEggSeed`, the candidate furthest from the kid); the game routes to `#/welcome`
while `welcomed(stable)` is false: the welcome asks the owner's name, then offers the kids, then the gift. `createStableYard(slots, { spacing, buildings })` without buildings is
the welcome's meadow. `src/stable/stableSave.js`
keeps the stable in `localStorage` under `dragonz-stable`; `saveStable` answers false when storage refuses it, and the game says so once. In the native apps a welcomed stable is also handed to `src/stable/cloudSave.js` for the player's cloud (iCloud key-value store on iOS, a backed-up file on Android); `loadStable` keeps the welcomed copy over a fresh one, then the one played last (`clock.real`), and `followCloud()` reloads the game onto a newer cloud copy that arrives as the game opens or comes back. `src/stable/stableSlots.js` holds the `stableSlots` shared by eggs,
dragons and wild dragons called home (`slotsBooked`, those still flying back; `slotsUsed`, `slotsFree`;
`callable(stable, ids)`, how many waiting wild ones fit; `ritualBlock` answers "The
stable is full" with none free); lineage, trophies and standings keep their own copies of a dragon's
name, so they outlive it.

An egg (`src/stable/egg.js`, `createEgg(seed, now, parents?, stars?)`) holds one baby, fixed when it is
laid or won: `eggBaby(genes, egg)` is the seeded genome of a gift or prize egg, or `inheritGenome` of
its parents from the egg's seed. It incubates `incubationTime` (`stageDurations.egg`, 8 game hours, or `giftIncubation`,
20 minutes, for the gift egg, so it hatches in the owner's first session; `incubate`, `timeToHatch`,
`incubationProgress`). `warmEgg(egg, now)` (`canWarm`, `timeToWarm`) warms it `warmCooldown` (1 game
hour) after its last warm, at most `warmLimit` (4) times, each warm skipping `warmSkip` (1 hour) of
incubation; an egg warmed every hour hatches in 4 hours. `stars` is the strength it hatches at before warms: half its parents' average `strength`
(`headStart`, each parent's `strength ?? 1`) for an altar egg, 1 for the gift egg, the prize for a prize
egg; `hatchEgg` hatches the kid at `hatchStrength(egg)`, `stars + warmStars` (0.125) per warm, at most 5,
stored as the dragon's `strength`.

New eggs come from the Soul Altar, which replaced two-parent breeding. `src/stable/soulAltar.js` holds
the ritual: `ritualOdds(count)` (`baseOdds` 36% with `minParents` (2), each extra parent adding less
than the last on a log curve, 56%, 70%, 81%, up to `topOdds` 90% at `maxParents` (6)), `ritualBlock(stable, parents, now)` (adults only, fit, awake, in the
stable, a free slot) and `performRitual(stable, genes, parentIds, now)`, which counts `stable.rituals`,
seeds the outcome from it, lays an egg of every parent on success and puts every parent to sleep
(`slumberUntil`: `successSlumber` 3 h, `failureSlumber` 1 h). `slumbering(w, now)`, `slumberLeft(w, now)`
and `slumberBlock(w, now)` ("Slumbering") read it; a slumbering dragon cannot race or join a
ritual.

`src/stable/care.js` holds the needs, 0..100, each age adding one to the last (`needsOf(age)`): kids
`fullness`, `happiness` and `cleanliness`, teens `exercise`, adults `affection` (`needValue`). `advanceStable` drops every need of the dragon's age
(`decayCare`; per game hour fed 12, happy 10, clean 8, exercise 9, affection 5, so a need asks for care,
under `careAlarm` (30), after about 6–9 hours, affection after 14) and grows it up: a kid becomes a teen after 4 game hours
and a teen an adult after 8 (`stageDurations`), whatever its care. `careLevel` is the mean need,
dragged down by the neediest.
`neediest(dragon)` and `careActionFor(dragon)` pick the one need and action (Feed, Play, Clean,
Exercise, Groom) the stable shows; `applyCare(dragon, id)` refuses an action for a need its age does
not have, and every action adds `careBond` (1 point) of bond, Groom 4 more; `applyCare(dragon, id, amount)` refills
`amount` (0..1) of the need's scale instead, its side effects scaled to match. `afterRaceCare(dragon)`, run
by `runLeagueRace`, exercises the dragon, leaves it hungrier and dirtier and adds `raceBond` (3 points).
An idle dragon in the yard shows its needs in its eyes (`faceOf` in `src/ui/dragonFace.js`, eased by the yard
stage): every need under `careAlarm` shows more the lower it runs, hunger heavy-lidded and wistful, unhappiness
and loneliness glum, as does an injury. In the minigames a fumbled drumstick, a whiffed ball or a stick that
plops at its feet leaves it glum, and a catch, a find brought back or a ball the keeper drops makes it beam.
A care action with a minigame (`minigames` in `src/minigames/minigames.js`, Warm for an egg, Feed, Play's Volleyball or Fetch, Clean, Exercise and Groom) plays it in the
stable yard instead of a tap (`src/ui/yardMinigame.js`, driven by the yard stage's `play`); the plate,
actions and roster fade out, the top bar shows its title and score, and a bar its hint, the need filling
and Done. `settleMinigame` in `src/stable/minigameResult.js` refills `minigameFloor` (0.3) of the need
plus the rest by the game's progress, and a score past `stable.highscores` sets a new best and refills it
in full. Clean (`src/minigames/clean.js`) muds each side of the dragon (`coatSpots`, more the dirtier it
is); the sponge, under the finger, lathers each spot off and the hose, aimed by it, rinses the lather,
then the camera swings round for the other side. Exercise (`src/minigames/exercise.js`) runs a seeded
circuit of drills, six reps each (push-ups for adults, squats, wing jacks, tail crunches), to a beat that
quickens (`createBeat` in `exerciseBeat.js`) and that a marker over the bar shows: the dragon lowers
into each rep to land on the beat and a tap on it drives the rep, a tap a little off makes it wobble, and
one way off or a beat let pass flops it face down and ends the set; the score is the reps.
Groom (`src/minigames/groom.js`) frames the head and neck close: the bare hand strokes them in search
of a hidden itchy spot (`scratchSpots`: crown, cheek, chin, nape, neck or throat, all on the flank
facing the camera, clear of the eye and each well apart from the last) while the dragon leans
in, closes its eyes and purrs the warmer it gets; held there, the spot fills with bliss, a hind foot
thumps, it scores and the itch moves on, smaller each time, and the third touch on the nose snorts the
session to an end.
Feed (`src/minigames/feed.js`) has the keeper hold up a drumstick; a drag from wherever the finger
touches down aims it, a dotted arc (`throwArc` in `throwArc.js`) showing its flight down to where it lands,
and lifting the finger throws it along that arc. `catchOutcome` (`feedCatch.js`) decides from how far
off the mouth it passes and the age's `catchSkill` whether the dragon, springing to meet it, snaps it out
of the air or fumbles it (a bonk on the nose, a late chomp, meat on its head) and eats it off the grass
for less; one out of reach comes down where its arc meets the ground, eaten when it falls near and lost
when it does not. The score is the catches and the third miss ends it. The dragon turns its head with the
pose's `lookYaw` and `lookPitch` (`src/animate/dragonLook.js`).
Volleyball (`src/minigames/volleyball.js`), a Play
variant, looks at the dragon from the keeper's place: the dragon heads the ball towards the camera, a tap or
hold on it as it arrives catches it and a flick throws it back, its speed and direction (`volleyballThrow.js`)
setting how far off the dragon's head it arrives; past its age's reach it whiffs, within it fumbles now and
then, and the rally (every touch scores) ends when either side misses.
Fetch (`src/minigames/fetch.js`, a Play variant) looks past the dragon out over the grassland (the yard's
`vista`, which the game's `camera()` asks for as its `heading`). A drag up the screen aims the stick, a dotted
arc (`aimTrace.js`) showing its flight down to where it lands, the longer the drag the further, up to about
100 m (`fetchThrow.js`), and lifting the finger throws it along that arc. The dragon, moved off its spot through
the game's `place`, flies after it, snatches it up where it fell and comes back (`fetchTrip.js`), now and then
with a log or a bone instead (`fetchFinds.js`), and tosses its find into the keeper's hand for the next throw.
The score is the metres fetched; a throw that does not carry past the dragon plops at its feet and ends it.
An egg's Warm plays the same way (the yard stage's `play` takes an egg, posing it with the
game's `{ roll, lift, glow, glowColor }`), with no need to fill: the host shows the game's own `meter`
and hands it to a `settle` callback, `src/stable/eggMinigameResult.js`. Warm (`src/minigames/warm.js`)
heats the egg as the finger rubs circles round it and cools it as it rests; held in `warmBand` it scores
every second, more for seconds in a row, until six are held, and too hot it fizzles in steam back to
cool. `settleWarm` warms the egg however little was played and keeps a new best score. Hatching
has no minigame: a few taps on the Hatch tile or the egg crack it into the yard's hatching.
`forecastNeeds(stable)` in `src/stable/needForecast.js` says when each dragon not yet under
`careAlarm` will first drop under it, in real ms at the clock's speed. In the iOS and Android apps,
`src/needNotifications.js` turns that into one local reminder per dragon ("Ember is hungry!") when
the game is hidden and clears them when it is back; the native side (`Notifications.swift`,
`Notifications.kt` with `NeedAlarmReceiver.kt`) asks for permission when the owner taps Remind me in
the first stable visit's tour; `canNotify()` tells whether the app can post them at all.
`src/stable/bond.js` starts a hatchling at `eggBond(egg)` (0.1, plus 0.03 per warm) and keeps `bond`
in 0..1 (`addBond`); it never fades. Neglect only stops a dragon growing stronger, never
costs it.

`src/stable/strength.js` holds strength (`strength`, the dragon's stars, 1 to 5, `strengthOf(dragon)`).
Every dragon can reach 5; where it hatched only gives a head start. `advanceStable` calls
`strengthen(dragon, dt)`, adding `strengthPace.perHour` (4/72 of a star) every game hour at a
`careLevel` of `careFull` (0.75) or more, scaled down to nothing at `careFrom` (0.4), so a 1-star
hatchling reaches 5 in about three days of good care. It never goes down, carries through evolution
and races add none. `starsOf(dragon)` returns the whole `stars` and the `progress` to the next;
`starToCelebrate(dragon)` and `markStarsCelebrated` (`starsCelebrated`, set at creation to the stars a
dragon starts with) let the stable toast each star once. `raceField` carries every participant's
`strength` into the race.

`src/stable/wild.js` keeps dragons in `stable.wild`, off the roster: `sendToWild(stable, id, now)`
(`wildBlock`, adults only) frees the slot at once, as does `goWild(stable, dragon, now)` for a dragon a prize egg displaces; `callHome(stable, id, now)` (`callBlock`) books a slot and sets
`homeAt` to `flightHome` (2 h) later; `onTheWay(w)`, `timeToArrive(w, now)` and `findWild(stable, id)`
read it; `arrivals(stable, now)`, called by `advanceStable`, moves every landed dragon back into
`stable.dragons` and returns its `arrived` events. A wild dragon does nothing: it is out of
`stable.dragons`, so it neither races, ages nor takes part in a ritual.

`performRitual` also returns the ritual's `seed`, from which the Altar screen plays its show.
`src/stable/reinsLesson.js` reads and sets `stable.reinsTaught` (`reinsTaught`, `markReinsTaught`): the riding controls are walked the first time the
owner takes the reins, and the flag is set as soon as they are shown. It also holds the invitation to take them: `reinsInviteDue(stable, riding)` is
true on Autopilot until `markReinsInvited`, so the first race asks on the grid, and `reinsInvited` is
true too for an owner who already took the reins, so only the first race on air asks.
`src/stable/careLesson.js` reads and sets `stable.careTaught` (`careTaught`, `markCareTaught`): the first time the stable
shows a dragon, the stable hand walks its care tile, offers reminders in the apps and says how the stable is saved
(`cloudName()` of `cloudSave.js` names iCloud or the Google account), and the flag is set as soon as the tour opens.
`src/stable/raceLesson.js` keeps `stable.raceHint`: `markFirstCare` sets it `due` on the owner's first care (a care tile or its
minigame), `raceHintDue` reads it, and `markRaceHintDone` sets it `done` for good, from the hint's close button or
`startLeagueRace` as the owner enters any race, so an owner who raced before caring is never pointed at one.
`src/stable/feste.js` decides when a dragon greets its owner like a happy dog (fare le feste, `festeOf(age)` in
`src/scene/care/feste.js`): a dragon is on screen while it is the one in view in the yard, the page shown and no app
sheet over it, and the stable stamps its `seenAt` (`markSeen`, real ms) every second then. `festeDue` holds as it comes
on screen when its `seenAt` is over `festeAway` (8 h) old, no dragon greeted (`festeAt`, `markFeste`) in the last
`festeRest` (5 min) and it is awake; a dragon never seen before has no `seenAt` and does not greet.
