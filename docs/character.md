# Characters and the character editor

The character is a stylised, cozy human (or elf, sprite, knight…) built on the Dragons! engine: plain
data that the engine's renderers draw like a dragon. The editor makes and saves them. Both are meant to
be lifted into the next project as they are.

## The spec — `src/character/characterSpec.js`

A character is a flat `CharacterSpec`: `name` plus one value per field in `fields`. Each field has a
`key`, the `group` (editor tab: body, face, eyes, hair, outfit, extras) and `section` it shows under, a
`label`, a `kind` and a `default`:

- `slider`: a number in 0..1 with `min`/`max` captions (height, build, face width, eye size…)
- `choice`: one of `options` (`{ id, label }`): hair style, eyes, top, headwear…
- `color`: `#rrggbb`, offered as rows of `swatches` (`characterColors.js`); a field may allow `"none"`

`focus` names the framing the editor's camera moves to while the field is edited; `shown(spec)` hides a
field that does not apply (the colour of headwear nobody wears). `normalizeSpec(value)` turns anything
saved or pasted into a complete, valid spec; `defaultSpec()` is the first character. Adding a trait is
adding a field and reading it where the model is built; codes, shuffles, the panel and tests pick it up.

## The model — `createCharacter(spec)` in `src/character/characterAnatomy.js`

Returns an anatomy (`{ id, spec, bones, parts, bounds, joints, rig }`) standing on the origin, facing +X,
its right towards +Z, about 1.5 to 1.9 m tall. Parts are authored in model space and moved into their
bone's frame at assembly; skinned meshes (torso, limbs, mouth, skirts, cape, long hair) blend two bones.
`rig` carries the lids' rest angles, the mouth's rest, the height, and `focus` framings
(`full`, `head`, `face`, `eyes`, `upper`, `lower`, `feet`: `{ center, radius }`).

- `characterRig.js`: body measures from the sliders and the 41-bone skeleton (spine, face rig with eyes,
  lids, brows and mouth corners, hair chains, arms, legs, cape).
- `headShape.js`: the head as one parametric surface by yaw and pitch. Hair, beards, hats, glasses
  and face marks are all laid on or offset from it, so any head shape fits them.
- `characterEyes.js`, `characterFace.js`, `characterHead.js`: eyeballs painted in crisp rings, lids
  and lashes on lid bones, brows, nose, mouth with an inner mouth that slides out to open, ears, marks.
- `characterHair.js`: a shell over the scalp whose edge follows the style's hairline exactly, plus
  locks (fringes, layers, curtains, tails, braids, buns, spikes). `hairProfile` tells headwear how
  far the hair stands off the head; headwear presses it down under its rim.
- `characterOutfit.js` + `characterBody.js`: garments are painted onto the body's tubes and swell them
  where they cover; tops drape straight off the hips and clear the thighs; skirts, hoods, collars,
  belts, straps and buttons are their own pieces.
- `characterHeadwear.js`, `characterAccessories.js`, `characterBeard.js`.

## Poses — `characterPose(anatomy, time, state)` in `src/character/characterPose.js`

Returns `{ bones }` for the renderer: breathing, a weight shift and arm sway, blinking, head and eyes
turned to `state.look` (a model-space point), an `expression` (`expressions`: happy, laugh, surprised,
angry, sad, sleepy, wink, smug) eased in from `previousExpression` since `expressionAt`, and a `gesture`
(`gestures`: wave, cheer, think, bow, shrug, hero, dance, jump) played from `gestureAt`, its length from
`gestureLength`. `still: true` holds the rest pose, eyes open, for thumbnails. Poses depend on time only.

## Building off the main thread — `src/character/characterBuild.js`

`createCharacterBuilder({ size })` keeps a pool of module workers (`characterWorker.js`) that run
`createCharacter` and the engine's `makeSkinMesh`, returning a light anatomy without parts that carries
`prebuilt: { key, data }`. `src/scene.js` and `src/render.js` use a prebuilt mesh when its key matches
the style's rounding (or the anatomy has no parts). `build(spec, round, { lane })` keeps only the
latest request per lane, so a slider drag never queues stale builds. Without workers it builds in place.

## Codes and shuffles

`encodeCharacter(spec)` / `decodeCharacter(code)` (`characterCode.js`) pack a character into a
copyable `CE1-…` code of about 90 characters (sliders to 1/254, choices and swatches by index, custom
colours as three bytes, the name in UTF-8). Codes follow the field order: adding a field breaks old
codes, which is fine while there are no users. `randomSpec({ seed, base, keep, only })`
(`characterRandom.js`) makes a harmonious character from a seed: natural skin and hair most of the time,
outfits from a colour scheme with neutral trousers and shoes, a few accessories; `keep` holds groups
from `base`, `only` shuffles one group. `characterStarters.js` lists curated starting characters.

## The editor — `src/editor/`

`createCharacterEditor(root, { value, onChange, onDone, persist })` mounts the whole editor:

- `characterStage.js`: the character in the game's meadow (scene renderer, Cozy style). The camera eases
  to each field's framing inside the band the overlays leave free; drag spins the character with a coast,
  wheel or pinch zooms, double-click faces the camera. Eyes and head follow the pointer; a tap on the head
  draws a laugh, elsewhere a wave. Changes land with a little bounce, sometimes a reaction.
- `editorPanel.js`: tabs, sections and fields. Choice options are tiles drawn with the character itself
  (`tileRenderer.js`: one offscreen WebGL renderer, a priority queue, a cache keyed by the spec); hovering
  a tile or swatch previews it on the stage. Sliders commit on release, double-click resets.
  `colorPicker.js` adds custom colours. Each tab can be locked against shuffles or shuffled alone.
- `editorState.js`: the spec, undo and redo (a slider drag is one step), locks.
- `wardrobe.js`: saved characters with portraits in `localStorage` (`character-editor:wardrobe`), and
  the starters. `shareDialog.js`: copy a code or a link (`#CE1-…` opens the editor on that character),
  wear a pasted code, download a portrait PNG or the JSON.
- The character being edited survives a reload (`character-editor:current`).
- Keys: Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (or Ctrl+Y) undo and redo, Ctrl/Cmd+S saves, R shuffles,
  1–6 switch tabs, arrows turn the stage and move through tiles and tabs.

`globalThis.__characterEditor` exposes `{ state, stage, panel, tiles }` for tools.

## Evidence

- `node tools/checks/characterEvidence.mjs --sheet <name>` renders contact sheets to `shots/character/`:
  `turnaround`, `faces`, `hair`, `headwear`, `outfits`, `bottoms`, `builds`, `eyes`, `noses`, `mouths`,
  `facial`, `extras`, `expressions`; `--tiles '<json>'` draws ad-hoc tiles `{ label, spec, focus, yaw, pose, time }`.
- `node tools/checks/editorEvidence.mjs [--only desktop|phone] [--steps '<json>']` screenshots the
  editor through a scripted tour into `shots/editor/`.
- `tests/character.test.mjs` builds every option and slider extreme, round-trips codes, checks poses,
  history, locks and the wardrobe.
