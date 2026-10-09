import { metalCoatOf } from "./genome/metalCoats.js";

export const palette = {
  background: [0.043, 0.063, 0.09],
  ground: [0.086, 0.114, 0.145],
  ink: [0.035, 0.045, 0.065],
  ivory: [0.94, 0.9, 0.78],
  dark: [0.055, 0.065, 0.083],
  steel: [0.3, 0.37, 0.43],
  glass: [0.14, 0.27, 0.32],
  gold: [0.96, 0.63, 0.22],
  sky: [0.839, 0.941, 1],
  hatchGlow: [1, 0.97, 0.86],
  // The puff an annoyed dragon snorts.
  snort: [0.93, 0.92, 0.89],
  // Warm: warmth glowing through a rubbed shell, an overheated one's steam, and the light it gives off.
  eggCare: { warm: [1, 0.6, 0.26], hot: [1, 0.34, 0.12], mote: [1, 0.8, 0.46], steam: [0.9, 0.92, 0.95], light: [1, 0.84, 0.46] },
  statusTint: { slow: [0.6, 0.8, 1], daze: [0.95, 0.9, 0.6] },
  // The light each breath element (`breathElements` ids) kindles in the altar stone's channels.
  elementGlow: { fire: [1, 0.5, 0.12], nature: [0.52, 0.95, 0.22], earth: [0.95, 0.72, 0.38], storm: [0.7, 0.58, 1], water: [0.4, 0.75, 1] },
  // Mud on a dirty dragon and the lather scrubbed out of it.
  coat: { mud: [0.42, 0.29, 0.17], foam: [0.96, 0.98, 1] },
  // The sparkle of each care action (`careActions` ids) in the yard.
  care: { feed: [1, 0.62, 0.23], play: [0.2, 0.85, 0.78], clean: [0.4, 0.66, 1], exercise: [1, 0.8, 0.25], groom: [0.8, 0.5, 1] },
  // What the keeper holds for each care action (`careActions` ids).
  careTools: {
    feed: { meat: [0.71, 0.29, 0.17], seared: [0.5, 0.19, 0.1], bone: [0.94, 0.89, 0.76] },
    play: { ball: [0.95, 0.3, 0.32], band: [1, 0.86, 0.36] },
    clean: { wood: [0.62, 0.4, 0.22], woodDark: [0.45, 0.28, 0.15], bristle: [0.93, 0.86, 0.7], sponge: [1, 0.84, 0.3], spongeScrub: [0.33, 0.62, 0.3], hose: [0.25, 0.62, 0.32], nozzle: [0.85, 0.66, 0.24], water: [0.55, 0.8, 1] },
    exercise: { pole: [0.55, 0.36, 0.2], knob: [0.96, 0.63, 0.22], cloth: [0.95, 0.42, 0.16], stripe: [0.97, 0.93, 0.82], dust: [0.86, 0.78, 0.62] },
    groom: { horn: [0.78, 0.52, 0.24] },
    fetch: { stick: [0.58, 0.4, 0.22], stickDark: [0.42, 0.27, 0.14], leaf: [0.42, 0.66, 0.26], bark: [0.4, 0.27, 0.15], heart: [0.88, 0.72, 0.46], bone: [0.96, 0.93, 0.84] },
  },
};

/** The Soul Altar's standing stones: weathered sarsen, lichen, moss, and the glow of their runes. */
export const standingStonePalette = {
  sarsen: [0.66, 0.64, 0.58],
  sarsenDark: [0.5, 0.49, 0.45],
  sarsenWarm: [0.7, 0.64, 0.53],
  lichen: [0.82, 0.82, 0.66],
  lichenGold: [0.8, 0.64, 0.28],
  moss: [0.32, 0.45, 0.18],
  mossDark: [0.2, 0.31, 0.14],
  worn: [0.62, 0.6, 0.44],
  rune: [0.55, 0.86, 1],
};

/**
 * The awards ceremony: the podium's stone and carpet, a metal per medal and division (`gold`,
 * `silver`, `bronze`) for the plates, cups and pennants, and the confetti.
 */
export const ceremonyPalette = {
  stone: [0.86, 0.82, 0.74],
  stoneDark: [0.62, 0.58, 0.52],
  carpet: [0.7, 0.13, 0.2],
  carpetEdge: [0.93, 0.74, 0.25],
  pole: [0.36, 0.25, 0.16],
  metals: { gold: [0.96, 0.75, 0.16], silver: [0.76, 0.8, 0.85], bronze: [0.8, 0.52, 0.3] },
  confetti: [[1, 0.29, 0.43], [0.18, 0.77, 0.71], [1, 0.78, 0.24], [0.23, 0.51, 0.96], [0.66, 0.33, 0.97], [0.96, 0.95, 0.92]],
};

