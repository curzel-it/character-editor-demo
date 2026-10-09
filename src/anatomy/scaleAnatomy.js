const scaled = (v, k) => v.map((x) => x * k);

export function scaleAnatomy(anatomy, k) {
  return {
    ...anatomy,
    bones: anatomy.bones.map((b) => ({ ...b, position: scaled(b.position, k) })),
    parts: anatomy.parts.map((p) => ({
      ...p,
      ...(p.position ? { position: scaled(p.position, k) } : {}),
      ...(p.vertices
        ? { vertices: scaled(p.vertices, k) }
        : p.scale
          ? { scale: scaled(p.scale, k) }
          : {}),
    })),
    ...(anatomy.mane
      ? { mane: { ...anatomy.mane, anchors: anatomy.mane.anchors.map((a) => ({ ...a, p: scaled(a.p, k), height: a.height * k })) } }
      : {}),
    sockets: anatomy.sockets.map((s) => ({ ...s, position: scaled(s.position, k) })),
    addons: (anatomy.addons || []).map((a) => ({
      ...a,
      keepClear: a.keepClear.map((zone) => ({ center: scaled(zone.center, k), radius: zone.radius * k })),
    })),
    bounds: {
      radius: anatomy.bounds.radius * k,
      center: scaled(anatomy.bounds.center, k),
    },
  };
}
