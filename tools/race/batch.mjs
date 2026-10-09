import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { genes } from "../../src/genome/dragon.js";
import { makeGenome } from "../../src/subjects.js";
import { simulateRace } from "../../src/race/simulateRace.js";
import { raceGeometry } from "../../src/race/raceGeometry.js";
import { windingCourse } from "../../src/race/windingCourse.js";
import { scaleCourse } from "../../src/race/scaleCourse.js";
import { froude } from "../../src/race/froude.js";
import { breathOf } from "../../src/breath/breathElements.js";
import { dragonLegShapes } from "../../src/anatomy/dragonLegVariants.js";
import { leagueForAge } from "../../src/stable/leagues.js";
import { createRaceSim } from "../../src/race/raceSim.js";
import { createScriptedRider } from "./scriptedRider.mjs";
import { makeRng } from "../../src/rng.js";
import { handicap } from "../../src/race/handicap.js";
import { standout } from "../../src/dragonBuild.js";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const races = Number(option("races", 200)),
  fieldSize = Number(option("field", 8)),
  courseCount = Number(option("courses", 8)),
  source = option("course", "real"),
  courseModule = option("course-module", "src/course/createCourse.js"),
  courseType = option("type"),
  scaleReference = args.includes("--scale-course"),
  age = option("age"),
  share = Number(option("share", leagueForAge(age ?? "adult")?.courseShare ?? 1)),
  care = option("care") === undefined ? null : Number(option("care")),
  strength = Number(option("strength", 3)),
  spread = Number(option("spread", 0)),
  owner = option("owned") === undefined ? null : Number(option("owned"));
// With --season <league>, a new stable's starters race seasons of that league instead (--seasons in a row, moving division).
if (args.includes("--season")) {
  const { printSeasons } = await import("./seasonScenario.mjs");
  printSeasons({ league: option("season", "kids"), division: option("division", "bronze"), stables: Number(option("stables", 8)), care: care ?? 1, seasons: Number(option("seasons", 1)), perDay: Number(option("per-day", 4)), stars: Number(option("stars", 1)) });
  process.exit(0);
}
// Every racer is --strength stars, give or take a seeded --spread; with --owned, one racer per race, in turn round the grid, is an owned dragon of that many stars.
const owned = { places: 0, wins: 0, podiums: 0, last: 0 };
// With --rider, that racer is also flown by a scripted rider and compared with Autopilot; --steer picks how it steers and --breath when it breathes.
const rider = args.includes("--rider");
const ownedRacer = owner !== null || rider;
const ridden = { places: 0, wins: 0, podiums: 0, last: 0, misses: 0, time: 0, finished: 0, auto: { misses: 0, time: 0, finished: 0 }, better: 0, worse: 0 };
// Courses shorter than this are still at the reference (pre-Froude) scale.
const referenceLimit = 5000;

const { createCourse } = await import(pathToFileURL(resolve(courseModule)).href);
let enlarged = 0;
function realCourse(seed) {
  const course = createCourse(seed, { type: courseType, share });
  if (!scaleReference || course.length >= referenceLimit) return course;
  enlarged++;
  return scaleCourse(course, froude.length);
}
const courses = Array.from({ length: courseCount }, (_, i) =>
  source === "winding" || (source === "both" && i % 2)
    ? windingCourse(`batch-${i}`)
    : realCourse(`batch-${i}`),
);
if (scaleReference && !enlarged)
  console.log("Note: --scale-course found no reference-scale course; courses used as generated.");
const geometry = courses.map(raceGeometry);
const shapeGenes = genes.filter((g) => g.group !== "color" && !g.choices).map((g) => g.name);
const statKeys = ["topSpeed", "acceleration", "handling", "weight", "breath"];
const rating = handicap;

const leadChanges = [],
  margins = [],
  spreads = [],
  durations = [],
  winnerSpeeds = [],
  airborne = [],
  byLegs = {},
  rows = [];
const T = froude.time,
  photo = 0.3 * T;
let notLeadingHalf = 0,
  notLeading75 = 0,
  favouriteWins = 0,
  favouritePlaces = 0,
  dnf = 0,
  misses = 0,
  hitCount = 0,
  bumps = 0,
  violations = { side: 0, floor: 0, ceiling: 0, terrain: 0 };
const winnerForm = {};
const started = performance.now();

