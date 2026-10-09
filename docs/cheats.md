# Console cheats

The game page exposes `window.__game` for poking at the saved stable from the browser console.
Everything here changes the real save, so a cheated stable stays cheated.

## Add a dragon

```js
__game.cheats.kinds()                 // what a kind can be: presets, standouts and each choice gene's ids
__game.cheats.addDragon(kind, options)
```

`addDragon` makes an adult of the kind, puts it in the stable (ignoring the slot limit), saves,
re-renders, selects it and returns it. `kind` is any of:

| Kind | Example | Effect |
| --- | --- | --- |
| Coat preset | `"ember"` | Scales, wings and underside of `slate`, `ember`, `emerald`, `azure`, `amethyst`, `bone`, `obsidian` or `copper` |
| Standout stat | `"topSpeed"` | Rerolls up to 500 seeds until the build's biggest share is `topSpeed`, `acceleration`, `handling`, `weight` or `breath` |
| Choice gene id | `"fire"`, `"viper"` | Sets the one gene with that id or label (case-insensitive) |
| `gene:value` | `"eyes:violet"`, `"wingspan:14"` | Sets that gene; needed when an id is shared, as colours are |
| List or spaced string | `["obsidian", "acceleration"]`, `"ember fire"` | All of them, in order |
| Object | `{ breath: "storm", feet: "webbed", standout: "handling" }` | Gene to id, label, index or (for shape genes) a number |

Rare genes work like any other: `metal` (`gold`, `silver`, `goldSilver`, `silverGold`) and `mane:element`,
whose mane takes the `breath` element and shows from the teen years on. Shape genes given as numbers are clamped to their range. An unknown or ambiguous word throws,
naming the alternatives.

`options`:

| Option | Default | |
| --- | --- | --- |
| `age` | `"adult"` | `"kid"`, `"teen"` or `"adult"` |
| `strength` | `3` | Stars, 1 to 5 |
| `name` | from the seed | |
| `seed` | fresh each call | Same seed and kind, same dragon |

```js
__game.cheats.addDragon("ember fire")
__game.cheats.addDragon("metal:silver mane:element breath:fire")   // silver, with a fire mane for spikes
__game.cheats.addDragon(["obsidian", "acceleration", "head:viper", "markings:leopard"])
__game.cheats.addDragon({ breath: "storm", standout: "handling" }, { age: "kid", strength: 5, name: "Zippy" })
```

## Other helpers

| Call | |
| --- | --- |
| `__game.game.stable` | The live stable, to read or edit by hand (then `__game.save()`) |
| `__game.tick()` | Advances the stable to now and returns the events |
| `__game.save()` | Saves the stable |
| `__game.away(ms)` | Pretends the game was closed for `ms` of real time, then returns to it |
| `__game.broadcast()` | The broadcast screen: its `race`, `seek(t)` and `script(camera)`, which films the race through `camera(race, t)` (a shot) until `script(null)` |
| `__game.ceremony()` | The awards ceremony screen: its `stage` (`seek(t)`) |
| `__game.altar()` | The Altar screen: its `stage` (`playing`, `seek(t)`, `skip()`) |

`race.html` exposes `window.__race` and `lab.html` exposes `window.__dragonz` for the check tools.
