import { lengthScale as L, speedScale as V } from "../worldScale.js";
import { nearestS, pathAt } from "./courseGeometry.js";
import { ordinal } from "./shotTypes.js";

// Gaps between racers are judged as time at racing speed, so they scale with speed.
const MIN_SPEED = 5 * V,
  PHOTO_GAP = 5 * V,
  LEAD_BATTLE_GAP = 10 * V,
  CLOSING = 0.5 * V,
  STRETCH_GAP = 20 * V,
  BATTLE_GAP = 6 * V,
  CLOSE_GAP = 12 * V,
  PACK_GAP = 12 * V,
  THERMAL_RADIUS = 25 * V,
  GATE_TOLERANCE = 5 * L;
// Broadcast time: the finish shot is up this many real seconds before the lead crossing.
const FINISH_DUE = 5,
  FINISH_NEAR = 8;
// Race time: the Froude-scaled race runs `speedScale` times slower than the reference.
const COMEBACK_WINDOW = 10 * V;
// Real seconds: a trackside camera is placed where its subject will be this long after the cut.
export const TRACKSIDE_LEAD = 2;
// A fly-by camera starts this far ahead of its subject (in seconds of its speed) and drifts
// forward at FLYBY_PACE of that speed, so the pack streams past it.
export const FLYBY_LEAD = 1.3,
  FLYBY_PACE = 0.45;
const SPRINT_EFFORT = 0.85;
// Real seconds: an overtake this close ahead is worth riding along with the passer.
const OVERTAKE_ONBOARD = 2.5;
// Real seconds: a touchdown camera is up at least this long before the feet hit the ground.
export const LANDING_LEAD = 0.6;
const touchdownWords = {
  water: "splashes down in the water",
  mud: "slides in through the mud",
  sand: "touches down in a burst of sand",
  dirt: "touches down on the run-out",
};

const gapBetween = (tick, ahead, behind) =>
  tick.byId.get(ahead).progress - tick.byId.get(behind).progress;

/** Seconds until the lead crossing, from observed data or extrapolation. */
function finishOutlook(index, t, horizon) {
  const now = index.tickAt(t);
  let winner = null,
    crossing = Infinity;
  for (const id of index.ids) {
    const c = index.crossing(id, horizon);
    if (c !== null && c < crossing) (crossing = c), (winner = id);
  }
  if (winner === null)
    for (const id of now.order) {
      const r = now.byId.get(id);
      const eta = t + (index.finishS - r.progress) / Math.max(r.speed, MIN_SPEED);
      if (eta < crossing) (crossing = eta), (winner = id);
    }
  return { winner, crossing, over: crossing <= t };
}

/**
 * Scores every shot worth taking at decision time t, using only data up to
 * index.horizon(t).
 */