/**
 * Breath colour ramps, hot to spent: each stop is `[r, g, b, alpha, glow]`, where glow 1 adds light
 * and 0 covers like smoke.
 */
export const breathPalette = {
  flame: [[1, 0.93, 0.62, 0.95, 0.45], [1, 0.66, 0.16, 0.95, 0.3], [0.92, 0.28, 0.08, 0.9, 0.15], [0.36, 0.2, 0.17, 0.6, 0], [0.26, 0.22, 0.22, 0, 0]],
  ember: [[1, 0.93, 0.6, 1, 1], [1, 0.5, 0.12, 0.9, 1], [0.7, 0.15, 0.05, 0, 1]],
  frost: [[1, 1, 1, 1, 0.5], [0.8, 0.95, 1, 1, 0.3], [0.5, 0.76, 1, 0.95, 0.1], [0.62, 0.82, 1, 0, 0]],
  mist: [[0.9, 0.96, 1, 0.3, 0.2], [0.8, 0.9, 1, 0.22, 0.1], [0.85, 0.93, 1, 0, 0]],
  leaf: [[0.7, 0.95, 0.36, 1, 0.2], [0.36, 0.72, 0.2, 1, 0.05], [0.22, 0.48, 0.16, 0.9, 0], [0.2, 0.36, 0.14, 0, 0]],
  thorn: [[0.62, 0.48, 0.26, 1, 0], [0.42, 0.3, 0.16, 1, 0], [0.3, 0.22, 0.12, 0, 0]],
  sand: [[0.96, 0.84, 0.6, 0.85, 0.05], [0.86, 0.7, 0.46, 0.7, 0], [0.74, 0.6, 0.42, 0, 0]],
  rock: [[0.62, 0.54, 0.46, 1, 0], [0.48, 0.42, 0.36, 1, 0], [0.4, 0.35, 0.3, 0, 0]],
  water: [[0.86, 0.96, 1, 0.95, 0.35], [0.4, 0.72, 1, 0.9, 0.15], [0.26, 0.52, 0.9, 0.6, 0.05], [0.5, 0.72, 0.95, 0, 0]],
  bolt: [[1, 1, 1, 1, 1], [0.84, 0.86, 1, 1, 1], [0.6, 0.5, 1, 0.6, 1]],
  charge: [[0.72, 0.72, 1, 0.35, 0.8], [0.52, 0.48, 1, 0.25, 0.8], [0.4, 0.3, 0.9, 0, 0.8]],
};

/**
 * Element manes per breath element, the same `[r, g, b, alpha, glow]` stops as `breathPalette`, from
 * where a tongue leaves the back to where it dies out: `body` the big tongues, `core` the bright ones
 * inside them and `bits` what flies off.
 */