for (let r = 0; r < races; r++) {
  const c = r % courses.length,
    course = courses[c],
    { corridor, finishS } = geometry[c];
  const roster = Array.from({ length: fieldSize }, (_, i) => ({
    id: `r${r}-${i}`,
    name: `Racer ${i + 1}`,
    subject: "dragon",
    genome: makeGenome(genes, `batch:${r}:${i}`),
    strength: Math.max(1, Math.min(5, strength + spread * (2 * makeRng(`batch:${r}:${i}:strength`)() - 1))),
    ...(age ? { age: age === "mixed" ? ["kid", "teen", "adult"][i % 3] : age } : {}),
  }));
  if (owner !== null) roster[r % fieldSize].strength = owner;
  const rec = simulateRace({ seed: `batch-race-${r}`, course, roster });
  leadChanges.push(
    rec.events.filter((e) => e.type === "overtake" && e.place === 1 && e.t >= 5 * T).length,
  );
  const leaderAt = (fraction) => {
    const frame = rec.frames.find((f) => f.racers.some((x) => x.progress >= finishS * fraction));
    return frame.racers.find((x) => x.place === 1).id;
  };
  const winner = rec.results[0];
  if (ownedRacer) {
    const { place } = rec.results.find((x) => x.id === roster[r % fieldSize].id);
    owned.places += place;
    owned.wins += place === 1 ? 1 : 0;
    owned.podiums += place <= 3 ? 1 : 0;
    owned.last += place === fieldSize ? 1 : 0;
  }
  if (rider) {
    const id = roster[r % fieldSize].id;
    const scripted = createScriptedRider({ steer: option("steer", "none"), breath: option("breath", "smart") });
    const sim = createRaceSim({ seed: `batch-race-${r}`, course, roster, pilots: { [id]: scripted.pilot } });
    while (!sim.done) sim.step();
    const tally = (recording, into) => {
      const result = recording.results.find((x) => x.id === id);
      into.misses += recording.events.filter((e) => e.racer === id && e.type === "miss").length;
      if (result.time !== null) {
        into.time += result.time;
        into.finished++;
      }
      return result.place;
    };
    const auto = tally(rec, ridden.auto);
    const place = tally(sim.recording, ridden);
    ridden.places += place;
    ridden.wins += place === 1 ? 1 : 0;
    ridden.podiums += place <= 3 ? 1 : 0;
    ridden.last += place === fieldSize ? 1 : 0;
    ridden.better += place < auto ? 1 : 0;
    ridden.worse += place > auto ? 1 : 0;
  }
  if (leaderAt(0.5) !== winner.id) notLeadingHalf++;
  if (leaderAt(0.75) !== winner.id) notLeading75++;
  const finished = rec.results.filter((x) => x.time !== null);
  dnf += rec.results.length - finished.length;
  if (finished.length > 1) {
    margins.push(finished[1].time - finished[0].time);
    spreads.push(finished.at(-1).time - finished[0].time);
  }
  durations.push(finished[0].time);
  winnerSpeeds.push((finishS - corridor.start) / finished[0].time);
  const ratings = rec.roster.map((e) => rating(e.stats));
  const favourite = rec.roster[ratings.indexOf(Math.max(...ratings))].id;
  const favouritePlace = rec.results.find((x) => x.id === favourite).place;
  if (favouritePlace === 1) favouriteWins++;
  favouritePlaces += favouritePlace;
  const form = rec.roster.find((e) => e.id === winner.id).form;
  winnerForm[form] = (winnerForm[form] || 0) + 1;
  misses += rec.events.filter((e) => e.type === "miss").length;
  bumps += rec.events.filter((e) => e.type === "bump").length;
  const hits = rec.events.filter((e) => e.type === "hit");
  hitCount += hits.length;
  for (const entry of rec.roster) {
    const place = rec.results.find((x) => x.id === entry.id).place;
    const up = rec.events.find((e) => e.type === "airborne" && e.racer === entry.id)?.t ?? null;
    if (up !== null) airborne.push(up);
    const legs = dragonLegShapes[Math.floor(entry.genome.legShape) || 0]?.id ?? "raptor";
    byLegs[legs] ??= { count: 0, place: 0, airborne: 0 };
    byLegs[legs].count++;
    byLegs[legs].place += place;
    byLegs[legs].airborne += up ?? 0;
    rows.push({
      place,
      rating: rating(entry.stats),
      strength: entry.strength,
      daily: { perfect: 1, usual: 0, off: -1 }[entry.form],
      ...entry.stats,
      ...Object.fromEntries(shapeGenes.map((g) => [`gene:${g}`, entry.genome[g]])),
      "breath:dealt": hits.filter((e) => e.other === entry.id).reduce((sum, e) => sum + e.amount, 0),
      "breath:taken": hits.filter((e) => e.racer === entry.id).reduce((sum, e) => sum + e.amount, 0),
      element: breathOf(entry.genome).id,
      build: standout(genes, entry.genome),
    });
  }
  for (const frame of rec.frames)
    for (const x of frame.racers) {
      if (x.finished || x.progress > corridor.end || x.progress < corridor.start) continue;
      const f = corridor.at(x.progress);
      const u =
        (x.position[0] - f.position[0]) * f.left[0] + (x.position[2] - f.position[2]) * f.left[2];
      const { ground } = corridor.band(x.progress, u, f);
      if (Math.abs(u) > f.halfWidth + 0.01) violations.side++;
      if (!x.takeoff && x.position[1] < f.floor - 0.01) violations.floor++;
      if (x.position[1] > f.ceiling + 0.01) violations.ceiling++;
      if (x.position[1] < ground - 0.01) violations.terrain++;
    }
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const percentile = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const pct = (n, d = races) => `${((100 * n) / d).toFixed(1)}%`;
function correlation(key) {
  const xs = rows.map((r) => r[key]),
    ys = rows.map((r) => r.place);
  const mx = mean(xs),
    my = mean(ys);
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy || 1);
}
/** Standardised least-squares effect of each key on place, holding the others fixed. */
function regression(keys) {
  const cols = keys.map((key) => {
    const xs = rows.map((r) => r[key]),
      m = mean(xs),
      sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1;
    return xs.map((x) => (x - m) / sd);
  });
  const ys = rows.map((r) => r.place),
    my = mean(ys);
  const k = keys.length,
    a = Array.from({ length: k }, (_, i) => [
      ...cols.map((c) => c.reduce((s, v, n) => s + v * cols[i][n], 0)),
      cols[i].reduce((s, v, n) => s + v * (ys[n] - my), 0),
    ]);
  for (let i = 0; i < k; i++) {
    const p = a[i][i];
    for (let j = i; j <= k; j++) a[i][j] /= p;
    for (let r = 0; r < k; r++)
      if (r !== i) {
        const f = a[r][i];
        for (let j = i; j <= k; j++) a[r][j] -= f * a[i][j];
      }
  }
  return Object.fromEntries(keys.map((key, i) => [key, a[i][k]]));
}

