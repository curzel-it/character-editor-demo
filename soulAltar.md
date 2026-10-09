# Soul Altar

Dragons are creatures of magic. Eggs are not laid: they are made at the Soul Altar, the only place in
the world where that can happen, and nowhere else. Breeding as it is today goes away; the altar
replaces it. Adults that are not needed live in the wild and can be called home.

## The place

A ring of standing stones on open ground, low-poly, wide enough for people but too narrow for an
adult dragon, with an altar stone at the centre. Its custodian is an elderly man; he talks the owner through the ritual.

## The ritual

- **Parents:** two or more adults from the stable, none injured, tired or slumbering. Eggs, kids and
  teens cannot take part. The stable must have a free slot for the egg
- **Formation:** the parents circle the stones and breathe at the altar together. Their elements mix
  into fireworks coloured by the breaths in the circle; when the dust settles, the owner learns
  whether an egg lies on the altar
- **Odds:** more parents, better odds (provisional: 40% with two, +15% per extra parent, 100% at
  six). The odds are shown before the ritual starts. Deterministic: the ritual's seed decides it
- **Slumber:** every parent sleeps afterwards and cannot race, train or take part again until it
  wakes: 6 h after a success, 2 h after a failure (provisional)
- **The egg:** incubates and hatches as today

## Genes from many parents

Each parent gives part of its soul, so the egg draws from all of them:

- Every body part and colour set comes whole from one parent, picked evenly among them (or a
  mutation, as today)
- Shape genes blend across all parents with random weights, plus the usual noise
- `from` maps each trait to the parent index it came from (or null for a mutation)

More parents make an egg likelier but less predictable. A blue mother and a red father give a blue
or red chick; a blue, red, green, dark green and white circle could give almost anything. The owner
trades control over the chick for the certainty of getting one.

## The wild

- Adults can be sent to the wild: they leave the stable and free their slot at once
- Eggs, kids and teens cannot
- Calling one home takes time (provisional: 2 h of game time), since it has to fly back. Its slot
  is held from the moment it is called, the way an egg holds its slot from the moment it is made
- A swap is sending one out and calling another home
- In the wild a dragon does nothing: it cannot race, train or take part in a ritual. Its record,
  rider and lineage stay with it
- The roster lists the wild ones apart from the stable, with Call home and the time left on the way

## Screens

- **Altar** (replaces Breeding in the bottom nav): the ring of stones in 3D, the custodian, a slot per
  parent around the circle, the odds, why a pick cannot join, and Begin. The ritual plays in the scene:
  the parents land in formation, breathe, fireworks, the result
- **Stable:** Send to the wild on an adult's actions; the roster gains a Wild section with Call home
- **Profile and lineage:** a bred dragon lists every parent of its ritual, and which one each body
  part and colour set came from
- **While you were away:** parents waking, wild ones arriving home

## Work plan

Built by parallel subagents in three waves. Each task owns its files; a task that needs a file owned
by another hands the change over instead of editing it. Other sessions share the working tree, so
every agent runs `git status` first and commits with a pathspec. Visual tasks end with evidence in
`shots/` for Federico's review (1080p before/after pairs, both styles) and are not done until he
approves; browser checks run one at a time, never alongside a peer's GPU run.

### Wave 1: independent, all in parallel

Rules (pure, tested, no UI):

1. **Many-parent inheritance:** `inheritGenome(genes, parents, seed)` over a list of genomes; parts and
   colour sets picked evenly, shapes blended with random weights. `src/genome/inheritGenome.js`,
   `src/stable/egg.js` (candidates), tests
2. **Ritual rules:** `ritualBlock`, `ritualOdds`, `performRitual`, slumber and waking.
   `src/stable/soulAltar.js`, tests. Uses task 1's signature, agreed up front
3. **The wild and booked slots:** `sendToWild`, `callHome`, arrivals, and a called dragon holding its
   slot. `src/stable/wild.js`, `src/stable/stableSlots.js`, tests. Exposes `slotsFreeIfAllCalled`
   style helpers for the UI warnings

Art and animation (each with a preview route or `preview.mjs` subject so it can be reviewed alone):