export const manePalette = {
  fire: {
    body: [[1, 0.62, 0.16, 0.95, 0.3], [0.98, 0.42, 0.08, 0.9, 0.25], [0.86, 0.22, 0.06, 0.7, 0.2], [0.6, 0.12, 0.05, 0, 0.15]],
    core: [[1, 0.96, 0.66, 1, 0.6], [1, 0.8, 0.3, 0.95, 0.5], [1, 0.56, 0.14, 0, 0.4]],
    bits: [[1, 0.93, 0.6, 1, 1], [1, 0.5, 0.12, 0.9, 1], [0.7, 0.15, 0.05, 0, 1]],
  },
  water: {
    body: [[0.62, 0.9, 1, 0.9, 0.25], [0.3, 0.66, 1, 0.85, 0.2], [0.2, 0.46, 0.92, 0.7, 0.15], [0.3, 0.56, 0.95, 0, 0.1]],
    core: [[0.95, 1, 1, 0.95, 0.5], [0.66, 0.9, 1, 0.9, 0.4], [0.5, 0.8, 1, 0, 0.3]],
    bits: [[0.9, 0.98, 1, 1, 0.4], [0.5, 0.8, 1, 0.9, 0.2], [0.4, 0.7, 1, 0, 0.1]],
  },
  nature: {
    body: [[0.66, 0.95, 0.32, 0.95, 0.2], [0.38, 0.8, 0.2, 0.9, 0.15], [0.22, 0.58, 0.16, 0.75, 0.1], [0.2, 0.42, 0.14, 0, 0.05]],
    core: [[0.92, 1, 0.6, 1, 0.45], [0.7, 0.95, 0.34, 0.95, 0.35], [0.46, 0.82, 0.2, 0, 0.25]],
    bits: [[0.7, 0.95, 0.36, 1, 0.2], [0.36, 0.72, 0.2, 1, 0.05], [0.22, 0.48, 0.16, 0, 0]],
  },
  earth: {
    body: [[1, 0.84, 0.5, 0.95, 0.3], [0.92, 0.66, 0.32, 0.9, 0.2], [0.76, 0.5, 0.26, 0.75, 0.1], [0.6, 0.42, 0.26, 0, 0.05]],
    core: [[1, 0.95, 0.72, 1, 0.55], [1, 0.8, 0.44, 0.95, 0.45], [0.92, 0.64, 0.32, 0, 0.35]],
    bits: [[0.96, 0.84, 0.6, 1, 0.1], [0.74, 0.6, 0.42, 0.9, 0], [0.62, 0.54, 0.46, 0, 0]],
  },
  storm: {
    body: [[0.78, 0.7, 1, 0.9, 0.6], [0.58, 0.44, 1, 0.85, 0.55], [0.44, 0.28, 0.95, 0.7, 0.5], [0.32, 0.18, 0.8, 0, 0.45]],
    core: [[1, 1, 1, 1, 1], [0.86, 0.86, 1, 0.95, 0.9], [0.66, 0.56, 1, 0, 0.8]],
    bits: [[1, 1, 1, 1, 1], [0.84, 0.86, 1, 1, 1], [0.6, 0.5, 1, 0, 1]],
  },
};

/**
 * The Soul Altar's fireworks per breath element: `hue` tints the orb and the dust, `star` is a burst
 * star's ramp (the same `[r, g, b, alpha, glow]` stops as `breathPalette`), `spent` the ramp a
 * colour-changing star turns to. `dust` is the glitter every burst settles into.
 */
export const fireworkPalette = {
  fire: {
    hue: [1, 0.45, 0.08],
    star: [[1, 0.74, 0.32, 1, 0.6], [1, 0.5, 0.1, 1, 0.5], [0.92, 0.26, 0.05, 0.9, 0.4], [0.6, 0.1, 0.04, 0, 0.3]],
    spent: [[1, 0.46, 0.1, 1, 0.5], [0.92, 0.24, 0.05, 0.9, 0.4], [0.6, 0.1, 0.04, 0, 0.3]],
  },
  water: {
    hue: [0.3, 0.75, 1],
    star: [[0.72, 0.93, 1, 1, 0.6], [0.36, 0.76, 1, 1, 0.5], [0.2, 0.5, 1, 0.9, 0.4], [0.2, 0.3, 0.9, 0, 0.3]],
    spent: [[0.34, 0.74, 1, 1, 0.5], [0.2, 0.48, 1, 0.9, 0.4], [0.2, 0.3, 0.9, 0, 0.3]],
  },
  nature: {
    hue: [0.4, 0.95, 0.15],
    star: [[0.72, 1, 0.36, 1, 0.6], [0.42, 0.92, 0.16, 1, 0.5], [0.3, 0.68, 0.14, 0.9, 0.4], [0.16, 0.5, 0.12, 0, 0.3]],
    spent: [[0.4, 0.9, 0.16, 1, 0.5], [0.26, 0.66, 0.14, 0.9, 0.4], [0.16, 0.5, 0.12, 0, 0.3]],
  },
  earth: {
    hue: [0.95, 0.66, 0.3],
    star: [[1, 0.88, 0.6, 1, 0.6], [0.95, 0.7, 0.36, 1, 0.5], [0.8, 0.52, 0.26, 0.9, 0.4], [0.56, 0.36, 0.2, 0, 0.3]],
    spent: [[0.95, 0.7, 0.36, 1, 0.5], [0.8, 0.52, 0.26, 0.9, 0.4], [0.56, 0.36, 0.2, 0, 0.3]],
  },
  storm: {
    hue: [0.6, 0.42, 1],
    star: [[0.72, 0.6, 1, 1, 0.6], [0.58, 0.4, 1, 1, 0.5], [0.48, 0.28, 1, 0.9, 0.45], [0.36, 0.16, 0.86, 0, 0.3]],
    spent: [[0.6, 0.44, 1, 1, 0.55], [0.46, 0.26, 1, 0.9, 0.45], [0.36, 0.16, 0.86, 0, 0.3]],
  },
  dust: [[1, 0.94, 0.7, 1, 0.65], [1, 0.8, 0.38, 0.9, 0.55], [0.95, 0.6, 0.3, 0, 0.4]],
  flash: [1, 0.95, 0.84],
};

