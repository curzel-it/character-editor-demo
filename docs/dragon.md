# Dragon

## Genomes

`src/genome/<subject>.js` exports `genes`, an array of `{ name, label, min, max, default }`.
Genes may have `group: "color"` to separate colour controls from shape, and `visible: false` when they
never change the still model (`breath`, the element, which shows only while breathing). A gene with `choices` (labels)
selects a discrete variant: `min` is 0, `max` is the choice count, and anatomy uses the floored value.
A missing or non-numeric choice falls back to the first variant. A choice gene may have `weights`
(relative, one per choice); `makeGenome` then draws a whole-number index with those odds. Dragon choice genes are `head`,
`headgear`, `legShape` (thigh to ankle), `feet` (everything below the ankle), `wingFingers` (the three free fingers on
`wing-hand-±1`, at the wrist), the addon slots `tailTip` (on `tail-6`) and `hindWings` (0 is none), and `eyes`,
the iris colour (a `color` group choice over `dragonEyes` in `src/palette.js`: gold, amber, jade, ice, blood, violet,
moonstone, gold the commonest; `dragonColors(genome).eye`, behind the ink pupil, is lightened or deepened just enough
to stand apart from the scale colour). The coat is three `color` group choice genes, `scales`, `wings` and
`underside` (`colourGenes`), each picking one of the 32 `dragonColours` (`{ id, label, hex }`) in `src/palette.js`,
labelled under `genes.choices.colours` (their `choiceKey`); `dragonColors(genome)` reads `skin`, `membrane` and
`under` from their hexes. `markings` (a `color` group choice over `dragonMarkings` in `src/anatomy/dragonMarkings.js`:
none, the commonest by far, leopard spots, zebra stripes or cow patches) lays a pattern over the scale colour, drawn by the
racer shader from the rest pose so it moves with the body; `anatomy.markings` is `{ kind, color, seed }` or null, the
colour a deep shade of the scales (light on dark scales) and the seed taken from the shape genes. The wing arms and the
parts in the scale colour carry `markings` (1, or -1 on the legs, whose stripes run round them) and sweeps carry `marks`, so the underside, the
backs of the legs, bare feet and the wings stay plain. `metal` (a `rare` choice over `metalCoats` in
`src/genome/metalCoats.js`: none, or gold, silver, gold and silver, silver and gold, one dragon in a thousand between
them) overrides the coat: `dragonColors` takes the scales and underside from the first metal and the wings from the
second (`metalPalette`), and `makeSkinMesh` gives every vertex whose colour lies on a metal's hues its `metals` id
(`metalToneOf` in `src/anatomy/metalTone.js`) for the racer shader's sheen. Any combination is valid and only `metal`
affects racing stats, through the gene's `bonuses` (`geneBonus` in `src/dragonBuild.js`). `mane` (a `rare` choice over
`dragonManes` in `src/anatomy/dragonManes.js`: spikes, or an element mane in one dragon in 25) replaces the spikes
from the tail tip to the forehead crest from the teen years on (`wearsMane`), and the tail tip with a flame, with `anatomy.mane`,
`{ breath, anchors }`: one anchor per spike, tail tip first, with its bind position, an up swept back towards the tail
(flatter down the tail), flame height and skin joints, for the particles of `src/scene/elementalMane.js`. New choice genes are appended so older genes keep
their seeded values. Optional `presets` contains
`{ id, label, genes }` entries with colour gene overrides; choosing one preserves all other genes.
Genomes are objects mapping gene names to finite numbers. The harness creates them with `makeRng(seed)`.
The only subject is `dragon`. Styles are `cozy` (the game's) and `lowPoly` (its base, for the dev tools).
Dragons have two hind legs and wings, with no forelegs. A wing hand has six digits: three spars
(`spar-±1-0..2`, wingtip to trailing edge) carry the membrane, three free fingers face forward.

## Anatomy

`src/anatomy/<subject>.js` exports `createAnatomy(genome, { age }?)` returning:

```
{
  subject, genome, age, scale,
  bones: [{ id, parent: null | string, position: [x,y,z], rotation: [x,y,z] }],
  parts: [{ id, bone, shape, position, rotation, scale, color, vertices?, indices?, segments? }],
  sockets: [{ id, bone, position: [x,y,z] }],
  addons?: [{ slot, id, bones: [boneId], keepClear: [{ center: [x,y,z], radius }] }],
  bounds: { radius: number, center: [x,y,z] }
}
```

Bones appear parent before child. Bone transforms are relative to their parent. Part transforms are
relative to their bone. Each transform is translation × rotationZ × rotationY × rotationX × scale.
Part scale defaults to `[1,1,1]`; position and rotation default to `[0,0,0]`. Colours are RGB arrays
in `[0,1]`, obtained from `src/palette.js`. Bones have no scale.

Shapes: `ellipsoid` is a unit sphere; `box` spans -1 to +1 on each axis; `cylinder` is radius 1 with
Y from -1 to +1; `cone` has its base at Y=-1 and tip at Y=+1. `mesh` has flat numeric `vertices`
and triangle `indices`, in part-local coordinates. All surfaces are rendered double sided.

A mesh may have `colors`, a flat RGB array matching `vertices`, for vertex colours. It may also have
`skin: { joints, weights }`: one pair of bone IDs and one weight in `[0,1]` per vertex. The second
weight is `1 - weights[i]`. Skinned vertices use model/world coordinates in the rest pose; their part
transform must be identity. The renderer applies posed-world × inverse-rest-world bone matrices.
This lets one connected surface bend across multiple joints without gaps at the neck or tail.

`age` is `kid`, `teen` or `adult` (the default; unknown ids are adults), defined in
`src/dragonAge.js`. Age is not a gene: it is not inherited and never changes the genome. Each age
has a `size` (kid 0.5, teen 0.75, adult 1), multipliers on shape genes
(`grownGenome(genome, age)`), and factors for the head (scales everything carried by the `head`
bone), `snout`, `eyes`, neck `rise` (holds the head higher), torso `girth` and `pear` (0 to 1: wider hips,
narrower shoulders, thicker tail), wing `chord` and headgear `maturity` (0 to 1: fewer crest blades and spikes, shorter horn
curls and antler tines when young, so part ids and counts vary by age). `roundHead` (kids) swaps the
genome's head for `hatchlingHead` in `src/anatomy/dragonHatchlingHead.js`, with its own mouth profile
and no tongue or nostril bones; it wears a young version of the gene head's mouth (`dragonHatchlingMouths.js`: small teeth, a little beak,
short tusks, needles or front fangs). `seat` moves the `saddle`
socket along the back (kids sit further back, behind the big head). The skeleton outside the head is
the same at every age. `scale` is metres per reference unit (`creatureScale × size`); animation offsets use it.
`grownWingspan(genome, age)` is the wingspan in metres and sets the flap rate. `canBreathe(age)` is false for kids: breath comes with the teen. An adult anatomy is identical to
one created without `age`.

