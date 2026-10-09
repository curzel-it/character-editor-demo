const vector = (value, length = 3) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(Number.isFinite);

export function anatomyIssues(anatomy) {
  const issues = [];
  if (
    !anatomy ||
    !Array.isArray(anatomy.bones) ||
    !Array.isArray(anatomy.parts)
  )
    return ["Missing bones or parts"];
  if (anatomy.bones.length > 64)
    issues.push("Anatomy exceeds the 64-bone renderer limit");
  const bones = new Set();
  for (const bone of anatomy.bones) {
    if (!bone.id || bones.has(bone.id))
      issues.push(`Duplicate or missing bone: ${bone.id}`);
    if (bone.parent !== null && !bones.has(bone.parent))
      issues.push(`Bone ${bone.id} has a missing or later parent`);
    if (!vector(bone.position) || !vector(bone.rotation))
      issues.push(`Bone ${bone.id} has an invalid transform`);
    bones.add(bone.id);
  }
  const parts = new Set();
  for (const part of anatomy.parts) {
    if (!part.id || parts.has(part.id))
      issues.push(`Duplicate or missing part: ${part.id}`);
    parts.add(part.id);
    if (!bones.has(part.bone)) issues.push(`Part ${part.id} has no bone`);
    if (!["ellipsoid", "dome", "box", "cylinder", "cone", "mesh"].includes(part.shape))
      issues.push(`Part ${part.id} has an unknown shape`);
    for (const field of ["position", "rotation", "scale"]) {
      if (part[field] !== undefined && !vector(part[field]))
        issues.push(`Part ${part.id} has invalid ${field}`);
    }
    if (Array.isArray(part.scale) && part.scale.some((n) => n <= 0))
      issues.push(`Part ${part.id} has nonpositive scale`);
    if (!vector(part.color) || part.color.some((n) => n < 0 || n > 1))
      issues.push(`Part ${part.id} has an invalid colour`);
    if (part.shape === "mesh") {
      if (
        !Array.isArray(part.vertices) ||
        part.vertices.length < 9 ||
        part.vertices.length % 3 ||
        !part.vertices.every(Number.isFinite)
      )
        issues.push(`Mesh ${part.id} has invalid vertices`);
      if (
        !Array.isArray(part.indices) ||
        part.indices.length < 3 ||
        part.indices.length % 3 ||
        part.indices.some(
          (n) =>
            !Number.isInteger(n) ||
            n < 0 ||
            n >= (part.vertices?.length || 0) / 3,
        )
      )
        issues.push(`Mesh ${part.id} has invalid indices`);
    }
    if (
      part.colors !== undefined &&
      (part.shape !== "mesh" ||
        !Array.isArray(part.colors) ||
        part.colors.length !== part.vertices?.length ||
        part.colors.some(
          (value) => !Number.isFinite(value) || value < 0 || value > 1,
        ))
    )
      issues.push(`Part ${part.id} has invalid vertex colours`);
    if (part.skin !== undefined) {
      const count = (part.vertices?.length || 0) / 3;
      if (part.shape !== "mesh")
        issues.push(`Skinned part ${part.id} must be a mesh`);
      if (
        !Array.isArray(part.skin?.joints) ||
        part.skin.joints.length !== count ||
        part.skin.joints.some(
          (pair) =>
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            pair.some((joint) => !bones.has(joint)),
        )
      )
        issues.push(`Skinned part ${part.id} has invalid joint pairs`);
      if (
        !Array.isArray(part.skin?.weights) ||
        part.skin.weights.length !== count ||
        part.skin.weights.some(
          (weight) => !Number.isFinite(weight) || weight < 0 || weight > 1,
        )
      )
        issues.push(`Skinned part ${part.id} has invalid weights`);
      if (
        ["position", "rotation"].some(
          (field) =>
            Array.isArray(part[field]) &&
            part[field].some((value) => value !== 0),
        ) ||
        (Array.isArray(part.scale) && part.scale.some((value) => value !== 1))
      )
        issues.push(
          `Skinned part ${part.id} must have an identity rest transform`,
        );
    }
  }
  const sockets = new Set();
  for (const socket of anatomy.sockets || []) {
    if (
      !socket.id ||
      sockets.has(socket.id) ||
      !bones.has(socket.bone) ||
      !vector(socket.position)
    )
      issues.push(`Invalid socket ${socket.id}`);
    sockets.add(socket.id);
  }
  if (
    !Number.isFinite(anatomy.bounds?.radius) ||
    anatomy.bounds.radius <= 0 ||
    !vector(anatomy.bounds?.center)
  )
    issues.push("Invalid framing bounds");
  if (!anatomy.bones.length || !anatomy.parts.length)
    issues.push("Empty anatomy");
  return issues;
}

export function poseIssues(anatomy, pose) {
  if (!pose?.bones || typeof pose.bones !== "object")
    return ["Missing pose bones"];
  const ids = new Set(anatomy.bones.map((bone) => bone.id));
  const issues = [];
  for (const [id, transform] of Object.entries(pose.bones)) {
    if (!ids.has(id)) issues.push(`Unknown posed bone ${id}`);
    for (const field of ["position", "rotation"]) {
      if (transform[field] !== undefined && !vector(transform[field]))
        issues.push(`Invalid pose ${id}.${field}`);
    }
  }
  return issues;
}

export function maximumPoseDifference(a, b) {
  let distance = 0;
  for (const id of new Set([
    ...Object.keys(a.bones),
    ...Object.keys(b.bones),
  ])) {
    for (const field of ["position", "rotation"]) {
      for (let i = 0; i < 3; i++) {
        let delta =
          (a.bones[id]?.[field]?.[i] || 0) - (b.bones[id]?.[field]?.[i] || 0);
        if (field === "rotation")
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        distance = Math.max(distance, Math.abs(delta));
      }
    }
  }
  return distance;
}