export const environment = {
  skyZenith: [0.2, 0.36, 0.58],
  skyHorizon: [0.95, 0.77, 0.58],
  sun: [1, 0.87, 0.64],
  ridge: [0.58, 0.5, 0.6],
  haze: [0.86, 0.8, 0.74],
  fogRange: 3200,
  fogStart: 2500,
  grade: { exposure: 0.6, curve: 0.6, saturation: 1.1, warm: [0.03, 0.012, -0.02], cool: [-0.015, 0, 0.03] },
  fill: [0.56, 0.68, 0.92],
  bounce: [0.95, 0.6, 0.38],
  // Baked sun shadow: `sun` is the direct light left in shadow, `fill` the extra ambient shadows get.
  // The canyon lifts both so the lee walls it races along do not read as one dark mass.
  shadowLift: { sun: 0.6, fill: 1.1 },
  strata: [
    [0.7, 0.36, 0.22],
    [0.8, 0.5, 0.31],
    [0.87, 0.7, 0.52],
    [0.58, 0.3, 0.24],
    [0.76, 0.43, 0.27],
    [0.66, 0.52, 0.47],
  ],
  sand: [0.88, 0.71, 0.5],
  mesa: [0.8, 0.58, 0.38],
  scrub: [0.5, 0.52, 0.32],
  capRock: [0.45, 0.27, 0.22],
  gate: [1, 0.72, 0.24],
  // Gameplay reads brighter and cleaner than scenery. Emissive surfaces: `gain` and `saturation` over
  // their colour, `clear` the share of fog they shed. Bloom: `halo` its strength, screened over the graded image,
  // `reach` the blur's tap spacing, `distant` the extra glow far hoops get so they carry.
  glow: { gain: 0.9, saturation: 1.35, clear: 0.7, halo: 0.6, reach: 1, distant: 3 },
  // Lakes and rivers (the canyon has none; its set only keeps the keys whole). The body runs from `shallow`
  // at the shore to `deep` over `shallowDepth` (reference metres) of water, with a `foam` band where it is under
  // `foamDepth`. Sky reflection, tinted by `sky`, rises by `fresnel` [straight down, grazing, power]; `peak` caps
  // the water's luminance below the hoops'. Sun glitter: `facet` (reference metres) triangles tilted by up to `tilt`,
  // `glitter` [gain, power] on near facets and `farGlitter` [gain, power] where they blend into a soft path.
  waterSurface: {
    deep: [0.1, 0.3, 0.46],
    shallow: [0.26, 0.54, 0.56],
    foam: [0.9, 0.94, 0.92],
    sky: [0.8, 0.88, 0.98],
    fresnel: [0.06, 0.75, 3],
    peak: 0.72,
    facet: 9,
    tilt: 0.11,
    glitter: [1, 150],
    farGlitter: [0.4, 30],
    shallowDepth: 3,
    foamDepth: 0.5,
  },
  // Receding mountain ranges on the far landscape (null: the canyon keeps its rolling mesa plain). Each range is
  // [distance past the course edge, crest height, half width] in reference metres; its crest wanders by `wobble` and
  // its peaks drop to `saddle` of the crest between summits `peakSpacing` apart. Fog makes each farther range paler
  // and bluer; their colour also loses up to `fade` of its saturation toward a grey tinted by `cool` and brightens to at least
  // `floor` luminance (no dark forest far off), then pales by up to `lift` toward `mist`, fully from the second range
  // on, and the shader evens out up to `flatten` of their facet shading so far slopes read light and low in contrast. Land cover climbs with the ranges so the snow sits at `snowline` there,
  // capping only the far peaks. `hills` scales the rolling land in front of the ranges (1 when unset).
  backdrop: null,
  finishLight: [0.97, 0.95, 0.88],
  finishDark: [0.09, 0.1, 0.13],
  start: [0.65, 0.89, 0.59],
  thermal: [1, 0.93, 0.78],
  shadow: [0.22, 0.12, 0.16],
  vignette: 0.28,
  // The ground curving away from the camera: `strength` metres of drop per square metre of distance, easing off
  // past `reach` metres (0: flat).
  bend: { strength: 0, reach: 0 },
  rim: [0.8, 0.9, 1],
  halo: [1, 0.97, 0.9],
  airMote: [1, 0.93, 0.8],
  vapour: [1, 0.98, 0.94],
  splash: {
    water: [[0.93, 0.97, 1], [0.62, 0.8, 0.9]],
    mud: [[0.3, 0.21, 0.13], [0.42, 0.31, 0.19]],
    sand: [[0.9, 0.74, 0.52], [0.8, 0.6, 0.4]],
    dirt: [[0.45, 0.33, 0.21], [0.4, 0.55, 0.24]],
    dust: [0.93, 0.8, 0.62],
  },
};

