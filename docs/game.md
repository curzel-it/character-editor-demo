# Dragons!: flying dragon racing

Dragons! is a procedural racing game of flying dragons, broadcast live like a real sporting event.
Players raise and care for dragons, ride them in age-restricted leagues, make new eggs at the Soul Altar,
and watch every race.
The game runs locally; there is no online play.

## Concept

In 2026 content (models, animation, video) is cheap, so the value lies in systems: a simulation deep
enough to surprise its own authors, directed like television.

- **Local only:** races run in the player's browser from seeds. A shared server league with
  scheduled races is not planned for now.
- **Age leagues:** every race is restricted to one age class (kids, teens, adults); mixed-age fields
  are one-sided.
- **Live direction:** a drone-style camera follows the racers and the system chooses the cuts (the
  comeback, the fall, the photo finish), with generated commentary and highlights.
- **Dragons only:** two hind legs and wings, no separate arms. Flight adds altitude, banking and
  terrain, which give races strategy that ground racing lacks. Parents pass on visible inherited
  traits.

### Audience

| Profile | Does | Where |
| --- | --- | --- |
| Spectator | Watches races and the championship | Site, app |
| Owner | Owns, raises and rides dragons, and makes new ones at the altar | Site, app |

### Owner pillars

1. **Genetics:** a dragon comes from its seed and, later, from the parents of a Soul Altar ritual: continuous genes plus
   interchangeable parts, with visible lineage.
2. **Raising:** a dragon starts as an egg; warming it brings hatching closer and makes it
   hatch a little stronger. Every dragon races and needs Tamagotchi-like care a few times a day,
   each age adding a need, as it grows into a teen and an adult, up the age leagues to the main event. A finished stage waits for the
   owner, who evolves the dragon in the stable yard. Racing
   is the main focus but never forced. Care, strength, rest and injuries matter too; the owner rides every
   dragon they own, one at a time.
3. **The race:** the flight simulation itself, which must be readable and spectacular.
4. **Economy:** market, entry fees and prizes. It must stay healthy without speculation. This is
   still open, and it is where Zed Run and Blaseball failed.

Betting, including play money, is out of scope.

### Why dragons

The first phase compared horses, dragons, cars and armed cars in both art styles. Dragons
won: inheritance shows on the body, flight gives the owner real choices, and the silhouette reads at
race distance. Armed cars remain the fallback if flight races prove unreadable.

### Lessons from others

| Title | Lesson |
| --- | --- |
| Umamusume: Pretty Derby | The racing audience exists, but the character wins, not the simulation |
| Zed Run | Right idea, killed by a speculative economy |
| Horse Racing Manager 2026 | Live races every few minutes exist, without spectacle |
| Champions Stable | Strong graphics, but single-player |
| Blaseball | Procedural live leagues work; revenue and content must not depend on writers |
| Marble League | Staging and commentary matter as much as the simulation |
| Salty Bet | Even the AI's "stupid" mistakes entertain |

Each design choice is judged on six criteria: simulation depth, readability for the spectator,
broadcast spectacle, technical feasibility, owner agency, and upsets (a sensible favourite with a
fair margin of surprises).

## Current state

The 1.0 scope: an owner raises a dragon from egg to adult through care alone, rides or watches every
race of a ranked season, and sees it crowned at an awards ceremony. There is no training, and the
owner is the rider of every dragon they own.

- **Dragons:** a 13.5 to 17.25 m wingspan. Seeded continuous genes (proportions, legs) plus
  three colours (scales, wings and underside, each one of 32 named colours from Crimson to Chocolate) and
  interchangeable parts: Head (toothed, beaked, blunt, needle snout, viper), Headgear (swept horns,
  ram horns, frill, spiked crown, antlers), Leg shape, Feet (raptor, eagle, heavy, webbed, sickle,
  perching, gecko), Wing fingers (hooked claws, long fingers, stubby fingers, bare bones, spikes), and two addon slots: Tail tip (tapered, spade, fan, club, stinger,
  forked fin) and Hind wings (none, membrane, feathered), and Eye colour (gold, amber, jade, ice, blood, violet, moonstone; gold the commonest). One dragon in a thousand has a very rare metallic coat, gold, silver or a mix of the two on body and wings, shaded with a sheen and worth a little extra Top Speed (gold) or Acceleration and Handling (silver). Eyes blink every few seconds and glance about now and then, and their lids shut them in sleep; standing in the yard, a dragon now and then tilts its head like a curious puppy and wags its tail, and one that wants to play (Happiness under 40) yawns once or twice now and then, eyes squeezed shut, with a sleepy sound and a little puff of breath. Whole-body flight animation with blended
  states and event-driven mouth expressions. The game is drawn in the Cozy style, built on the low-poly
  rig, which the dev tools still offer with `?style=lowPoly`; the same seed is the same individual in both.