`bounds` is a stable framing sphere containing the full animation, with a positive radius.
Sockets name attachment points on bones. IDs are unique within each collection.
The dragon exposes `saddle` (on `chest`, on top of the back ahead of the wing roots) and
`saddle-rear` (on `root`, 1.5 m behind), with local up +Y out of the back. Its skeleton includes a
`chest` bone between `root` and the neck and wings, `wing-anchor-±1` bones for the membrane's rear root, on the flank above the hip, and
`toes-hind-±1`/`hallux-hind-±1` on each foot: every foot type has three forward toes and a hallux
on the back of the metatarsus that opposes them, like an eagle's. The dragon anatomy carries `feet`,
the id of its foot type; standing poses lay the toes flat, turn the hallux back onto the ground and
let the claw tips (`talon-*` parts) dip just below it.
Dragon `addons` lists one entry per addon slot (`tailTip`, `hindWings`) with the chosen variant `id`.
`keepClear` spheres are in rest-pose model metres and mark space that tack and other add-ons should
avoid; an absent addon has no zones. The hind-wing bones `hindwing-±1` (on `tail-1`),
`hindwing-elbow-±1` and `hindwing-tip-±1` exist on every dragon, so the skeleton never depends on
part choices; only their dressing is optional. Every eye carries an upper and a lower lid
(`src/anatomy/dragonEyelids.js`), skinned shells of skin on `lid-<upper|lower>-±1` (the edge) and
`lid-<upper|lower>-back-±1` (the far side) bones at a point deep in the eye: both lids lie on one surface
turned round an axis through the eye's corners, fitted just over the eye and its pupil, and open each
rests its edge on the eye's rim shrunk towards that axis by its part's `tuck` until no part of it shows.
The lid part carries the `axis`, `shut` (the angle that brings its edge to where the lids meet, a little
below the middle of the eye) and `trail` (the share of it the far side follows). The pupils hang on `gaze-±1` bones at
the centre of the eye's ellipsoid (`src/anatomy/dragonPupils.js`), their parts carrying `gaze`, the
pupil's reach forwards, back and up or down in radians before its tips would touch the ink ring. Eyes are `dome` parts
(`src/anatomy/dragonEyes.js`): `eye-±1` (the iris), `eye-rim-±1` (an ink ring at the skin line, thinner
with `maturity`), `eye-socket-±1` (a cup of skin from the skin line into the skull, never wider than it) and `pupil-±1`,
seated on the skull mesh, rounded as the smooth styles draw it, once the head has grown so the iris's edge meets the skin. Each `brow-±1` is
then settled onto the head (`src/anatomy/dragonBrows.js`): over the eye it runs along the iris's upper
edge, and ahead of and behind it keeps its own line, resting on the skull.