// Keys the valley does not override fall back to the canyon set.
const valley = {
  ...environment,
  skyZenith: [0.25, 0.47, 0.8],
  skyHorizon: [0.8, 0.88, 0.95],
  sun: [1, 0.95, 0.84],
  ridge: [0.5, 0.59, 0.72],
  haze: [0.68, 0.79, 0.92],
  fill: [0.62, 0.73, 0.94],
  bounce: [0.5, 0.6, 0.36],
  shadowLift: { sun: 0.28, fill: 0.4 },
  glow: { ...environment.glow, halo: 0.5 },
  strata: [
    [0.68, 0.64, 0.58],
    [0.74, 0.7, 0.62],
    [0.63, 0.6, 0.56],
    [0.71, 0.66, 0.56],
    [0.6, 0.57, 0.54],
    [0.77, 0.73, 0.64],
  ],
  capRock: [0.6, 0.57, 0.54],
  backdrop: {
    ranges: [
      [1900, 1150, 1100],
      [4000, 1800, 1500],
      [6700, 2700, 2000],
    ],
    wobble: 700,
    saddle: 0.45,
    peakSpacing: 1400,
    snowline: 1250,
    fade: 0.8,
    cool: [0.9, 0.97, 1.1],
    mist: [0.78, 0.85, 0.94],
    lift: 0.55,
    floor: 0.5,
    flatten: 0.8,
  },
  thermal: [1, 0.97, 0.86],
  shadow: [0.1, 0.17, 0.12],
  grass: [0.44, 0.68, 0.3],
  meadow: [0.62, 0.78, 0.38],
  fields: [
    [0.92, 0.82, 0.5],
    [0.58, 0.76, 0.34],
    [0.82, 0.72, 0.5],
    [0.78, 0.86, 0.48],
  ],
  forestFloor: [0.4, 0.62, 0.34],
  conifer: [0.3, 0.58, 0.38],
  coniferDark: [0.25, 0.5, 0.35],
  broadleaf: [0.46, 0.7, 0.32],
  broadleafLight: [0.56, 0.76, 0.34],
  trunk: [0.5, 0.36, 0.26],
  rock: [0.7, 0.68, 0.65],
  scree: [0.78, 0.75, 0.7],
  snow: [0.95, 0.97, 1],
  water: [0.36, 0.66, 0.78],
  bank: [0.84, 0.8, 0.64],
  stone: [0.86, 0.82, 0.74],
  stoneDark: [0.7, 0.67, 0.6],
  slate: [0.42, 0.48, 0.6],
  roof: [0.86, 0.48, 0.36],
  banner: [0.8, 0.15, 0.17],
  bannerAlt: [0.96, 0.8, 0.24],
  timber: [0.55, 0.4, 0.3],
  plaster: [0.93, 0.88, 0.76],
  doorway: [0.22, 0.18, 0.18],
  dirt: [0.88, 0.79, 0.6],
  hay: [0.95, 0.84, 0.5],
  waterSurface: { ...environment.waterSurface, deep: [0.2, 0.5, 0.66], shallow: [0.4, 0.74, 0.76] },
  splash: { ...environment.splash, dust: [0.86, 0.82, 0.72] },
};

// The Soul Altar's meadow at dusk: the valley's land under a low warm sun and a deepening sky, so its
// magic reads. `sunDir` (a unit vector towards the sun) replaces the scenes' one sun.
const dusk = {
  ...valley,
  sunDir: (() => {
    const d = [-0.8, 0.27, 0.52],
      l = Math.hypot(...d);
    return d.map((v) => v / l);
  })(),
  skyZenith: [0.13, 0.16, 0.36],
  skyHorizon: [0.96, 0.6, 0.42],
  sun: [1, 0.72, 0.46],
  ridge: [0.4, 0.34, 0.5],
  haze: [0.7, 0.55, 0.58],
  fill: [0.6, 0.6, 0.84],
  bounce: [0.66, 0.5, 0.36],
  rim: [1, 0.8, 0.62],
  halo: [1, 0.9, 0.8],
  shadow: [0.12, 0.1, 0.2],
  grade: { exposure: 0.7, curve: 0.6, saturation: 1.12, warm: [0.04, 0.012, -0.025], cool: [-0.01, 0, 0.04] },
  glow: { ...valley.glow, halo: 0.75 },
  backdrop: {
    ...valley.backdrop,
    ranges: [
      [2600, 520, 1100],
      [4600, 900, 1500],
      [7000, 1500, 2000],
    ],
    snowline: 700,
    cool: [0.95, 0.9, 1.08],
    mist: [0.56, 0.5, 0.68],
  },
};

