# Character Editor

This repository develops a character editor in isolation, on a copy of the Dragons! engine, for a new
project that will reuse that engine. The editor is at `/` (`editor.html`, `src/character/`, `src/editor/`,
`docs/character.md`); the game it came from still runs at `/game` and its notes below still hold for the engine.

## Character editor

- The character is plain data from a flat spec (`src/character/characterSpec.js`); every trait is a field, and the model, codes, shuffles, panel and tests read the field list
- Parts are authored in model space and moved into bone frames at assembly; the head is one parametric surface that hair, hats and faces build on
- Builds run in workers (`characterBuild.js`); renderers take a `prebuilt` skin mesh
- Visual work needs Federico's review: render contact sheets with `node tools/checks/characterEvidence.mjs` and editor screenshots with `node tools/checks/editorEvidence.mjs`
- The dev server runs on port 8120 (other projects hold 8093–8098)

# Dragons!

Dragons! is a game about racing flying dragons: owners raise dragons, make new eggs at the Soul
Altar, enter them in age-restricted leagues and watch every race as a live broadcast. The game runs locally; there is no online play.

- `README.md` describes the editor; `docs/game.md` holds the game's concept, current state and results; `todo.md` the work queue; `docs/` the module contracts
- Still in development with no users: break links, saved data and contracts whenever it makes things simpler; no migrations, no backwards compatibility
- The game is named "Dragons!" and its creatures are dragons (they were once called wyverns, so old notes may say so); internal identifiers such as the `dragonz-*` storage keys and the `it.curzel.dragonz` bundle id keep the earlier spelling
- Vanilla JS, no third party dependencies (musicbox, our own soundtrack library, is the one exception), closed source
- Along with the game we ship dev tools (tool links, `window.__race`, `window.__game`, the clock speeds, `lab.html`), this is intentional
- The only subject is the dragon: two hind legs and wings, no separate arms. The game is drawn in Cozy; lowPoly is its base and stays a dev-only style
- Dragon variety comes from continuous genes plus interchangeable parts selected by choice genes
- Races stay deterministic from their seeds, readable for spectators and open to upsets; measure outcome changes with `node tools/race/batch.mjs`
- Automated checks cannot prove visual quality; new visual work needs Federico's review
- After changing a shared style, check the dragon and the race scene in that style

## Dev Tools

- `npm run dev` - serves the editor at `http://127.0.0.1:8120/` and the game at `/game`
- `npm test` - runs unit tests
- `npm run lint` - runs linter
- `npm run check -- --style cozy` - dragon browser evidence; `--all` checks both styles
- `node tools/race/batch.mjs` - evaluates race outcomes over many seeded races
- `node tools/trailer/001/trailer.mjs --out <dir> --temp <dir>` - records trailer 001, the looping 1080×1920 TikTok trailer, frame by frame (defaults under `/Volumes/SLEEPTUBE/dragons-trailer/001/`)
- `node tools/sound/render.mjs --out <dir>` - renders every sound effect to a WAV for listening (defaults to `/Volumes/SLEEPTUBE/dragons-sound`)
- `npm run build` - bundles the game into one self-contained page in `dist/` (the deploy builds it too, and the server hands it out when `DIST_ROOT` is set)
- `npm run mobile` - builds and copies the page into `ios/web` and `android/app/src/main/assets/web`, then bumps the shared build number
- `npm run testflight` / `npm run testflight:setup` - archives, uploads and distributes the iOS build (`it.curzel.dragonz`); setup imports the shared account into `.env`, and `ASC_APP_ID` is set by hand
- `npm run playstore` - bundles, signs and uploads the Android release to the internal track (needs the `ANDROID_*` and `PLAY_*` keys in `.env`)
- `npm run appicon` / `npm run logo` / `npm run splash` / `npm run brand` - render the brand art with the game's own engine (`tools/brand/`): the iOS and Android app icons, `brand/logo.png` and `brand/splash.png`; `brand` renders all of them. The dragon is a fixed genome in `tools/brand/mascot.js`
- `npm run deploy` - uploads the game to the staging server p2.curzel.it (tests and lint first)

## Pages

- `index.html` (`/`) is the game, a phone-first UI: `src/app.js` routes the screens in `src/ui/screens/`
- Game rules live in `src/stable/` and stay pure: the stable is saved in `localStorage` and moved on by a game clock; races stay deterministic from their seeds
- `race.html` is the tool-link race page (`src/raceTool.js`, `src/raceScreen.js`): `race.html?course=…&race=…` (the game's `/` forwards them) races a seeded default field, exposes `window.__race` and never touches saved data
- `lab.html` is the unlinked developer lab (`src/lab.js`); only it polls `/api/progress`
- `raceMap.html` and `cameraMap.html` are diagnostics
- The game's styles live in `styles/ui/` (tokens, components, self-hosted fonts, one file per screen); `style.css` and the rest of `styles/` belong to the dev pages
- Evidence lives in `shots/<subject>/<style>/`

## Server (`server/`)

- Vanilla `node:http`, no deps, ES modules, same "one feature one file" rule as the client
- It exists because ES modules will not load off `file://`; it is just a file server, there is no online play
- `GET /status` returns uptime and rss only - keep that endpoint cheap and name-free, it's a public URL

## Coding Style and Guidelines

- One feature one file
- Usage of JSDocs for type check is greatly appreciated
- Keep comments to a BARE MINIMUM with no headers, no dangling facts, no empty openers and clean, readable, simple prose when necessary
- No third party dependencies besides musicbox, imported as `node_modules/musicbox/src/index.js`. The scene renderer is WebGL 2 with no fallback
- Scene and dragon colours come from `src/palette.js`; the game's UI colours come from `styles/ui/tokens.css`; the literal initial page background in `style.css` is the one bootstrap exception
- Files in `src/` are camelCase, matching the feature name. Exports are named, never default
- UI elements are implemented with HTML and CSS and not within the canvas
- Commit and push often

## Architecture - one feature, one file

- A "feature" is a single, self-contained responsibility - the genome, flight, the director, the renderer, a screen
- A file handling more than one feature gets split
- Two features that keep reaching into each other: push the shared bit into its own file rather than fusing them
- Shared math belongs in shared modules
- Cross-feature communication is explicit imports of named exports - no globals, no event bus until we genuinely need one
- Feature-local constants live in the feature file
- Reusable modules may not reach for `document` at import time
- Dragons, courses and races are generated from seeds. Anatomy and animation are deterministic plain data; no external assets

## Documentation

- Keep comments to a minimum, ideally none other than JSDocs type hints
- Keep AGENTS.md only for the stuff of absolute importance
- Keep `README.md` and `docs/` current when behaviour or scope changes
- A feature rationale or dev history should never end up versioned, just use the commit message when needed