const histogram = {};
for (const n of leadChanges) histogram[n] = (histogram[n] || 0) + 1;
const f2 = (v) => v.toFixed(2);

const lengths = courses.map((c) => c.length);
console.log(`Races: ${races} × ${fieldSize} dragons on ${courseCount} courses (${source}${enlarged ? `, ${enlarged} scaled ×${f2(froude.length)}` : ""}); ${((performance.now() - started) / 1000).toFixed(1)} s`);
console.log(`Course length: mean ${(mean(lengths) / 1000).toFixed(2)} km, ${(Math.min(...lengths) / 1000).toFixed(2)}–${(Math.max(...lengths) / 1000).toFixed(2)} km`);
console.log(`Winning time: mean ${f2(mean(durations))} s (${(mean(durations) / 60).toFixed(2)} min), p10 ${f2(percentile(durations, 0.1))}, p90 ${f2(percentile(durations, 0.9))}; winner average ${(mean(winnerSpeeds) * 3.6).toFixed(0)} km/h`);
const stat = (key) => mean(rows.map((row) => row[key]));
console.log(`Mean stats: top speed ${f2(stat("topSpeed"))} m/s (${(stat("topSpeed") * 3.6).toFixed(0)} km/h), acceleration ${f2(stat("acceleration"))} m/s², handling ${f2(stat("handling"))} m/s², weight ${f2(stat("weight"))}, breath ${f2(stat("breath"))}`);
console.log(`Lead changes (after ${f2(5 * T)} s): mean ${f2(mean(leadChanges))}, median ${percentile(leadChanges, 0.5)}, histogram ${JSON.stringify(histogram)}`);
console.log(`Winner not leading at 50%: ${pct(notLeadingHalf)}; at 75%: ${pct(notLeading75)}`);
console.log(`Winning margin: mean ${f2(mean(margins))} s, p25 ${f2(percentile(margins, 0.25))}, median ${f2(percentile(margins, 0.5))}, p75 ${f2(percentile(margins, 0.75))}, p90 ${f2(percentile(margins, 0.9))}; photo finishes (<${f2(photo)} s) ${pct(margins.filter((m) => m < photo).length, margins.length)}, (<0.3 s) ${pct(margins.filter((m) => m < 0.3).length, margins.length)}`);
console.log(`Finish spread first to last: mean ${f2(mean(spreads))} s, p10 ${f2(percentile(spreads, 0.1))}, p90 ${f2(percentile(spreads, 0.9))}`);
console.log(`Favourite (top handicap rating) wins: ${pct(favouriteWins)} (chance ${pct(races / fieldSize)}), mean place ${f2(favouritePlaces / races)}`);
console.log(`Winners by form: ${JSON.stringify(winnerForm)}`);
if (rider) {
  const line = (label, o, x) => `${label}: wins ${pct(o.wins)}, podiums ${pct(o.podiums)}, last ${pct(o.last)}, mean place ${f2(o.places / races)}, missed gates ${f2(x.misses / races)}, mean time ${f2(x.time / Math.max(1, x.finished))} s`;
  console.log(line("Owned racer on Autopilot", owned, ridden.auto));
  console.log(line(`Owned racer ridden by the scripted rider (steering ${option("steer", "none")}, breath ${option("breath", "smart")})`, ridden, ridden));
  console.log(`Scripted rider against Autopilot, same race: better ${pct(ridden.better)}, worse ${pct(ridden.worse)}, same ${pct(races - ridden.better - ridden.worse)}`);
}
if (owner !== null && !rider)
  console.log(`Owned racer at ${f2(owner)} stars: wins ${pct(owned.wins)}, podiums ${pct(owned.podiums)}, last ${pct(owned.last)}, mean place ${f2(owned.places / races)}`);