// The stable yard on a clear late morning: a warm sun from over the camera's right shoulder lights
// the barn front and the dragon's face, under a deep blue sky with soft haze on the far ranges.
const yard = {
  ...valley,
  sunDir: (() => {
    const d = [0.55, 0.62, 0.62],
      l = Math.hypot(...d);
    return d.map((v) => v / l);
  })(),
  skyZenith: [0.22, 0.48, 0.86],
  skyHorizon: [0.86, 0.91, 0.95],
  sun: [1, 0.9, 0.72],
  haze: [0.74, 0.83, 0.93],
  fogRange: 6000,
  fogStart: 1500,
  fill: [0.64, 0.74, 0.94],
  bounce: [0.62, 0.56, 0.36],
  shadowLift: { sun: 0.38, fill: 0.45 },
  grade: { exposure: 0.66, curve: 0.6, saturation: 1.14, warm: [0.035, 0.014, -0.02], cool: [-0.012, 0, 0.03] },
  glow: { ...valley.glow, halo: 0.55 },
  backdrop: {
    ...valley.backdrop,
    ranges: [],
    hills: 0.1,
    saddle: 0.15,
    peakSpacing: 500,
    snowline: 560,
    fade: 0.25,
    lift: 0.1,
    floor: 0.35,
    flatten: 0.2,
    mist: [0.48, 0.56, 0.74],
  },
  // The sky's painted far ridges, scaled away so only the yard's own peaks stand on the horizon.
  skyRidges: 0,
  // Land cover's treeline and snowline (reference metres), low so the yard's small peaks wear rock and snow.
  treeline: 32,
  snowline: 88,
  rock: [0.55, 0.57, 0.63],
  scree: [0.66, 0.67, 0.71],
  capRock: [0.48, 0.5, 0.57],
  strata: [
    [0.52, 0.54, 0.6],
    [0.68, 0.68, 0.7],
    [0.44, 0.46, 0.53],
    [0.62, 0.6, 0.6],
    [0.48, 0.5, 0.57],
    [0.72, 0.71, 0.72],
  ],
  grass: [0.46, 0.7, 0.32],
  meadow: [0.62, 0.78, 0.38],
  blades: [
    [0.48, 0.72, 0.32],
    [0.58, 0.8, 0.38],
    [0.42, 0.66, 0.3],
    [0.66, 0.82, 0.4],
  ],
  blooms: [
    [0.98, 0.96, 0.9],
    [1, 0.84, 0.3],
    [0.96, 0.58, 0.68],
    [0.66, 0.6, 0.94],
  ],
  bush: [0.4, 0.64, 0.32],
  bushLight: [0.5, 0.72, 0.34],
  plank: [0.8, 0.6, 0.4],
  plankDark: [0.68, 0.5, 0.34],
  plankPale: [0.88, 0.72, 0.5],
  beam: [0.6, 0.42, 0.3],
  tile: [0.88, 0.5, 0.38],
  tileDark: [0.74, 0.4, 0.32],
  awning: [0.84, 0.46, 0.34],
  awningDark: [0.94, 0.86, 0.72],
  footing: [0.78, 0.75, 0.7],
  footingDark: [0.64, 0.62, 0.6],
  banner: [0.48, 0.16, 0.24],
  emblem: [0.96, 0.84, 0.62],
  iron: [0.4, 0.38, 0.42],
  lantern: [1, 0.78, 0.42],
  glass: [0.4, 0.46, 0.52],
  hay: [0.92, 0.78, 0.42],
  hayDark: [0.86, 0.72, 0.42],
  dirt: [0.92, 0.82, 0.62],
  dirtDark: [0.84, 0.72, 0.54],
  pebble: [0.8, 0.77, 0.72],
  cloud: [1, 1, 1],
  cloudShade: [0.86, 0.9, 0.97],
};

/** Environment colour sets per course type; `environment` stays the canyon default. */
export const environments = { canyon: environment, valley, dusk, yard };

/** A course's colour set: its own `environment` id when it names one, else its type's. */
export const environmentOf = (course) => environments[course?.environment ?? course?.type] ?? environment;

