import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleModules, checkBundle, parseModule, writeBuild } from "../tools/build.mjs";
import { createServer } from "../server/main.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

async function tree(files) {
  const dir = await mkdtemp(join(tmpdir(), "dragonz-bundle-"));
  for (const [name, text] of Object.entries(files)) {
    await mkdir(join(dir, name, ".."), { recursive: true });
    await writeFile(join(dir, name), text);
  }
  return dir;
}

test("the bundler runs modules in import order with named and namespace imports", async () => {
  const dir = await tree({
    "a.js": "export const one = 1;\nexport function two() { return one + 1; }\n",
    "b.js": 'import { one } from "./a.js";\nexport { one as uno } from "./a.js";\nexport const three = one + 2;\n',
    "entry.js": 'import * as b from "./b.js";\nimport { two } from "./a.js";\nglobalThis.result = [b.uno, b.three, two()];\nawait Promise.resolve();\n',
  });
  try {
    const bundle = bundleModules(join(dir, "entry.js"), dir);
    checkBundle(bundle);
    await new Function(bundle.code)();
    await new Promise((resolve) => setTimeout(resolve));
    assert.deepEqual(globalThis.result, [1, 3, 2]);
  } finally {
    delete globalThis.result;
    await rm(dir, { recursive: true, force: true });
  }
});

test("the bundler refuses what it cannot keep exact", async () => {
  assert.throws(() => parseModule("export default 1;\n", "x.js"), /default exports/);
  assert.throws(() => parseModule("export let n = 1;\n", "x.js"), /export let/);
  assert.throws(() => parseModule("const a = await import('./a.js');\n", "x.js"), /dynamic import/);
  const cycle = await tree({
    "a.js": 'import { b } from "./b.js";\nexport const a = 1;\n',
    "b.js": 'import { a } from "./a.js";\nexport const b = 1;\n',
  });
  try {
    assert.throws(() => bundleModules(join(cycle, "a.js"), cycle), /import cycle/);
  } finally {
    await rm(cycle, { recursive: true, force: true });
  }
});

test("the game builds into one page that the server hands out in the best encoding", async () => {
  const dist = await mkdtemp(join(tmpdir(), "dragonz-dist-"));
  const server = createServer({ dist });
  try {
    const files = writeBuild(root, dist);
    assert.ok(files.includes("index.html") && files.includes("index.html.br"));
    assert.ok(files.some((file) => file.endsWith(".woff2")));
    const html = await readFile(join(dist, "index.html"), "utf8");
    for (const [, path] of html.matchAll(/(?:src|href)="\/((?:src|styles)\/[^"]*)"/g)) assert.ok(files.includes(path), path);
    assert.match(html, /<script type="module">/);

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const plain = await fetch(base, { headers: { "Accept-Encoding": "identity" } });
    assert.equal(await plain.text(), html);
    const packed = await fetch(`${base}/index.html`, { headers: { "Accept-Encoding": "br" } });
    assert.equal(packed.headers.get("content-encoding"), "br");
    assert.equal(await packed.text(), html);
    assert.equal((await fetch(`${base}/lab.html`)).status, 200);
  } finally {
    server.close();
    await rm(dist, { recursive: true, force: true });
  }
});
