const sections = [];
let live = null;

export function begin(name) {
  live = {
    name,
    wall: 0,
    sleep: 0,
    sleeps: 0,
    cdp: 0,
    calls: 0,
    at: performance.now(),
  };
  sections.push(live);
  return live;
}

export function end() {
  if (!live) return;
  live.wall = performance.now() - live.at;
  live = null;
}

export async function section(name, fn) {
  begin(name);
  try {
    return await fn();
  } finally {
    end();
  }
}

export function sleptFor(ms) {
  if (!live) return;
  live.sleep += ms;
  live.sleeps++;
}

export function calledCdp(ms) {
  if (!live) return;
  live.cdp += ms;
  live.calls++;
}

const secs = (ms) => (ms / 1000).toFixed(1).padStart(6);

export function report(title) {
  if (!sections.length) return;
  const total = sections.reduce((n, s) => n + s.wall, 0);
  const width = Math.max(...sections.map((s) => s.name.length));

  console.log(
    `\n${title} - ${(total / 1000).toFixed(1)}s across ${sections.length} sections`,
  );
  console.log(`${"".padEnd(width)}    wall   asleep   browser   calls`);
  for (const s of [...sections].sort((a, b) => b.wall - a.wall)) {
    const share = total ? Math.round((s.wall / total) * 100) : 0;
    console.log(
      `  ${s.name.padEnd(width)} ${secs(s.wall)}s ${secs(s.sleep)}s ${secs(s.cdp)}s` +
        ` ${String(s.calls).padStart(6)}   ${share ? share + "%" : ""}`,
    );
  }

  const slept = sections.reduce((n, s) => n + s.sleep, 0);
  const cdp = sections.reduce((n, s) => n + s.cdp, 0);
  console.log(
    `\n  asleep ${(slept / 1000).toFixed(1)}s (${Math.round((slept / total) * 100)}%)` +
      ` · browser ${(cdp / 1000).toFixed(1)}s (${Math.round((cdp / total) * 100)}%)`,
  );
}