// Cozy lights every place like a toy diorama: open shadows tinted cool, a crisp saturated grade and a light vignette.
const cozyLight = {
  grade: { exposure: 0.52, curve: 0.75, saturation: 1.14, warm: [0.02, 0.01, -0.012], cool: [-0.01, -0.004, 0.02] },
  shadowLift: { sun: 0.42, fill: 0.4 },
  shadow: [0.22, 0.23, 0.36],
  vignette: 0.18,
};
const cozyPlaces = new Map([[yard, { bend: { strength: 0.004, reach: 120 } }]]);
const cozySets = new Map();

/** `environment` as the Cozy style lights it. */
export function cozyEnvironment(environment) {
  if (!cozySets.has(environment)) cozySets.set(environment, { ...environment, ...cozyLight, ...cozyPlaces.get(environment) });
  return cozySets.get(environment);
}

export function pigment(hue, saturation = 0.55, lightness = 0.5) {
  const a = saturation * Math.min(lightness, 1 - lightness);
  return [0, 8, 4].map((n) => {
    const k = (n + (((hue % 1) + 1) % 1) * 12) % 12;
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  });
}

export const tint = (rgb, factor) =>
  rgb.map((v) => Math.min(1, Math.max(0, v * factor)));

/** The named colours a dragon's scales, wings and underside each pick one of. */
export const dragonColours = [
  { id: "crimson", label: "Crimson", hex: "#B3263A" },
  { id: "ember", label: "Ember", hex: "#D9482B" },
  { id: "rust", label: "Rust", hex: "#A8532E" },
  { id: "coral", label: "Coral", hex: "#E8735A" },
  { id: "tangerine", label: "Tangerine", hex: "#EE8A2E" },
  { id: "amber", label: "Amber", hex: "#D9962B" },
  { id: "gold", label: "Gold", hex: "#D4AF37" },
  { id: "sand", label: "Sand", hex: "#D8C08A" },
  { id: "lime", label: "Lime", hex: "#9CC43C" },
  { id: "moss", label: "Moss", hex: "#6E8B3D" },
  { id: "fern", label: "Fern", hex: "#4E9A52" },
  { id: "jade", label: "Jade", hex: "#2E9E7A" },
  { id: "forest", label: "Forest", hex: "#2F5E3A" },
  { id: "mint", label: "Mint", hex: "#8FD3B6" },
  { id: "teal", label: "Teal", hex: "#2A8C8C" },
  { id: "turquoise", label: "Turquoise", hex: "#3CB4B4" },
  { id: "sky", label: "Sky", hex: "#6BAED6" },
  { id: "azure", label: "Azure", hex: "#3B7DD8" },
  { id: "cobalt", label: "Cobalt", hex: "#2A4FA8" },
  { id: "navy", label: "Navy", hex: "#22325E" },
  { id: "steel", label: "Steel", hex: "#5E7A8F" },
  { id: "violet", label: "Violet", hex: "#7A4FB8" },
  { id: "plum", label: "Plum", hex: "#6B2F5E" },
  { id: "lavender", label: "Lavender", hex: "#A894D0" },
  { id: "rose", label: "Rose", hex: "#D46A8A" },
  { id: "magenta", label: "Magenta", hex: "#B8327A" },
  { id: "ivory", label: "Ivory", hex: "#EAE2CF" },
  { id: "ash", label: "Ash", hex: "#9A9A96" },
  { id: "slate", label: "Slate", hex: "#4E5560" },
  { id: "black", label: "Black", hex: "#1C1C20" },
  { id: "bronze", label: "Bronze", hex: "#8C6A3A" },
  { id: "chocolate", label: "Chocolate", hex: "#5C3A26" },
];

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const colourRgb = dragonColours.map((colour) => hexRgb(colour.hex));

/** The RGB of the named colour a colour gene's `value` picks. */
export const colourOf = (value) => colourRgb[Math.max(0, Math.min(colourRgb.length - 1, Math.floor(value) || 0))];

/** The index of the named colour `id`. */
export const colourIndex = (id) => dragonColours.findIndex((colour) => colour.id === id);

const coat = (scales, wings, underside) => ({ scales: colourIndex(scales), wings: colourIndex(wings), underside: colourIndex(underside) });

