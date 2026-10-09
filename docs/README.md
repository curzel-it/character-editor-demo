# Module contracts

The shared data and APIs between features. The rest of the docs build on these conventions.

Browser code uses vanilla ES modules and named exports. All anatomy, genomes and poses are plain
serialisable data and deterministic. Units are metres. Axes are right-handed: +X forward, +Y up, +Z = X × Y. Angles are radians.

- [dragon.md](dragon.md): genomes, anatomy, animation and tack
- [rendering.md](rendering.md): the dragon renderer, styles, evidence and the scene renderer
- [racing.md](racing.md): world scale, courses and the race recording
- [broadcast.md](broadcast.md): cameras, direction and race playback
- [stable.md](stable.md): the saved stable and its game rules
- [genetics.md](genetics.md): how genes, the build, stars, form and elements make a racer
- [cheats.md](cheats.md): the `__game` console helpers, such as adding a dragon of a given kind

## Ownership

| Area | Files |
| --- | --- |
| Race simulation | `src/race/*`, `tools/race/*`, `raceMap.html`, `tests/race*.test.mjs` |
| Environment and scene | `src/course/*`, `src/scene.js`, `src/scene/raceView.js`, `src/raceScreen.js`, `tests/course*.test.mjs` |
| Camera direction | `src/camera/*`, `cameraMap.html`, `tests/camera*.test.mjs` |

Changes to these areas are agreed with the other owners rather than made unilaterally. Additive helpers may go in shared
modules such as `src/math3d.js`; existing exports keep their behaviour.