- **Age ranges:** kid, teen or adult (the default), chosen per dragon or for the whole field
  and not inherited. Kids hatch from the egg half size and chubby: every kid wears the same round
  head whatever head it grows into (a round skull, a short smiling snout, a cream chin, frilled
  cheeks and big forward-facing slit eyes) on an upright neck, with the horns, legs, feet and tail tip their genes choose, half-grown
  wings, a spiky back and the saddle set back behind the big head; teens are three-quarter size and
  gangly: their own gene heads with big eyes, a lean body on long legs, a raised neck and long,
  narrow wings.
  Headgear grows with age: kids have nubs, a sparse crown or frill and bare antler stubs; teens
  have half-curled horns and two tines; adults the full shape. Kids cannot breathe in races;
  breath comes with the teen. Age sets the speed class, in even steps
  like 50cc, 100cc and 150cc engines: kids fly and accelerate at 82% of an adult and teens at 90%.
- **Riders and tack:** the owner is the rider of every owned dragon, with a name picked in the welcome; the look (build, skin, ears, eyes, hair,
  facial hair, marks, headwear, goggles, scarf and kit) and the silks (a sash in cream, brown and grey) are the same for every owner, and only the dev tools' Profile changes them; rivals are
  ridden by seeded riders with their own names, looks and silks.
  Riders never count in a race: every racer flies on its dragon's stats alone. Tack is
  layered: a harness (on/off per dragon), a saddle with a cloth in the silks, and the rider in a
  racing tuck (helmet or hat, goggles, belt, reins). Every dragon is ridden on screen.
- **Courses:** Froude-scaled to 200 km/h racing; every league races about 90 s (80–100 s): the Main
  Event flies 54% of the full 7–10 km course (4–5 km), the Teen League 48% and the Kids League 46%
  (fewer gates at the same spacing, no gate higher or lower than a dragon can climb or dive to from
  the one before). Exhibition fields of one age race their league's length, mixed fields the Main
  Event's. In league races the owner's dragon flies with the owner's edge, a hidden lift to its flight
  stats that makes a starter on Autopilot a bronze champion. Valleys (default) with forests, river,
  lake, gorge, col and a real-scale castle; canyons with slots, arches and spires.
- **Simulation:** a deterministic flight model. A dragon races on five stats, each read off a part of
  its body: Top speed (a long torso), Acceleration (big wings), Handling (a long tail), Weight (its
  bulk) and Breath (big headgear). Its build splits its strength (stars) across them, so two dragons
  of the same stars have the same total and the build says what each is good at. There is no
  stamina: a dragon flies at its top speed unless a missed gate, a breath hit, a bump, a turn tighter
  than its Handling or the takeoff slows it, and Acceleration brings it back; slipstream slingshots a
  chaser past and a clean pass through a gate's centre gives a small burst. Autopilot steers each
  racer's line from its build and breathes at the rivals its element beats; a seeded form (perfect or
  off shape one race in ten each, shown before the race; the owner's dragons are
  always in perfect shape on the first day) and a seeded lane per race add upsets.
  Five elements form a cycle (fire, nature, earth, storm, water, each beating the next): a hit slows
  the rival, knocks it back and dazes it, twice as hard when super effective. Roster order is the
  starting grid. The field starts on the ground: at Go each dragon reacts, jumps off (spurred legs
  push hardest, then raptor, feathered and armoured; longer legs push harder, heavier bodies leave
  slower) and beats its wings until it is up to flying speed, climbing out to race altitude.
- **Broadcast:** every race opens on a 4.5 s lead-in before the recording starts: a camera stands
  down low behind and beside the owner's dragon (or the front row's nearest pair), looking forward along the course, and creeps in while a 3, 2, 1,
  Go countdown plays; on Go the field crouches and jumps off the ground, kicking up dust, clods or
  spray, and the camera tilts up after it (the takeoff shakes the ground under it). Then a director plans cuts from the recording with a 3-second lookahead: trackside,
  fly-by and rider shots, and speed effects (streaks, vapour, blur, shadows, FOV kick). The rider
  cam is onboard: a lens about 3 m behind and above the saddle, off one shoulder, fixed to the
  racer so the jockey's helmet, silks, reins and tuck read with the neck and head ahead. It rolls
  with at most 30% of the bank (capped near 13°), shakes little and barely kicks its FOV. The
  director cuts onboard with the leader, a racer mid-overtake, the chaser for the lead and a kick
  for home; over 8 seeded races it holds about 16% of screen time (13% before) and no other shot
  loses more than a point.