export const dragonPalettes = [
  { id: "slate", label: "Slate", genes: coat("slate", "chocolate", "ash") },
  { id: "ember", label: "Ember", genes: coat("ember", "crimson", "sand") },
  { id: "emerald", label: "Emerald", genes: coat("fern", "lime", "mint") },
  { id: "azure", label: "Azure", genes: coat("azure", "turquoise", "ivory") },
  { id: "amethyst", label: "Amethyst", genes: coat("violet", "rose", "lavender") },
  { id: "bone", label: "Bone", genes: coat("sand", "bronze", "ivory") },
  { id: "obsidian", label: "Obsidian", genes: coat("black", "crimson", "slate") },
  { id: "copper", label: "Copper", genes: coat("rust", "chocolate", "amber") },
];

/**
 * Iris colours for the `eyes` choice gene, bright enough for the ink pupil to read; `weight` makes
 * the rarer ones turn up less often.
 */
export const dragonEyes = [
  { id: "gold", label: "Gold", hue: 0.1, saturation: 0.72, lightness: 0.55, weight: 4 },
  { id: "amber", label: "Amber", hue: 0.065, saturation: 0.72, lightness: 0.48, weight: 3 },
  { id: "jade", label: "Jade", hue: 0.29, saturation: 0.5, lightness: 0.47, weight: 2 },
  { id: "ice", label: "Ice", hue: 0.545, saturation: 0.52, lightness: 0.65, weight: 2 },
  { id: "blood", label: "Blood", hue: 0, saturation: 0.67, lightness: 0.47, weight: 1 },
  { id: "violet", label: "Violet", hue: 0.775, saturation: 0.48, lightness: 0.63, weight: 1 },
  { id: "moonstone", label: "Moonstone", hue: 0.58, saturation: 0.2, lightness: 0.83, weight: 1 },
];

const eyeContrast = 0.4;
const colorDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The iris colour an `eyes` gene value picks. An iris too close to the `skin` around it is lightened,
 * or deepened and saturated, by the smallest step that makes it stand out (the dark way first on a
 * light head), else the step that sets it furthest apart.
 */
export function eyeColor(value, skin) {
  const { hue, saturation, lightness } = dragonEyes[Math.max(0, Math.min(dragonEyes.length - 1, Math.floor(value) || 0))];
  const iris = pigment(hue, saturation, lightness);
  if (!skin || colorDistance(iris, skin) >= eyeContrast) return iris;
  const lighter = (step) => pigment(hue, saturation, Math.min(0.9, lightness + step * 0.035));
  const deeper = (step) => pigment(hue, Math.max(0.7, saturation), Math.max(0.4, lightness - step * 0.04));
  const ways = luminance(skin) < 0.45 ? [lighter, deeper] : [deeper, lighter];
  let best = iris;
  for (let step = 1; step <= 12; step++)
    for (const way of ways) {
      const candidate = way(step);
      if (colorDistance(candidate, skin) >= eyeContrast) return candidate;
      if (colorDistance(candidate, skin) > colorDistance(best, skin)) best = candidate;
    }
  return best;
}

/**
 * The metallic coats' colours per metal: `scales`, `wings` and `underside` for the parts, `sheen` the
 * pale light running over the metal and `shadow` the deep tone it falls to where it turns from the light.
 */
export const metalPalette = {
  gold: { scales: [0.85, 0.62, 0.2], wings: [0.78, 0.53, 0.16], underside: [0.95, 0.78, 0.38], sheen: [1, 0.96, 0.74], shadow: [0.36, 0.19, 0.04] },
  silver: { scales: [0.66, 0.69, 0.74], wings: [0.58, 0.62, 0.68], underside: [0.82, 0.84, 0.87], sheen: [1, 1, 1], shadow: [0.21, 0.23, 0.28] },
};

export function dragonColors(g) {
  const coat = metalCoatOf(g.metal);
  const skin = coat ? metalPalette[coat.body].scales : colourOf(g.scales);
  const membrane = coat ? metalPalette[coat.wings].wings : colourOf(g.wings),
    under = coat ? metalPalette[coat.body].underside : colourOf(g.underside);
  return { eye: eyeColor(g.eyes, skin), skin, membrane, under };
}

export function applyPalette() {
  const colors = {
    bg: palette.background,
    panel: [0.071, 0.09, 0.122],
    edge: [0.16, 0.2, 0.25],
    text: [0.9, 0.93, 0.95],
    muted: [0.53, 0.61, 0.67],
    accent: [0.65, 0.89, 0.59],
    amber: palette.gold,
    danger: [0.95, 0.4, 0.36],
  };
  for (const [name, rgb] of Object.entries(colors))
    document.documentElement.style.setProperty(
      `--${name}`,
      `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")})`,
    );
}
