export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
  return out;
}

export function transform(
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
) {
  const [x, y, z] = rotation;
  const a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  return new Float32Array([
    e * c * scale[0],
    f * c * scale[0],
    -d * scale[0],
    0,
    (e * d * b - f * a) * scale[1],
    (f * d * b + e * a) * scale[1],
    c * b * scale[1],
    0,
    (e * d * a + f * b) * scale[2],
    (f * d * a - e * b) * scale[2],
    c * a * scale[2],
    0,
    ...position,
    1,
  ]);
}

export function point(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function boneMatrices(anatomy, pose = { bones: {} }) {
  const byId = new Map();
  return anatomy.bones.map((bone) => {
    const delta = pose.bones?.[bone.id] || {};
    const position = bone.position.map(
      (v, i) => v + (delta.position?.[i] || 0),
    );
    const rotation = (bone.rotation || [0, 0, 0]).map(
      (v, i) => v + (delta.rotation?.[i] || 0),
    );
    const local = transform(position, rotation, delta.scale ? [delta.scale, delta.scale, delta.scale] : undefined);
    const matrix = bone.parent ? multiply(byId.get(bone.parent), local) : local;
    byId.set(bone.id, matrix);
    return matrix;
  });
}

export function camera(center, radius, aspect, yaw, pitch, zoom) {
  const view = multiply(
    transform([0, 0, 0], [pitch, yaw, 0]),
    transform(center.map((v) => -v)),
  );
  const halfH = ((radius * 1.12) / zoom) * Math.max(1, 1 / aspect);
  const halfW = halfH * aspect;
  const projection = new Float32Array([
    1 / halfW,
    0,
    0,
    0,
    0,
    1 / halfH,
    0,
    0,
    0,
    0,
    -1 / (radius * 6),
    0,
    0,
    0,
    0,
    1,
  ]);
  return multiply(projection, view);
}

export function inverseRigid(m) {
  const inverse = new Float32Array([
    m[0],
    m[4],
    m[8],
    0,
    m[1],
    m[5],
    m[9],
    0,
    m[2],
    m[6],
    m[10],
    0,
    0,
    0,
    0,
    1,
  ]);
  inverse.set(point(inverse, [-m[12], -m[13], -m[14]]), 12);
  return inverse;
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2),
    range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, 2 * near * far * range, 0,
  ]);
}

export function lookAt(eye, target, up = [0, 1, 0]) {
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const z = norm([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  let x = cross(up, z);
  if (Math.hypot(...x) < 1e-6) x = cross(Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], z);
  x = norm(x);
  const y = cross(z, x);
  const dot = (a) => a[0] * eye[0] + a[1] * eye[1] + a[2] * eye[2];
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x), -dot(y), -dot(z), 1,
  ]);
}

export function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10,
    b01 = a00 * a12 - a02 * a10,
    b02 = a00 * a13 - a03 * a10,
    b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11,
    b05 = a02 * a13 - a03 * a12,
    b06 = a20 * a31 - a21 * a30,
    b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30,
    b09 = a21 * a32 - a22 * a31,
    b10 = a21 * a33 - a23 * a31,
    b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const d = 1 / det;
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ]);
}

/** Model matrix placing a body with +X along `forward`, rolled by `bank` (positive rolls left). */
export function orientation(position, forward, bank = 0) {
  const fl = Math.hypot(forward[0], forward[1], forward[2]) || 1;
  const f = [forward[0] / fl, forward[1] / fl, forward[2] / fl];
  let l = [-f[2], 0, f[0]];
  const ll = Math.hypot(l[0], l[2]);
  l = ll < 1e-6 ? [0, 0, 1] : [l[0] / ll, 0, l[2] / ll];
  const u = [
    l[1] * f[2] - l[2] * f[1],
    l[2] * f[0] - l[0] * f[2],
    l[0] * f[1] - l[1] * f[0],
  ];
  const c = Math.cos(bank),
    s = Math.sin(bank);
  const up = u.map((v, i) => v * c + l[i] * s),
    left = l.map((v, i) => v * c - u[i] * s);
  return new Float32Array([...f, 0, ...up, 0, ...left, 0, ...position, 1]);
}
