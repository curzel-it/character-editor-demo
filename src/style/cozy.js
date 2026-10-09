/** Cozy's rounding: `light` splits only the edges that visibly bulge (about 2× low-poly's triangles), `full` splits every triangle in four. */
export const cozyDetails = { light: { bulge: 0.0008 }, full: 2 };
export const styleConfig = { edge: 0, round: cozyDetails.light, soft: true, scenery: 3 };
