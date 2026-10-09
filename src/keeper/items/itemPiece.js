/** Where a handle sits in the keeper's fist, [x, y] on the hand bone; it runs across the palm along Z. */
export const GRIP = [0.082, -0.032];

/** The rotation that lays a cylinder (along Y) across the palm, along Z. */
export const ACROSS = [Math.PI / 2, 0, 0];

/** A primitive part (`box`, `ellipsoid`, `cylinder`, `cone`, half sizes in `scale`) on the keeper's hand bone. */
export const piece = (id, shape, position, scale, color, rotation = [0, 0, 0]) => ({ id: `keeper-${id}`, bone: "hand", shape, position, rotation, scale, color, segments: 10 });