## Animation

`src/animate/<subject>.js` exports `pose(anatomy, t, motion?)`. `t` is the wingbeat phase; the loop
duration is 1 second. `motion` is optional `{ effort, glide, bank, climb, fatigue, time }` (`exhausted:
true` is shorthand for fatigue 1; a racer is only fatigued while dazed); without it the pose is a relaxed cruise that loops exactly.
`motionFromRacer(racer, time, previous?)` in `src/animate/flightMotion.js` derives it from a recording
racer and eases the 20 Hz steps. Motion may also carry mouth fields `roar`, `snap`, `snapSide` (±1)
and `gasp` in 0..1, and landing fields `flare`, `stand` and `impact` in 0..1, which
`landingFromEvents(recording, racer, t)` in `src/animate/landingEvents.js` derives from the racer's
`landing` progress and its `land` event. An adult's `stand` plants the wing hands on the ground its feet stand on with the elbows bent a set angle
level with the shoulders, the hands under them and well ahead of the feet, the spars swept back along the flanks, solved per genome by `handStance` in `src/animate/dragonHandStance.js` and raised
until the fingers meet that ground by `plantHands` in `src/animate/dragonHandPlant.js`; a teen's
and a kid's `stand` fold the wings in a Z at the shoulder, opening towards a shared open wing while `stand` is low, solved by `foldStance` in `src/animate/dragonWingFold.js` (both
share the 3x3 rotation helpers in `src/mat3.js`). Every `stand` arcs the tail round to the dragon's right, more the longer its segments, so a long adult tail sweeps behind it instead of trailing into the yard's barn and crates on its left, and `clearTail` then pitches it from the root until its lowest joint rests at the toes' height, so the curved tail still lies on the ground. `mouthFromEvents(recording, racerId, t)` in `src/animate/mouthEvents.js` derives
them from recorded events using lookbehind only. The ground breath (`src/animate/dragonGroundBreath.js`) layers
over a standing pose: `crouch` (0..1, needs `stand`) sinks the body onto flexed hind legs with the toes
kept where they stood, drops the chest, braces an adult on wider planted wing hands (teens keep the
wings folded) and aims the neck and head at `breathTarget`, a model-frame point (`modelTarget(anatomy,
position, forward, world)` converts a world point for a dragon drawn at `position` facing `forward`;
without one it is on the ground ahead), coiled in an S; `breath` then opens the jaw and drives the
head forward along the strike line so the plume leaves the mouth at the target. `groundBreathCue(age)`
gives `{ stand, crouch, breath }` for the whole move (stand, crouch, breathe, recover) over
`groundBreathLength` seconds; `strikeDistance(anatomy)` is how far ahead of its root a target suits a full strike (nearer ones keep the neck coiled).
Take-off fields (`src/animate/dragonLeap.js`) layer over `stand`: `wings` (0..1) frees the wings back into the flight beat while the legs stay planted, and `spring` (-1..1) coils the legs below 0 and drives them straight and back off the ground above it; the stable's swap crouches with the wings raised, pushes off into the first downstroke and climbs away.
Motion may also carry `sleep` in 0..1 and `sleepSide`
(±1, default +1): layered over a standing pose, `slumberPose` in `src/animate/dragonSlumber.js` lays
the dragon on its belly with the legs folded under it, the wings folded over the back, the neck and
tail curled round towards `sleepSide` Z with the head resting on the ground, and the eyes shut; 0 is
awake, 1 asleep, and running it back wakes it. The lying pose is solved once per anatomy and side
against the ground the feet stood on, `standHeight` below the root. Asleep it breathes slowly and
deeply, with two small twitches per loop, following `time`; the sleeping pose repeats every
`slumberLoop(anatomy)` seconds (without `time`, one breath per wingbeat loop).
Workout drills (`src/animate/dragonDrill.js`) layer over `stand`, each 0..1: `pushup` and `squat` bend
the age's rest stance (an adult's chest lowered between its wing hands, the hips sunk over the feet) so
the stand replants hands and feet on it, while `jack` raises the freed wings overhead with the legs
straddled, `crunch` (-1..1) curls the tail up over the back to meet the ducking head, and `flop`, with
some `sleep`, sprawls the dragon face down with its neck along the ground and its wings out.
The eyes live on their own: `lids` (0..1) draws them shut while awake and `sleep` shuts them, and
with `time` the dragon blinks every few seconds (`blinkOf(time, seed)` in `src/animate/dragonBlink.js`,
now and then twice); `lidPose(bones, anatomy, { upper, lower, tilt })` in `src/animate/dragonLids.js` takes
each lid's share of its travel, 0 hidden to 1 meeting the other, and rolls the upper lids about the eye
by `tilt` (-1..1), above 0 drooping their back corners for a sad look. Moods in the motion
(`expressionOf` in `src/animate/dragonExpression.js`) set the lids, which blinks close further: `glum`
(0..1, disappointed or sad) lowers them with drooping back corners and drops the gaze, `weary` (tired
or hungry) makes them heavy and `glee` pushes the lower lids up into smiling eyes. `gaze` (`[forward, up]`, no longer than 1, in shares of the pupils' reach) slides the pupils over
the irises (`gazePose` in `src/animate/dragonGaze.js`); without it and with `time` the eyes glance
about now and then and look straight ahead in between (`glanceOf(time, seed)`). Both are seeded,
never random. Shut eyes keep their pupils still.
`idle` (0..1, the yard's standing dragon) with `time` and `stand` lets the head tilt now and then like a
curious puppy (`tiltOf(anatomy, motion, time, seed)` in `src/animate/dragonTilt.js`): it rolls round
the snout to one side, sometimes over to the other, while the eyes look up and forwards; kids tilt
further and quicker, sleep, take-off and a glum or weary mood fade it. The same `idle` lets the tail wag now and then for two to three
seconds (`wagOf(time, seed)` and `wagPose` in `src/animate/dragonWag.js`): a side to side sweep that
travels down the tail, lifted a touch, with the chest swaying against it, fast and wide in kids and slow
in adults. With `bored` (0..1, the yard's dragon that wants to play) it also yawns: a bout of one or
sometimes two yawns at most every 36 s, more often the more bored, at least 20 s apart (`yawnOf(anatomy,
motion, time, seed)` and `yawnPose` in `src/animate/dragonYawn.js`). The head tips back, the jaw opens
wide slowly with the eyes squeezed shut, the tongue draws back and curls, the wings shrug, then the jaw
shuts with a little smack and the nostrils flare; kids yawn quicker and wider, adults slower and deeper,
and the head tilt makes way for it.
Pose positions are metres at the scaled creature size.
It returns `{ bones: { [boneId]: { rotation?: [x,y,z], position?: [x,y,z], scale? } } }` (`scale` uniform).
Pose position and Euler rotation are added to the bone's rest values before composing transforms.
No wall clock or random calls in animation. Every limb and wing follows the bone hierarchy.

## Tack

Tack is layered and optional, so the dragon can always be shown naked.
`withTack(anatomy, { harness, saddle, jockey })` in `src/jockey/withTack.js` returns the anatomy
unchanged when nothing is chosen. Otherwise it adds parts prefixed `harness-` (breast collar, straps,
crupper, loin strap, and a roller pad when unsaddled), `saddle-` (cloth, girth, flaps, seat, stirrups)
and `jockey-` (rider, silks, helmet or hat, hair, belt, neck collar, reins). A jockey implies
a saddle; the harness is independent. The layers sit on the `saddle` socket, are traced over the
rest-pose hide and are skinned to neighbouring bones. It sets `anatomy.tack = { harness, saddle, jockey,
bone, seat }`, plus `anatomy.jockey = { id, bone, saddle }` with a rider. `withJockey(anatomy, jockey,
{ harness = true })` is shorthand for a rider in full tack. The race and setup screens draw each
participant's jockey, a name, silks and look that never change the race; owned dragons are ridden by the owner.
The look (`src/jockey/riderLook.js`: build, skin, hair style and colour, headwear; a build scales the
body and may reshape its hips, waist, chest, bust, shoulders, neck and limbs, so Hourglass and Broad read
apart from Slim, Average and Sturdy) dresses the body built by `riderBody(pose, jockey, …)` in `src/jockey/riderBody.js`, posed in the racing tuck by
`riderParts` or standing by `riderFigure`. Tack parts that would enter an `anatomy.addons`
`keepClear` sphere are left off.