export function shotCandidates(index, course, t) {
  const H = index.horizon(t),
    now = index.tickAt(t),
    window = index.ticksBetween(t, H),
    past = index.tickAt(Math.max(0, t - COMEBACK_WINDOW)),
    events = index.eventsBetween(t - 1, H),
    name = index.name;
  const active = now.order.filter((id) => !now.byId.get(id).finished);
  const list = [];
  const push = (c) => list.push(c);
  const outlook = finishOutlook(index, t, H);
  const finishDue = !outlook.over && outlook.crossing - t <= FINISH_DUE;
  const finishNear = !outlook.over && outlook.crossing - t <= FINISH_NEAR;

  if (finishNear) {
    const [a, b] = now.order;
    const known = index.crossing(b, H),
      lead = index.crossing(a, H);
    const gap = b ? gapBetween(now, a, b) : Infinity;
    const photo =
      (known !== null && lead !== null && Math.abs(known - lead) < 0.35) ||
      gap < PHOTO_GAP;
    push({
      shot: "finish",
      subject: a,
      other: b ?? null,
      score: finishDue ? 100 : 20,
      reason: photo
        ? `Photo finish looming: ${name(a)} and ${name(b)} side by side`
        : `${name(a)} powers towards the line`,
    });
  } else if (outlook.over) {
    const arriving = active.filter((id) => {
      const c = index.crossing(id, H);
      return c !== null && c - t > 1 && c - t <= 3;
    });
    if (arriving.length)
      push({
        shot: "finish",
        subject: arriving[0],
        other: arriving[1] ?? null,
        score: 5 + arriving.length,
        reason:
          arriving.length > 1
            ? `${name(arriving[0])} and ${name(arriving[1])} fight to the line`
            : `${name(arriving[0])} comes home ${ordinal(now.byId.get(arriving[0]).rank)}`,
      });
  }

  const overtakes = events.filter((e) => e.type === "overtake" && e.t > t);
  const racing = active.length && active[0] === now.order[0];
  if (racing && active.length >= 2) {
    const [lead, second] = active;
    const leadChange =
      overtakes.find((e) => e.place === 1) ??
      (window.length && window.at(-1).order[0] !== now.order[0]
        ? { racer: window.at(-1).order[0], other: now.order[0] }
        : null);
    const gaps = window.map((w) => {
      const [a, b] = w.order;
      return gapBetween(w, a, b);
    });
    const gap = gaps.length ? Math.min(...gaps) : gapBetween(now, lead, second);
    if (leadChange)
      push({
        shot: "battle",
        subject: leadChange.racer,
        other: leadChange.other,
        score: 10,
        reason: `${name(leadChange.racer)} goes for the lead against ${name(leadChange.other)}`,
      });
    else if (gap < LEAD_BATTLE_GAP) {
      const closing = gaps.length > 1 && gaps.at(-1) < gaps[0] - CLOSING;
      push({
        shot: "battle",
        subject: second,
        other: lead,
        score: 6 + ((LEAD_BATTLE_GAP - gap) / V) * 0.3,
        reason: closing
          ? `${name(second)} closes on the leader ${name(lead)}`
          : `${name(lead)} and ${name(second)} duel for the lead`,
      });
    }
    const leadGap = gapBetween(now, lead, second);
    push({
      shot: "leader",
      subject: lead,
      score: 4 + (leadGap > STRETCH_GAP ? 1 : 0),
      reason:
        leadGap > STRETCH_GAP
          ? `${name(lead)} stretches the lead`
          : `${name(lead)} leads the field`,
    });
  } else if (active.length === 1 || (active.length && !racing))
    push({
      shot: "chase",
      subject: active[0],
      score: 3,
      reason: `${name(active[0])} brings it home`,
    });

  for (let k = racing ? 2 : 1; k < Math.min(active.length, 9); k++) {
    const ahead = active[k - 1],
      behind = active[k];
    const pass = overtakes.find(
      (e) => e.racer === behind && e.other === ahead,
    );
    const gap = gapBetween(now, ahead, behind);
    if (!pass && gap > BATTLE_GAP) continue;
    const place = now.byId.get(ahead).rank;
    push({
      shot: "battle",
      subject: behind,
      other: ahead,
      score: 4.5 + (pass ? 2.5 : 0) - 0.25 * k + (Math.max(0, BATTLE_GAP - gap) / V) * 0.2,
      reason: pass
        ? `${name(behind)} moves up on ${name(ahead)} for ${ordinal(place)}`
        : `Battle for ${ordinal(place)}: ${name(ahead)} and ${name(behind)}`,
    });
  }

  for (const id of active) {
    const rank = now.byId.get(id).rank;
    const gain = past.byId.get(id).rank - rank;
    if (gain < 2 || rank === 1) continue;
    push({
      shot: "comeback",
      subject: id,
      score: 4.5 + Math.min(gain, 5) * 0.6,
      reason: `${name(id)} charges through the field, up to ${ordinal(rank)}`,
    });
  }

  for (const e of events) {
    if (!now.byId.has(e.racer) || now.byId.get(e.racer).finished) continue;
    if (e.type === "hit" && e.matchup > 1)
      push({
        shot: "chase",
        subject: e.racer,
        score: 7,
        reason: `${name(e.racer)} takes a super effective hit`,
      });
    else if (e.type === "miss")
      push({
        shot: e.t > t + 1.5 ? "gate" : "chase",
        subject: e.racer,
        gate: e.detail?.gate ?? gateIndexNear(course, index, e, now),
        score: e.t > t + 1.5 ? 7.5 : 6,
        reason: `${name(e.racer)} misses the gate`,
      });
    else if (e.type === "breath" && e.t >= t - 0.3)
      push({
        shot: "battle",
        subject: e.racer,
        other: e.other,
        score: 6,
        reason: `${name(e.racer)} breathes ${e.element} at ${name(e.other)}`,
      });
    else if (e.type === "thermal")
      push({
        shot: "aerial",
        subject: e.racer,
        group: nearby(now, e.racer, THERMAL_RADIUS),
        score: 4.5,
        reason: `${name(e.racer)} rides a thermal`,
      });
  }

  if (active.length) {
    const lead = active[0];
    const r = now.byId.get(lead);
    const gates = course.gates.slice(0, -1);
    const gate = gates.find((g) => g.s > r.progress);
    const reach = gate ? t + (gate.s - r.progress) / Math.max(r.speed, MIN_SPEED) : 0;
    if (gate && reach >= t + 1.5 && reach <= H) {
      const close =
        active.length > 1 && gapBetween(now, lead, active[1]) < CLOSE_GAP;
      push({
        shot: "gate",
        subject: lead,
        gate: gate.index,
        score: 4.5 + (close ? 1.5 : 0),
        reason: close
          ? `The leaders sweep through gate ${gate.index + 1}`
          : `${name(lead)} leads through gate ${gate.index + 1}`,
      });
    }
  }

  const packs = clusters(now, active, PACK_GAP);
  const pack = packs.sort((a, b) => b.length - a.length)[0] ?? [];

  if (!finishNear && t + TRACKSIDE_LEAD <= H) {
    const future = new Map(index.sample(t + TRACKSIDE_LEAD).racers.map((r) => [r.id, r]));
    const lead = pack.length >= 2 ? pack[0] : active[0];
    const r = lead !== undefined ? now.byId.get(lead) : null;
    const f = r && future.get(lead);
    if (f && r.speed > MIN_SPEED && !f.finished && f.progress < index.finishS - 20 * L) {
      const followers = pack.length >= 2 ? pack.length - 1 : 0;
      push({
        shot: "trackside",
        subject: lead,
        anchor: { position: f.position, forward: f.forward, s: f.progress },
        score: 4.8 + Math.min(followers, 4) * 0.4,
        reason: followers
          ? `${name(lead)} leads ${followers + 1} dragons past the trackside camera`
          : `${name(lead)} tears past at ${Math.round(r.speed * 3.6)} km/h`,
      });
    }
  }

  if (!finishNear && pack.length >= 3) {
    const subject = pack[Math.min(pack.length - 1, 1)];
    const r = now.byId.get(subject);
    const sample = index.sample(t).racers.find((q) => q.id === subject);
    if (r.speed > MIN_SPEED && sample) {
      const s0 = r.progress + r.speed * FLYBY_LEAD;
      const c = pathAt(course, nearestS(course, sample.position, r.progress));
      push({
        shot: "flyby",
        subject,
        group: pack.slice(),
        anchor: {
          s: s0,
          pace: r.speed * FLYBY_PACE,
          height: sample.position[1] - c.floor,
        },
        score: 4.8 + Math.min(pack.length, 6) * 0.25,
        reason: `The pack of ${pack.length} blasts past at ${Math.round(r.speed * 3.6)} km/h`,
      });
    }
  }

  if (!finishNear)
    for (const e of events) {
      if (e.type !== "land" || e.t < t + LANDING_LEAD || !now.byId.has(e.racer)) continue;
      const place = now.byId.get(e.racer).rank;
      push({
        shot: "landing",
        subject: e.racer,
        anchor: { position: e.position, forward: e.forward ?? [1, 0, 0], t: e.t, surface: e.surface },
        score: place === 1 ? 11 : place <= 3 ? 7.5 : 5,
        reason: `${place === 1 ? `Winner ${name(e.racer)}` : name(e.racer)} ${touchdownWords[e.surface] ?? touchdownWords.dirt}`,
      });
    }

  for (const e of index.eventsBetween(t - 3, H)) {
    if (e.type !== "kick" || !now.byId.has(e.racer) || now.byId.get(e.racer).finished) continue;
    push({
      shot: "rider",
      subject: e.racer,
      score: e.t <= t + 0.5 ? 7.5 : 5.5,
      reason: `${name(e.racer)} kicks for home`,
    });
  }
  if (racing && active.length >= 2) {
    const chaser = active[1];
    const effort = index.sample(t).racers.find((q) => q.id === chaser)?.effort ?? 0;
    const gap = gapBetween(now, active[0], chaser);
    if (gap < LEAD_BATTLE_GAP * 1.5)
      push({
        shot: "rider",
        subject: chaser,
        score: 5.4 + (Math.max(0, LEAD_BATTLE_GAP - gap) / V) * 0.25 + (effort >= SPRINT_EFFORT ? 1 : 0),
        reason:
          effort >= SPRINT_EFFORT
            ? `On ${name(chaser)}'s shoulder, flat out after ${name(active[0])}`
            : `Riding with ${name(chaser)}, hunting ${name(active[0])}`,
      });
  }
  for (const e of overtakes) {
    if (e.t > t + OVERTAKE_ONBOARD || !now.byId.has(e.other) || now.byId.get(e.racer).finished) continue;
    push({
      shot: "rider",
      subject: e.racer,
      score: 5.6 + (e.place <= 3 ? 0.6 : 0),
      reason: `Onboard with ${name(e.racer)}, drawing alongside ${name(e.other)} for ${ordinal(e.place)}`,
    });
  }
  if (racing && active.length >= 2) {
    const lead = active[0];
    const clear = gapBetween(now, lead, active[1]) > STRETCH_GAP;
    push({
      shot: "rider",
      subject: lead,
      score: 4.3 + (clear ? 0.6 : 0),
      reason: clear ? `Onboard with ${name(lead)}, clear at the front` : `Onboard with the leader, ${name(lead)}`,
    });
  }
  if (pack.length >= 4)
    push({
      shot: "aerial",
      subject: pack[pack.length >> 1],
      group: pack,
      score: 3.4 + Math.min(pack.length, 8) * 0.18,
      reason: `A pack of ${pack.length} fights through the canyon`,
    });
  else if (active.length >= 2)
    push({
      shot: "aerial",
      subject: active[0],
      group: active.slice(0, 6),
      score: 2.5,
      reason: "The field strings out along the canyon",
    });

  for (const id of active.slice(1))
    push({
      shot: "chase",
      subject: id,
      score: 2.5,
      reason: `${name(id)} holds ${ordinal(now.byId.get(id).rank)}`,
      filler: true,
    });

  if (!active.length && now.order.length) {
    push({
      shot: "aerial",
      subject: now.order[0],
      group: now.order.slice(),
      score: 2,
      reason: `The field is home. ${name(now.order[0])} takes the win`,
    });
    push({
      shot: "leader",
      subject: now.order[0],
      score: 2,
      reason: `${name(now.order[0])} celebrates the win`,
    });
  }

  return { list, finishDue, finishNear, outlook };
}

function clusters(tick, ids, threshold) {
  const out = [];
  let cur = [];
  for (const id of ids) {
    if (
      cur.length &&
      tick.byId.get(cur.at(-1)).progress - tick.byId.get(id).progress >
        threshold
    ) {
      out.push(cur);
      cur = [];
    }
    cur.push(id);
  }
  if (cur.length) out.push(cur);
  return out;
}

function nearby(tick, id, radius) {
  const p = tick.byId.get(id).progress;
  return tick.order.filter(
    (other) => Math.abs(tick.byId.get(other).progress - p) <= radius,
  );
}

function gateIndexNear(course, index, event, tick) {
  const p = tick.byId.get(event.racer).progress;
  const gate = course.gates.find((g) => g.s > p - GATE_TOLERANCE);
  return gate ? gate.index : course.gates.length - 1;
}