4. **The custodian:** an elderly man, wizard-like: robe, staff, beard, stooped. A scene figure built
   the way the jockey is (`src/jockey/riderMesh.js`), not a new subject. Idle, a raised-staff pose
   for the ritual, and a talking pose
5. **The elder dragon:** dropped; the custodian keeps the altar alone and dragons stop at adult
6. **The trilithon:** one weathered arch (two uprights and a lintel), low-poly, seeded variation in
   lean, chips and moss so repeats do not look copied. Plus the ring layout that places N of them,
   with fallen stones and gaps, sized for people and too narrow for an adult. `src/scene/`
7. **The altar stone:** the centre slab where the egg appears, with carved channels that can glow.
   `src/scene/`
8. **Ground breath pose:** the dragon crouches low, drives the head forward and breathes at a target
   on the ground. `src/animate/`, driven by `breathAim` toward the altar
9. **Slumber pose:** the dragon curled up asleep, breathing slowly, for the stable yard and the
   profile while a parent sleeps. `src/animate/`
10. **Magical fireworks:** the parents' plumes meeting over the altar and bursting in the colours of
    the elements in the circle, then settling as dust. Builds on `src/scene/breathPlume.js` and
    `src/breath/breathElements.js`; one element to all four mixed must read differently

### Wave 2: needs wave 1's rules (tasks 1–3), in parallel

11. **The box: calling home.** The Wild section of the roster: each wild dragon with its record and
    Call home. A warning when the stable cannot take it, counting every dragon already on its way and
    every egg; when calling several, say how many fit
12. **Sending away.** Send to the wild on an adult's actions, asked once ("Ada leaves the stable; calling
    her back takes 2 h"). A second, stronger confirmation when it would leave the stable with no
    dragon at home at all
13. **Booked slot.** A stable slot held by a dragon on its way home: its thumbnail greyed or in
    flight, "on the way", and the time left, counting down with the game clock; tapping it opens
    its profile
14. **Altar screen UI:** parent slots around the circle, pick from the stable, why a pick cannot join
    (not an adult, injured, tired, slumbering, in the wild), the odds, the free-slot check for the egg,
    and Begin. `src/ui/screens/altarScreen.js`, `styles/ui/altar.css`
15. **Lineage and profile for many parents:** every parent of the ritual, and which one each part and
    colour set came from. `src/ui/screens/lineageScreen.js`, the profile sheet
16. **Slumber and arrivals elsewhere:** the slumber badge and wake time on the name plate and roster,
    the away summary's new entries (woke up, arrived home), and `advanceStable` events

### Wave 3: needs everything above

17. **The altar scene:** (done: `src/scene/altarPlace.js`, `altarCast.js`, `ritualTimeline.js`, `ritualShots.js`, `ritualShow.js`, `altarMist.js`, `src/ui/altarStage.js`, the Altar screen; evidence `tools/checks/altarShowEvidence.mjs`) the ring of trilithons, the altar, the custodian placed
    in one scene, lit and dressed, reachable from the Altar screen
18. **The ritual show:** (done: `createRitualShow`, played by the Altar screen's `playRitual`) the parents fly in and land in formation around the ring, crouch, breathe
    together, fireworks, dust, then the egg on the altar or an empty stone; the camera sequence and
    the custodian's lines. Deterministic from the ritual's seed
19. **Welcome to the altar:** (done: `src/ui/altarWelcome.js`, `stable.altarWelcomed`, replayed by `?`, More and `#/altar/welcome`) the custodian's first-visit introduction, in the style of the stable
    hand's welcome
20. **Retire breeding (done):** remove `src/stable/breeding.js`, `breedingOutlook.js`, the Breeding screen and
    its nav entry; point everything at the Altar. Update `docs/stable.md` and `README.md`

The shared files every wave touches (router in `src/app.js`, `src/ui/screens/stableHome.js`,
`src/stable/advanceStable.js`) have one owner at a time: the wave's integration task (16 in wave 2,
20 in wave 3) makes those edits and the others hand their changes to it.

## Open

- Whether egg warming (best of up to 8 candidates) stays, now that the circle is where the owner
  chooses
- Whether Release stays next to Send to the wild
- Whether the wild changes anything while away (form, schooling, fatigue recovery)
- Success odds, slumber and travel times: measure against how often an owner can race and breed