- **Stable (1.0 rules, 4 October 2026; every number is still provisional):** the
  game is local and saved in the browser. A game clock drives it (×1, and ×10 to ×600 as a dev
  tool with `?dev=true`). An egg holds one baby, fixed when it is laid or won, and incubates for 8 game hours; warming it
  (once an hour, up to 4 times) skips an hour and adds ⅛ star, so an egg warmed every hour hatches
  in 4 hours half a star stronger. The gift egg incubates 20 minutes, so it hatches in the first session. It hatches as a kid at its stars: half its
  parents' average for an altar egg, 1 for the gift egg. Needs drop over
  time, each age adding one to the last: kids fed, happy and clean, teens exercise, adults affection. They
  drop slowly enough (a need runs low after about 6–9 hours, affection after 14) to need care a few times a day. Kids become
  teens after 4 hours and teens adults after 8, whatever their care.
  Bond (0..1) lives on the dragon: it starts in the egg (each warm adds a little), rises with every
  care action and race, most with grooming, and never fades. Stars are a dragon's strength,
  1 to 5 for every dragon whatever its genes: every hour its needs stay high it grows a little
  stronger, so a 1-star hatchling reaches 5 in about three days of good care; neglect only stops it,
  races add none and stars carry through evolution. A dragon never dies or loses for certain.
  New eggs are made at the Soul Altar, where two or more adults hold a ritual (36% with two, 56%, 70%,
  81%, up to 90% with six): parts, the element and the three colours (eye colour among the parts) come
  whole from one parent, or mutate into one no parent shows (5% when the parents agree, up to 20% when
  they all differ), a metallic coat passes down whole or turns up anew one time in a thousand, shape genes blend across them with some noise, and each dragon shows where every
  trait came from; an altar egg hatches at half its parents' average stars. Cards show the whole stars
  filled and the next one outlined while care grows it. The stable has 6 slots shared by eggs and dragons of every age; an
  egg holds its slot from the moment it is laid, so a ritual needs a free slot and hatching never does; sending an adult to the wild frees its slot.
- **Live races and riding (first pass, 3 October 2026):** every league race runs live at 60 Hz and opens as
  the broadcast with the owner's dragon on Autopilot, flown by the racer AI. In the owner's first
  race the stable hand stops it once the field is up, explains Autopilot and points at Take the reins with pulsing coach marks. Take the reins hands it
  to the owner mid-race, seen from a chase camera behind and above (it trails lane changes) or
  through the rider's eyes, and Autopilot hands it back to the director. The race stays
  deterministic from its seed and the log of the owner's inputs per step; the director's 3-second
  lookahead runs on a forked sim that assumes Autopilot, rebuilt from the log on every hand-back. A
  race left mid-way (the app closed, or the screen left) flies on by itself on Autopilot in game time:
  coming back before its finish picks it up where it has got to, replayed from the seed and the log, and
  once it has finished it is recorded with the results watching it would have given; it cannot be restarted. Riding is the stick
  and Breath, one thumb on a phone: left alone the dragon flies the racer AI's line, as on Autopilot;
  drag anywhere for a floating stick that bends that line across the course and climbs or dives
  (gently near the centre, as hard as the dragon can at full stick; arrows or WASD on a keyboard). For
  teens and adults a Breath button (Space, F or E on a keyboard) breathes the dragon's element at the
  rival ahead or alongside, then recharges. The dragon always flies at the pace its stats allow; the
  rider's edge is the line and when to breathe. The flight takes off from the ground on its own. A
  rider who flies the line well beats Autopilot (see Results).
- **Leagues:** Kids League, Teen League and the Main Event (adults), each with ranked seasons of 16
  races and points 10-8-6-5-4-3-2-1. Every league has three divisions, Bronze, Silver and Gold, and a
  new stable starts each in Bronze. A division seats the same 7 named rival stables every season,
  each with its own rider; a stable sits in one division of a league but can turn up in every league.
  Each season they race fresh seeded dragons at more or fewer stars by the league and the owner's
  division, and the owner rides exactly one dragon of the league's age in each race (8 starters).
  Points and standings are per stable, so every dragon the owner races adds to one row. At the end
  of a season the top 2 go up a division and the bottom 2 down, and the Gold champion is the league
  champion: the owner's top scorer earns the trophy. Every season ends at an awards ceremony, where
  the owner's top scorer earns a medal for its place (1st, 2nd or 3rd) when the stable finished on the podium
  of any division, along with a prize egg: a fresh genome,
  nothing from the stable, hatching at 1 to 2.5 stars by division and place. A prize egg won in a
  full stable sends the oldest dragon to the wild to make room. A race adds fatigue that needs about 15 minutes of rest before the next, but the very first race leaves the dragon fresh
  (a season with one dragon is an evening of check-ins), and may injure a dragon (2% plus a
  little more when tired) for 1–3 hours. A new stable starts with the kid picked in the welcome
  and a gift egg.
