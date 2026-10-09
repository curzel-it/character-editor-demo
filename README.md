# Character Editor

A character editor built in isolation on the Dragons! engine, for the next project that reuses it.
It makes cozy, stylised characters (riders, wizards, knights, sprites…) that the engine draws like its
dragons: a rigged, animated model from a small spec, and an editor that is quick to play with and hard to
make look bad.

Run `npm run dev` and open http://127.0.0.1:8120/ (the Dragons! game itself is at `/game`).

## What it does

- **A live character** in the game's sunny meadow: it breathes, blinks, follows the pointer with its
  eyes, reacts to changes, and plays moves (wave, cheer, dance, jump, pose, think, bow, shrug) and
  expressions (happy, laugh, wow, smug, wink, sad, grr, sleepy). Drag to spin it, scroll or pinch to zoom;
  the camera moves to the face, the eyes, the hair or the feet as you edit them.
- **58 traits in six tabs**: body shape (height, build, muscle, shoulders, chest, waist, hips, legs, head
  size, skin), face (shape sliders, 8 noses, 8 mouths, 6 ears, cheeks and markings), eyes (8 shapes,
  colour, size, spacing, height, tilt, lashes, 7 brows), hair (18 styles, colour, dyed tips, volume,
  7 facial hair styles), outfit (10 tops with 9 patterns, 8 bottoms, 7 shoes, gloves) and extras (13 headwear,
  6 eyewear, 6 neckwear, cape, backpack, satchel, little wings, quiver, earrings).
- **Option tiles drawn with your character**, so a hair style is shown on your face in your colours;
  hovering previews it on the stage. Curated swatches, plus a custom colour picker.
- **Undo and redo**, a **Surprise me** shuffle that keeps colours harmonious and respects locked tabs,
  a shuffle per tab, **12 starter characters**, a **wardrobe** of saved characters with portraits,
  and **share codes and links** (`CE1-…`), portrait PNG and JSON export.
- Phone and desktop layouts, keyboard shortcuts, everything keyboard and screen-reader reachable.

## Where things are

- `src/character/`: the spec, the model, poses, codes, shuffles, starters and the worker build
- `src/editor/`: the editor UI (`createCharacterEditor(root, { value, onChange, onDone })`)
- `editor.html`, `styles/editor.css`
- `docs/character.md`: the contracts, and how to add a trait
- `docs/game.md` and the rest of `docs/`: the Dragons! game and engine this sits on

## Checks

- `npm test`, `npm run lint`
- `node tools/checks/characterEvidence.mjs --sheet hair` and the other sheets in `docs/character.md`
- `node tools/checks/editorEvidence.mjs` for editor screenshots on desktop and phone
