# Rendering

## Dragon renderer and evidence

`src/render.js` exports `createRenderer(canvas, { transparent })` returning `{ render(anatomy, pose, options), readPixels(), info, dispose() }`.
Options include `{ style, yaw, pitch, zoom, background }`; defaults render a three-quarter
view using the anatomy's framing sphere. `render` returns `{ triangles, bounds }`.
`readPixels()` returns `{ data: Uint8Array, width, height }` with bottom-left origin.
The renderer owns GL resources. Generation and poses are pure; rendering has explicit canvas effects.

`src/subjects.js` exports `subjects`, `styles`, `loadSubject(id)`, `makeGenome(genes, seed)`.
`loadSubject` resolves `{ genes, presets, createAnatomy, pose }` and rejects for unavailable modules.

Checks write `shots/<subject>/<style>/report.json`, `contact.png`, `animation.png`, `broadcast.png`
and `genes.png`. Reports contain `subject`, `style`, `createdAt`, `checks` (array of
`{ name, status: 'pass'|'fail'|'review', details }`), `environment` and `summary`.
Human recognition and visual quality are always marked `review` until a human reviews the evidence.
Shared style edits require regression checks for every implemented subject using that style.

`src/style/<style>.js` exports `styleConfig`: `{ edge, round?, soft?, scenery? }`. `edge` is the strength of the silhouette
stroke and its halo (Cozy's is 0: its dragons go unlined).
`round` passes every dragon part through `roundMesh` (`src/roundMesh.js`) as its mesh is built: shared
normals and a `round`×`round` split of each triangle over its PN patch, so the same rigs come out rounded;
`round: { bulge }` instead splits only the edges whose curve bulges more than `bulge` × the radius off
the straight edge (`roundMeshAdaptive`). `soft` shades them with wrapped, low-contrast light. The `cozy` style uses both: its
rounding is the player's Detail setting (`src/cozyDetailPreference.js`), `light` by default (about 2× low-poly's
triangles) or `full` (every triangle split in four).
`scenery` softens the scene's dressing and building the same way (`softenDressing` in `src/scene/softenDressing.js`):
the pieces scenery drew inside `builder.lump` (bushes, tree crowns, hay, barrels, clouds, pebbles, fence posts) get
shared normals, split `scenery`×`scenery` within a course's `near` area (`{ centre, radius }`, the stable yard's set)
and left unsplit elsewhere, and the colours of what it drew inside `builder.blend` (the yard's ground) blend across
shared corners. With `soft` the world shader then lights scenery and terrain with their own normals, interpolated
colours and wrapped light. Cozy uses `scenery: 3`.
Scenery can also be drawn twice with `builder.styled(plain, soft)`: the result keeps both versions as `styled: { flat, soft }`,
the scene draws the soft one (softened like the dressing) for a style with `scenery` and the flat one otherwise, and bakes its
light from the flat one. Trees use it for Cozy's tiered conifers and puffy broadleaves (coarser far from the corridor), the
yard for Cozy's soft grass tufts, whose up-leaning normals the world shader never flips.
A `soft` style also lights each place through `cozyEnvironment` (`src/palette.js`): open shadows tinted cool, a crisp
saturated grade and a light vignette, over the place's own colours; its dragons' darkest colours are lifted to a pastel
floor. In the yard it also curves the world away from the camera like a rolling log (`bend`, `src/scene/worldBend.js`):
every scene vertex shader places its geometry through `bent`, and the final pass unbends the depth it reads back so
shadows still land. The yard stage gives each style its own resting view; Cozy's is tilted further down through a
narrower lens, so the curve reads like a diorama.
Outlines are composited around the complete rendered silhouette, rather than around individual parts.
`renderBatch(instances, options)` draws `{ anatomy, pose }` entries in a 4-column viewport grid.
Evidence reports record `environment.sourceRevision` and are marked stale by the lab when
source files change after the check. There is currently no ground geometry.

## The custodian — `src/custodian/`

The Soul Altar's custodian is a scene figure, not a subject: `createCustodian()` returns an anatomy
(14 bones, parts prefixed `custodian-`) standing on the origin, facing +X, about 1.6 m to the crown,
that `createRenderer` draws like a dragon. `custodianPose(time, { pose, toward, blend })` poses him
as `idle`, `ritual` or `talking` (`custodianPoses`), eased `blend` of the way to `toward`; hands reach
their targets by two-bone IK, so the staff stays planted while he sways. Poses depend on `time` only.
`node tools/checks/custodianEvidence.mjs --url …` writes 1080p evidence to `shots/custodian/<style>/`.

## Scene — `src/scene.js`

`createSceneRenderer(canvas)` returns `{ render(frame), finish(), dispose(), info }`, where `frame` is
`{ course, racers: [{ anatomy, pose, position, forward, bank }], camera: shot, style, time? }`.
`render` returns `{ triangles, viewProjection }`. Frames may also carry `previousCamera` (for motion
blur), `motion`, per-racer `flap`, `speed` and `trail`, and `landings` (the recording's `land`
events), from which `buildSplash` in `src/scene/splash.js` throws up seeded water spray, mud,
sand or dirt, dust from the wing downwash, and ripples, in amounts scaled by the event's `heft`.
A racer's optional `glow` (0..1) washes it towards `palette.hatchGlow`, the white of a hatching.
A racer's optional `coat` (up to 12 `{ at, radius, mud, foam }`, `at` a point of its rest pose) covers
the skin round each spot with `palette.coat` mud and bubbly lather, moving with the body.
A metallic coat comes with the mesh: `uploadSkin` (`src/scene/skinBuffers.js`) puts each vertex's metal on attribute 5,
and the racer shader's `metalLook` shades it without reflections, falling to the metal's `shadow` where the surface turns
to the ground, a bright band at the horizon, a `sheen` glint towards the sun (`metalPalette`, `metalShades`).
A racer's optional `aura: [{ id, strength }]` lists its statuses: each spawns `statusAuras` particles
from every bone (`src/scene/statusAura.js`) and the strongest tints the body through `glow` in
`palette.statusTint`, unless the racer carries its own `glow`.
A racer's optional `breath: { element, strength }` (an entry of `breathElements` in
`src/breath/breathElements.js`, strength 0..1) pours a plume from its mouth (`src/scene/breathPlume.js`);
the particles live in world space on the frame `time`, outlive the breath and reset when time runs back.
A racer whose anatomy carries a `mane` burns it from its tail tip to its forehead (`src/scene/elementalMane.js`): flame tongues
gathered into a few locks, placed from the posed anchors every frame, so their feet stay on the hide while they curl back
like hair, their tips sway together in a breeze and lean back as the dragon moves; they are drawn with the breath shader's tongue (kind 7), nudged towards the camera so the
hide never hides them, in `manePalette`'s colours for the breath element.
A frame's optional `props` lists meshes in the dressing layout rebuilt as they change (the altar's glow);
they are drawn with the dressing and their emissive triangles bloom.
It draws terrain, course dressing and every racer in one perspective view in either style.
A frame's optional `fireworks: { show, t }` draws the Soul Altar's fireworks: `show` comes from
`createSoulFireworks({ elements, origins, altar, seed, result, radius, ground })` in
`src/scene/soulFireworks.js`, one breath element per parent's mouth in `origins`, and `t` is seconds
since the breath started. The show is a pure function of its seed and `t` (it scrubs both ways):
the plumes pour onto the altar, merge into a vortex and an orb, burst into rising streams and element
shells (fire a crackling peony, nature a dripping willow, earth heavy tumbling boulders, storm a
strobing ring with lightning, water a glittering crystal; mixed circles trade colours between shells), and settle as dust while one light
per parent spirals down to the altar. `fireworksPhases` holds the cut points (`breath`, `merge`,
`burst`, `settle`, `reveal`, `end`); at `reveal` a `result` of true flashes the egg in, false lets the
lights gutter out. `show.light(t)` gives the `{ color, strength }` the altar can glow with. Its glow
also feeds the bloom.
A course may carry a prebuilt `dressing` mesh (the `createBuilder` layout) that replaces the one
built from its path, gates and features, and a shot may carry `shift`, a vertical lens shift in clip
units, and `span`, the tangent of a horizontal half-angle that must stay in frame, which widens the
fov on canvases too narrow for it. `createStableYard(slots)` in `src/scene/stableYard.js` returns such a course for the Stable, in the
`yard` environment: one `{ position, forward }` spot at the origin facing three-quarters towards the
camera on the +Z side, the set around it (`yardSet.js`: the barn of `stableBarn.js` behind it to the
left, the fence, hay, barrels and tub of `yardProps.js`, the trodden dirt and the grass, flowers and
bushes of `yardGrowth.js`), the view opening to the right onto meadow, a castle and a ring of pointed, snow-capped peaks about 2 km out
under the clouds of `cloudMesh.js`, and `blockers`, the barn's footprint. The barn is the course's
`building`, a mesh of its own drawn with the dressing, or laid over the racers at the frame's `buildingOpacity` while that is under 1. Its `lightBounds` bakes
lighting over the set alone, fine enough for the barn's shadows, and its `casters` leave out the roof
and what stands out from the barn front, which a height-field bake would fill down to the ground.
Without buildings it is an open meadow with `slots` spots in a row along +X.
An environment's `fogStart` is how far off the fog begins.
`src/scene/propMesh.js` builds faceted props (boxes, lathed bodies) as a one-bone anatomy the scene
draws like a racer, lit, outlined and shadowed in either style; a prop built in world axes is placed
with `forward: [1, 0, 0]`. The awards ceremony uses three: `podiumAnatomy(steps, division)`
(`podiumMesh.js`, a carpeted dais with a stone step per place, a plate in its medal's metal and a
pennant in the division's metal at either end; `stepTop`, `podiumFrame`), `trophyAnatomy(metal, size)`
(`trophyMesh.js`, the cup) and `createConfetti` (`confetti.js`), paper diamonds and the cup's glints
as a pure function of time for the frame's `fireworks` slot. Their colours are `ceremonyPalette`.
`src/ui/podiumStage.js` stands the top three on the podium of an open meadow (`createStableYard`
without buildings) with their riders, swoops the camera in and drops the cup on the champion at
`trophyLands`; `node tools/checks/ceremonyEvidence.mjs --url …` writes `shots/ceremony/<style>/`.
`src/ui/meadowStage.js` stands the welcome's kids and gift egg in the same meadow; a dragon carrying a
`jockey` stands ridden, `{ rider }` stands that rider on foot (`riderFigure` in `src/jockey/riderFigure.js`,
a one-bone anatomy), and `pick(index, zoom, turn)` turns the picked one from the camera (-1 picks none), a zoomed shot
framing it as it stands once turned, so every kid lands the same; `onTap` gets -1 for the open meadow; its `frameArea()` gives
the free band `{ top, bottom }` and its `orbit` turns the shot. `node tools/checks/welcomeEvidence.mjs --url …`
writes `shots/welcome/<style>/`, `tools/checks/stageOrbitEvidence.mjs` `shots/stageOrbit/<style>/`.
`createStageOrbit(canvas, { onTap, rise })` in `src/ui/stageOrbit.js` gives a 3D stage the stable's camera
gestures with no buttons: a drag orbits (coasting on after release, the tilt stopped where the stable's is), a pinch
or the wheel zooms in from the stage's own framing and two fingers dragged together pan; `onTap` gets a release that
moved nothing. The stage reads `view()` (`{ yaw, pitch, zoom, pan }` offsets from its own framing) every frame and
applies it with `orbitShot(shot, view)`; `reset()` eases home, as the welcome does whenever another kid is picked,
and `clear()` jumps home.
`createAltarStone({ position, yaw, seed })` in `src/scene/altarStone.js` is the Soul Altar's centre stone as seeded
data: a chamfered slab on a plinth over two stepped courses, `top` (1.2 m) high, `radius` its lowest step's reach,
and `eggPoint`, where an egg's lowest point rests in the carved ring on top. `addAltarStone(builder, altar, env)`
draws the stone and its dark carved channels into a dressing; `altarGlowMesh(altar, glow, color, env)` lights the
channels to `glow` (0..1) in an RGB or a list of them spread round the altar (`palette.elementGlow` per breath
element), for the frame's `props`. `node tools/checks/altarEvidence.mjs --url …` writes `shots/altar/<style>/`.

## The Soul Altar at dusk

A course may name its colour set with `environment` (`environmentOf` falls back to its `type`); a set's
optional `sunDir` replaces the one `SUN` for the bake, the sky and the shadows. `dusk` is the valley under
a low warm sun. `createAltarPlace()` in `src/scene/altarPlace.js` is the altar as such a course: a flat
clearing with the ring (`stoneRingLayout`), the altar stone, a copse and hills, and the custodian's
spot; `altarPlaceProps(place, { altarGlow, runeGlow, colors, runeColor })` lights the altar's channels
and the ring's runes as frame `props`. `createAltarCast(module, place)` (`altarCast.js`) poses
the custodian and the parents (resting in formation for the evidence, or gliding in, landing and breathing
at the altar). `createRitualShow` (`ritualShow.js`) is the whole ritual as a pure function of time and
seed: `ritualTimeline` gives its beats and the custodian's lines, `ritualShots` its planned cuts (the
close-ups pick a parent and side the stones and others leave clear), `createAltarMist` the mist of a
silent altar. `src/ui/altarStage.js` plays it full screen on the Altar screen.
`node tools/checks/altarShowEvidence.mjs --url …` writes `shots/altar/show/`.