- **Sound (first pass, 7 October 2026):** everything is synthesized in the browser, with no audio files. The music
  is [musicbox](https://github.com/curzel-it/musicbox), lofi only, seeded fresh each session and playing on from screen
  to screen, races included. It dips under big moments. The effects are rendered once from code (`src/sound/`): a soft tap under every button and
  tab, toasts, rewards and sheets; in a race the countdown, the wing beats of dragons near the camera, breath and hits
  panned to where they happen, cheers at the finish and a fanfare for the winner, with no background bed of wind or
  crowd; in the yard the crack and hatch of an egg, care, each minigame's catches and
  misses, and the Soul Altar's beats. Dragons call by age: kids chirp, teens squawk, adults roar. Sound starts at the
  first tap, sleeps while the page is hidden, and stays off on a tool's virtual clock. Settings has a volume slider each
  for effects (80% by default) and music (20%), kept per device.
- **Landing:** finishers glide to a lane on the run-out, flare and touch down on dirt, mud
  or sand (adults also in very shallow water, wading; kids and teens never in water), then rest: adults, the most forward-heavy, like a gorilla tipped onto the planted wing hands, the elbows level with the shoulders and the hands under them, well ahead of the feet, the spars swept back, up and out over the thighs and the membrane spread from them towards the top of the hips, outside the legs, on hind legs bent like a theropod's, knees splayed out; teens half upright with the wings in a looser Z, the forearm across the chest and the membrane hanging under the arm, outside the thigh;
  kids stand chest-up with the wings tucked in a tight Z on the flank, the elbow raised beside the spine, the membrane low on the hip and the claws forward on the chest, so no part of the wing crosses the back. The director cuts to a slow-motion ground camera for the
  touchdowns (always the winner's), shaken by the impact, with debris thrown up.

## Results

27 September 2026, Chrome on Apple M3 (ANGLE Metal, WebGL 2). Timings are for that machine only.

- **Dragons:** up to 4,136 triangles each; p95 CPU frame time of 0.8 ms (low-poly) with twelve
  animated individuals at 60 fps. At race distance colour carries most of the
  distinction between individuals.
- **Race scene:** 12 dragons in a canyon at 5.8 ms per frame at 1080p and 9.7 ms at 1440p.
- **Races** (5 October 2026, `batch.mjs --type valley|canyon`, 200 races per course type, 8 adults at
  3 stars each on the full course): no DNFs or corridor violations. Lead changes average about 3.1 and
  the winner is not leading at halfway in 32% of valley races and 21.5% of canyon ones. The favourite
  (the best public handicap) wins 19.0% on valleys and 20.5% in canyons (chance 12.5%); with stars
  spread a star either side of 3 (`--spread 1`) it wins 29.5%, with 2.51 lead changes and the winner
  not leading at halfway in 18.5%. Every element wins 10–14% of races. By what each dragon is built
  for, Acceleration builds win 16–19%, Weight 16.5% on valleys and 8.6% in canyons, Top speed 12–14%,
  Handling 11–13% and Breath 6.5–9%: the Breath build is the weakest and awaits playtesting. A dragon
  in perfect shape wins about 13–16% of races, against 10% of the starters.
- **Autopilot against a scripted rider** (5 October 2026, `batch.mjs --rider`, 120 races, one owned
  racer per race, flown twice in the same race): a live race left on Autopilot is the simulated race to
  the frame. A rider who nudges the stick towards a gate it is about to miss and breathes whenever a
  rival it does not resist is in reach (`--steer loose`) does better than Autopilot in 42.5% of races
  and worse in 31.7%; aiming the stick at each gate's centre all race (`--steer gates`) leaves the
  racing line and does worse in 73%.

Verdict: **reviewed** (27 September 2026). Federico confirmed the dragons read clearly in the race, and
approved the castle scale, jockeys and tack, mouth expressions, landings and the kid and teen looks.
Automated checks report measured properties only; new visual work still needs his review.

## Running the lab

Use a recent Node.js with native ES modules and `fetch`; there are no package dependencies. The app
needs WebGL 2 and the browser checks need Chrome.

```sh
npm run dev
```

Visit [the app](http://127.0.0.1:8094/). The server binds to `127.0.0.1:8094`; `HOST` and `PORT`
override it.

`index.html` is the game, a phone-first UI in the Dragons! theme. It routes its screens by the URL hash, with a bottom nav of Stable, Race,
Altar and Settings:

- **Welcome** (`#/welcome`): the first run, shown until a kid is picked, in one 3D meadow scene
  with the stable hand talking the owner through it: first the owner, who rides every dragon they
  own, gives their rider a name (everything else about the rider is the same for every owner, and none of it
  counts in a race); then three seeded kids
  stand in a row, seen all together, and the owner picks one to raise from a roster like the stable's, each card
  its face, name and the stat it is built for: a card or a tap on the kid frames it alone, turned
  three-quarters the same way for each, and the first card, All three, or a tap on the open meadow steps back out;
  Raise waits until a kid is in view; throughout, the camera
  moves as in the stable, a drag turning it around them and a pinch zooming in and panning, until
  another kid is picked; then the others
  leave and the kid stands ridden beside a gift egg, the stable hand points at the first race in the
  Kids League, and the Stable follows with the kid and the egg.
  Returning players never see it; New stable in Settings leads through it again.
- **Stable** (`#/stable`): the landing screen, a full-screen 3D stable yard where the egg or
  awake dragon in view stands in front of the barn, the view opening onto the meadow and a far castle, while every
  slumbering or race-tired one lies curled up asleep on its own straw bed at the barn's left end (easing down as it
  falls asleep and up as it wakes, framed lower and wider). Picking another awake one in the roster swaps them over: a
  dragon takes off and flies away as the next glides in and lands, eggs hop off and on along the barn front; picking a
  sleeper orbits the camera round the barn to its bed and back, and between sleepers it glides from bed to bed. A dragon
  that has not been in view for over 8 hours greets the owner as it comes back like a happy dog, hopping with its wings
  fluttering, tail wagging and chirping, at most one greeting every 5 minutes. Dragging
  orbits the camera freely around the one in view (the barn fades out while it stands in the way), the wheel or a pinch zooms in on it, two fingers pan it, all of it reset
  when another is picked, and what shows over the scene follows the one in view: its name
  plate with its mood and its best honour (a league trophy, else its best medal, with the count of them all, as on its
  roster card; a slumbering dragon with its wake time, badged in the roster too), the actions led by
  Profile (then warm and hatch an egg, with the warms used, the time to the next warm and the time left to hatch;
  race or take a racer to the altar; an adult can be sent to the wild; every dragon adds one
  care tile for its lowest need, carrying that need: feed, play or clean, exercise from the teen on and
  groom for an adult), and the
  roster of the whole stable with its used slots, a greyed card counting down for each dragon on its way
  home (a tap opens its profile) and a card per free slot, opening the altar. `#/stable/<id>` selects one.
  Send to the wild is asked once on a parchment card ("Ada leaves the stable; calling it back takes 2 h"),
  and asked again, sterner, when no dragon would be left at home. The roster's Wild tab lists every wild
  dragon with its record and Call home, or the time left for one already flying home; while the stable is
  full a warning counts the dragons on their way and the eggs holding the slots, and with several waiting
  Call all home says how many fit. A wild dragon's profile stands it in the yard as a guest.
  An egg is warmed by rubbing it in circles in the Warm minigame, keeping it glowing just right. A ready
  egg hatches in the yard: a few taps on Hatch or on the egg crack it, the stable dims and the egg glows white and trades places with the kid ever faster until a flash lets the kid hop out
  under a Hatched! stamp, the camera slowly drawing back. A dragon that finished its stage waits, badged
  Ready! in the roster, with an Evolve button over its actions; a tap plays the same show, its old age trading
  places with the new one under a Teen! or All grown up! stamp. A kid that becomes a teen then introduces
  its breath: a card in the element's colours names it ("Rokrok breathes fire!"), says to tap its button
  with the reins when a rival flies right ahead or alongside (Autopilot breathes on its own), and the
  teen breathes on stage, again from Again!, the camera held wide on it and its plume (on a phone, turned to its side and close
  on its head and the plume leaving it) until Got it or the stable is left; the profile's Traits tab keeps the breath afterwards. Each star a dragon earns is
  celebrated once in the stable: a toast ("Ember earned a star!") and, for the dragon in view, the new
  star popping on its name plate.
  On the first visit, the stable hand's coach marks (as in the first race) ring the dragon's care tile and
  say it needs feeding, play and cleaning a few times a day, even while the game is closed; in the apps they
  offer reminders (Remind me asks for notification permission, Not now skips it, and Settings can ask again);
  and they say the stable
  saves itself as it is played, on the phone and in iCloud or the Google account, or in the browser on the web
  (`stable.careTaught`, seen once shown). After the owner's first care, a bubble over the actions points
  at the Race tile, which pulses: "Time for a first race!", the dragon ready for its league; tapping it
  opens the race entry, and it goes for good once a race is entered or its close button is tapped
  (`stable.raceHint`).
- **Profile** (`#/stable/<id>/profile`): a card with folder tabs and a close button rising over the
  Stable, the name plate staying above it with a pencil to rename. An egg shows its incubation, warms
  and the stars it hatches at, and every parent of its ritual, each keyed by a lettered colour tag; a
  dragon shows first whether it is in the wild, on the way home (with the time left) or slumbering
  after a ritual (with its wake time), then Overview (its mood in a line with a chip per need of its
  age and, when it cannot race, why; then its age and its stars as two matching bars, the stars with how
  to grow the next), Traits (the breath element, what it is strong and weak against and a Breathe
  button from the teen on, then its look: body parts and colours) and History (record, its trophies
  and medals, races and Send to the wild, not while in the wild). Overview and Traits end on Details.
- **Details** (`#/dragon/<id>/details`, from the profile): the nerdy side of a dragon. Racing: its
  exact stars, a radar of its five racing stats (the filled shape the dragon now, a dashed outline the
  same build at five stars) and a bar per stat against that ceiling, with the body part behind it;
  Care: every need and its fatigue; Genes: the shape genes, body parts and colours, each with the
  parent it came from or a mutation; Origin: its parents, generation, seed and Lineage.
- **While you were away** (`#/away`): a sheet over the Stable on return after at least five
  minutes (the game reopened or brought back to the front) with news, never empty: eggs ready to hatch, dragons
  needing care, dragons ready to evolve, healed or rested, each opening the screen that deals with it.
  A race left on air that finished meanwhile leads it with the dragon's place and opens its results; it
  opens the sheet after any absence, and when it finishes while the owner is elsewhere in the game it
  toasts and the sheet opens on the Stable. Shorter absences, and any other return to a race on air, only toast; `window.__game.away(ms)` pretends the game was closed for `ms`.
- **Lineage** (`#/dragon/<id>/lineage`, from Details): every parent of
  the ritual (two side by side, more in a grid), each keyed by a lettered colour tag, with its own
  parents and whether it is in the stable, in the wild or gone, tappable while still owned; the
  dragon below them with its generation; and which parent every body part and colour came from,
  or a mutation, next to what each parent carried, every mutation celebrated in a card above them.
- **Soul Altar** (`#/altar`, or `#/altar/<id>` with a parent picked), plain UI until the ritual: adults picked into
  places around a stone circle, one place per adult at home (two to six), each with its readiness; the
  others listed with why they cannot join (not an adult, injured, tired, slumbering, in the wild)
  and live countdowns; the odds of an egg for the circle; the stable's slots
  for the egg; and Begin, which holds the ritual and plays its show full screen (about 28 s, Skip
  to jump): the custodian raises his staff, the parents glide in and land round the ring, crouch and
  breathe at the altar together, their breaths meet in fireworks over it and settle as dust, and an
  egg flashes onto the stone or the lights fade into mist while he consoles the owner; then the
  result card (the egg or silent stones, and how long the parents slumber). The show is fixed by
  the ritual's seed, cut between planned shots, and lit by the fireworks on the altar's channels and
  the stones' runes.
- **Settings** (`#/more`): the cabinet (each league trophy as League champion with its league, division and season, and each
  medal with its place and division), look and language (Cozy's detail, language), Reminders and New stable; with `?dev=true`, a Profile row (the owner's silks and name) opening Profile and a Developer
  card adds the game clock's speeds and the exhibition field, then links to the privacy policy and terms on curzel.it, which the apps open in an
  in-app browser (Safari sheet on iOS, Custom Tab on Android). Reminders turns care reminders on or off in the apps and says what the phone
  still needs: Allow reminders while it has not asked, Open phone settings once it was refused; on the web
  it says reminders come with the apps. The reminders are planned again on every save, and handed to the app
  only when the plan changes: a week ahead, each need of each dragon dropping low, each egg ready to warm or
  hatch, and the dearest dragon missing the owner after a week away, gathered into at most two a day (three
  with a hatch or a missed owner), four hours apart, none from 23:00 to 06:00. One due while the game is open
  is not shown.
- **Profile** (`#/more/profile`, `?dev=true` only): the owner, who rides every owned dragon: name, character, and
  outfit (headwear and silks with pattern, body, accent and trim colours).
- **League** (`#/league`): Kids League, Teen League and Main Event, each with its emblem (a shield
  whose wings grow with the league's age, crowned for the Main Event), the season's division and
  progress, the owner's best place (and whether it is going up or down) and who can race now. A league
  without a dragon of its age is locked, shows one of its rivals greyed, and tapping it says why (too
  young, outgrown, or none yet) instead of opening it.
- **League detail** (`#/league/<id>`): the division, the next race with who goes up and down, the
  points table with owned dragons highlighted and the promotion (green) and relegation (red) places
  marked, the season's races with Results and Watch, and at the end the division champion (the league
  champion in Gold), the owner's promotion, relegation or stay, the awards ceremony and the next season
  in its division; every finished season stays listed under Past seasons with its ceremony.
- **Race entry** (`#/league/<id>/entry`, or `#/league/<id>/entry/<dragon>` from a dragon's Race
  tile or a rested dragon in While you were away): the one fit dragon to ride, picked already (the
  dragon the owner came from, else the one selected in the stable, else the first one ready; unfit
  ones greyed with the reason; each with its stars and condition), the field (the season's seven rivals plus the pick) in gate order with the favourite, and Start race, which waits for the
  pick (No dragon ready while none is fit) and puts the race on air (`#/live/<league>`). While a race of the league is on air, the entry,
  the league page and the Race tab lead back to it instead.
- **Race on air** (`#/live/<league>`): the broadcast below flown live, with the mode in the ribbon
  (Autopilot or Riding) and Take the reins over the controls. Riding swaps the broadcast chrome
  (leaderboard, commentator, speed) for a rider frame round the screen, the chase or rider camera
  (Camera switches, kept per device), the speed and the next gate, the gate marked
  in the scene or pointed at from the screen edge, the stick and Breath, and Autopilot to
  hand back (R on a keyboard does both). In the owner's first race, on the grid before the countdown, the race waits
  under the stable hand's coach marks: each dims the screen and rings the real control with a pulse,
  first the Autopilot chip (your rider flies the dragon for you), then Skip (no need to watch: the
  race jumps to the finish), then Take the reins, with Keep
  watching to stay on Autopilot (`stable.reinsInvited`, never shown to an owner who already took the
  reins). The first time the owner takes the reins the race waits while the marks walk the stick,
  Breath (for a dragon old enough), the gauges and Autopilot (`stable.reinsTaught`). Every step can be skipped,
  and each tour counts as seen once it opens. A dragon that finished is handed back to
  Autopilot. Pause and Skip stay (Skip hands back and flies the rest on Autopilot at once); the
  race is recorded at the finish and the results follow. Leaving keeps it flying on Autopilot, and until it
  finishes its dragon cannot enter another race, evolve, go to the wild or join a ritual; the Stable
  says it is On air and its Race tile leads back to the race. Once it has finished, While you were
  away tells the place and links to the results instead.
- **Race** (`#/race`): each league's next race the stable can enter, then past races with owned
  entrants, newest first.
- **Broadcast** (`#/broadcast/<league>/<season>/<race>`): a league race replayed full screen, with the owner's
  ride when they took the reins, with the director, rider and free cameras, the owned dragon's position badge (its place,
  how much of the course it has flown and, in a close fight, the gap), the leaderboard (the top three and the owner's dragon), a
  commentator calling the race's events (each line fading after a few seconds), pause, speed and skip; the results follow at the finish.
  Breath hits float and statuses badge only on the owner's dragon and on rivals it hit.
- **Results** (`#/results/<league>/<race>`): every finisher's dragon in a portrait ringed in its
  racing colour, the podium (with a photo finish when it was close), the
  order with times, gaps and points, each owned dragon's condition and record, the standings after
  the race with the promotion and relegation places, Watch again and Back to league. After a season's
  last race a card gives the owner's outcome and opens the awards ceremony.
- **Awards ceremony** (`#/ceremony/<league>/<season>`): full screen, the season's top three stand
  ridden on a podium in the meadow (the gold, silver and bronze steps, pennants in the division's
  metal), the owner's dragon on the grass in front when it finished lower; the camera swoops in, the
  cup in the division's metal comes down over the champion and confetti falls, then a stamp gives the
  owner's side (Champions!, Promoted!, Relegated, a podium place or Season over). Name tags carry the
  place, the stable's top scorer and the stable (You for the owner). Below: the champion, the owner's outcome, the
  trophy, medal and prize egg won (and who left for the wild to make room for it), the final standings with the zones, Replay ceremony, the next season while it
  waits, and Back to league. It reads the season's end from the league, or from the history once the
  next season began, so every past ceremony can be replayed.
- **Exhibition field** (`#/dev/field`, a developer tool linked from Settings with `?dev=true`; without it the dev routes go back to Settings): the exhibition sandbox,
  separate from the stable and saved in this browser: course type and seeds, the age of the whole
  field, the participants in grid order (add, remove, reorder, shuffle), each opening in the
  editor, and Start race, which plays it in the broadcast (`#/dev/field/race`) and holds on the
  finish with the whole order.
- **Editor** (`#/dev/editor/<id>`, a developer tool): one participant of the exhibition field live
  on the stage (drag to turn it) with its flight modes, live racing stats, Prev and Next through the
  grid, and tabs for the dragon (name, seed, age, harness), every gene with the palette presets, the
  rider, and the dragon's stars. Changes save at once.

Choices whose effect is not obvious carry a small ⓘ (`src/ui/infoTip.js`) that opens one or two
sentences in a bubble: the profile's age, stars and breath, the details page's racing, the race
entry's dragon and field, the league's standings and the altar's odds and adults.

The art style applies to every screen and is remembered.

Developer pages:

- [lab.html](http://127.0.0.1:8094/lab.html): unlinked; the specimen preview with the 12-dragon
  lineup, the evidence matrix and check results, and work activity from `/api/progress`
  (`runtime/progress.json`). The app never polls `/api/progress`.
- [race.html](http://127.0.0.1:8094/race.html): the tool-link race page. `race.html?course=…&race=…`
  (plus optional `type=`, `racers=`, `style=`, `camera=free`, `t=`, `blur=off`,
  `motion=reduce|full`, `paused`; the game's `/` forwards `?course=` and `?race=` here) races a seeded
  default field in the 3D broadcast with a free camera, never touching saved data, and exposes
  `window.__race` for the check tools.
- [raceMap.html](http://127.0.0.1:8094/raceMap.html): top-down and altitude diagnostics.
- [cameraMap.html](http://127.0.0.1:8094/cameraMap.html): the director's shot plan and cameras.

## Checks and tools

```sh
npm test
npm run lint
npm run check -- --style cozy
npm run check -- --all
node tools/checks/preview.mjs --subject dragon --style cozy --seed 2407 [--age kid|teen] [--stand] [--hd] [--frame adult]
node tools/checks/variantEvidence.mjs [base] [heads|legs|feet|wingfingers|addons|all]
node tools/checks/raceEvidence.mjs
node tools/checks/welcomeEvidence.mjs [--style cozy|lowPoly]
node tools/checks/seasonEvidence.mjs [--style cozy|lowPoly] [--seed 342450]
node tools/checks/clarityEvidence.mjs [--style cozy|lowPoly] [--prefix after]
node tools/checks/raceVideo.mjs
node tools/checks/starsEvidence.mjs [--style cozy|lowPoly] [--lang en,it]
node tools/race/batch.mjs --season kids|teens|adults [--care 1] [--seasons 3] [--per-day 4] [--division bronze] [--stars 1]
node tools/race/batch.mjs --type valley|canyon [--age kid|teen|mixed] [--share 0.5] [--strength 3] [--spread 0] [--owned 1..5] [--rider [--steer none|gates|loose] [--breath smart|none]]
```

Browser checks start the local server if needed and save JSON reports and PNG evidence in
`shots/<subject>/<style>/`; `--url` targets another server and `--help` lists the options. The
preview accepts `--time`, `--yaw`, `--pitch` and `--zoom` to compare the same pose across styles.
`welcomeEvidence` walks a new stable through the welcome and its first race's coach marks into riding in
`shots/welcome/<style>/`; `seasonEvidence` plays a new owner's first season on a phone (care, the
gift egg warmed and hatched, the single pick, the reins taken and handed back, a reload mid-race,
the season fast-forwarded to its ceremony and next division, then teen and adult needs) into
`shots/season/<style>/` and fails on what did not hold; `clarityEvidence` saves what an owner reads (the profile with
an info tip open, the details page, the league, the altar, the race entry and the live race on Autopilot, riding and
at the finish) in `shots/clarity/<style>/`; `starsEvidence` saves the star toast, the profile's Stars
row and its ⓘ and the race entry in `shots/stars/<style>/<lang>-*.png`; `raceEvidence` saves scene evidence in `shots/race/<style>/` (including `rider-*.png` rider-cam
frames), `raceVideo` records WebM clips of key moments (including an onboard `rider` clip), and
`batch` runs 200 headless races of dragons at `--strength` stars (give or take a seeded `--spread`)
and reports lead changes, comebacks, margins, the favourite's win rate, win rates by form, element and
build, and stat and gene influence; `--owned` makes one racer per race, in turn round the grid, an
owned dragon of that many stars and reports its wins, podiums and mean place; `--season` instead races
a new stable's starters through seasons of a league from `--stars`, their needs held at `--care` and
growing stronger between races; `--rider` flies that racer again in the same race with a scripted
rider (`tools/race/scriptedRider.mjs`: the reins from the start; the stick alone, nudged towards a
gate about to be missed with `--steer loose`, or on each gate's centre with `--steer gates`; breathing
whenever a rival it does not resist is in reach, or never with `--breath none`) and compares it with
Autopilot.

After changing a shared style, check the dragon and the race scene in that style; anatomy or
animation changes need both styles. Passing checks leaves human visual review outstanding.

Module contracts are in [docs/](docs/README.md).

## Pitch deck

`tools/pitch/001/` is the pitch deck, served by `npm run dev` at `/tools/pitch/001/index.html`
(arrows, space or a click to step, `p` for the speaker notes, `f` for full screen). Its dragon galleries are
drawn live by the game's renderer; its screenshots and clips live in `tools/pitch/001/media/`, kept out
of git and free to be a symlink to another disk. The scripts in `tools/pitch/001/capture/` (stable,
care, league, race and element shots) capture them from the running game with a frame-stepped clock, and
`tools/pitch/001/pdf.mjs` exports the deck as a PDF. Each takes `--url` (the game, default
`http://127.0.0.1:8094`), `--out` (the media folder, which also receives the PDF) and `--tmp` (scratch
frames, default `<out>/tmp`); the PDF needs ImageMagick's `magick` and the clips need `ffmpeg`.

## Deploy

`npm run deploy` publishes to [p2.curzel.it](https://p2.curzel.it). It runs the tests and lint,
builds the single-page `dist/`, uploads the server, source and `dist/` to a new release in `/opt/sportz/releases`, switches `current`
atomically, and manages the `sportz` systemd unit (port 8094, bound to 127.0.0.1), the nginx vhost
and a certbot certificate. A failed health check rolls back. It needs `.env` with `IP_ADDRESS`,
`SSH_USERNAME`, `SSH_PASSWORD` and `CERTBOT_EMAIL`; the host key is pinned in
`.deploy_known_hosts`. Options: `--dry-run`, `--skip-certs`, `--skip-tests`, `--commit "message"`.