console.log(`Missed gates: ${misses} (${f2(misses / races)} per race); bumps: ${f2(bumps / races)} per race; DNF: ${dnf}`);
console.log(`Corridor/terrain violations: ${JSON.stringify(violations)}`);
console.log(
  `Takeoff: airborne after mean ${mean(airborne).toFixed(2)} s, p10 ${percentile(airborne, 0.1).toFixed(2)}, p90 ${percentile(airborne, 0.9).toFixed(2)}; by leg shape ${JSON.stringify(
    Object.fromEntries(Object.entries(byLegs).map(([id, b]) => [id, { place: +(b.place / b.count).toFixed(2), airborne: +(b.airborne / b.count).toFixed(2) }])),
  )}`,
);
const elementWins = Object.fromEntries(
  [...new Set(rows.map((row) => row.element))].map((id) => [id, pct(rows.filter((row) => row.element === id && row.place === 1).length, rows.filter((row) => row.element === id).length)]),
);
const buildWins = Object.fromEntries(
  [...new Set(rows.map((row) => row.build))].sort().map((id) => [id, pct(rows.filter((row) => row.build === id && row.place === 1).length, rows.filter((row) => row.build === id).length)]),
);
console.log(`Win rate by build (what each dragon is built for, chance ${pct(1, fieldSize)}): ${JSON.stringify(buildWins)}`);
console.log(`Breath: ${f2(hitCount / races)} hits per race; correlation with place: dealt ${correlation("breath:dealt").toFixed(3)}, taken ${correlation("breath:taken").toFixed(3)}; win rate by element ${JSON.stringify(elementWins)}`);
console.log("Correlation with finishing place (negative = helps):");
for (const key of ["rating", "strength", "daily", ...statKeys, ...shapeGenes.map((g) => `gene:${g}`)])
  console.log(`  ${key.padEnd(14)} ${correlation(key).toFixed(3)}`);
console.log("Place change per +1 SD, others held fixed (negative = helps):");
const statEffects = regression(["daily", ...statKeys]);
console.log(`  stats  ${Object.entries(statEffects).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ")}`);
const geneEffects = regression(shapeGenes.map((g) => `gene:${g}`));
console.log(`  genes  ${Object.entries(geneEffects).map(([k, v]) => `${k.slice(5)} ${v.toFixed(2)}`).join(", ")}`);
