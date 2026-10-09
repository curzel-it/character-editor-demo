import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile, rm } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createServer, root } from "../server/main.mjs";
import { subjects, styles } from "../src/subjects.js";

test("Server serves the app, the lab and modules while restricting paths and methods", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const app = await fetch(base);
    assert.equal(app.status, 200);
    assert.match(app.headers.get("content-type"), /text\/html/);
    assert.match(await app.text(), /src="\/src\/app\.js"/);
    for (const page of ["/index.html", "/lab.html", "/race.html", "/raceMap.html", "/cameraMap.html"])
      assert.equal((await fetch(base + page)).status, 200, `${page} is served`);
    const sheet = await fetch(`${base}/styles/race.css`);
    assert.equal(sheet.status, 200);
    assert.match(sheet.headers.get("content-type"), /text\/css/);
    const helper = await fetch(`${base}/tools/checks/structure.mjs`);
    assert.equal(helper.status, 200);
    assert.match(helper.headers.get("content-type"), /javascript/);
    const status = await fetch(`${base}/status`).then((response) =>
      response.json(),
    );
    assert.deepEqual(Object.keys(status).sort(), ["rss", "uptime"]);
    assert.ok(status.rss > 0 && status.uptime >= 0);
    const progress = await fetch(`${base}/api/progress`).then((response) =>
      response.json(),
    );
    assert.equal(progress.cells.length, subjects.length * styles.length);
    assert.ok(
      progress.cells.every((cell) => typeof cell.available === "boolean"),
    );
    assert.ok(progress.revision.length > 0);
    for (const path of [
      "/.env",
      "/src/.env",
      "/package.json",
      "/server/main.mjs",
      "/tools/gpt.mjs",
      "/src/%2e%2e%2f.env",
      "/src/%2e%2e%2f%2e%2e%2f.env",
    ]) {
      assert.equal(
        (await fetch(base + path)).status,
        404,
        `${path} is not served`,
      );
    }
    assert.equal(
      (await fetch(`${base}/status`, { method: "POST" })).status,
      405,
    );
    const head = await fetch(`${base}/lab.html`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Server checks canonical paths when an allowed URL points at a restricted file", async () => {
  await mkdir(resolve(root, "shots"), { recursive: true });
  const directory = await mkdtemp(resolve(root, "shots", "server-test-"));
  const server = createServer();
  try {
    await writeFile(resolve(directory, ".protected.json"), '{"fixture":true}');
    await symlink(
      resolve(root, "server/main.mjs"),
      resolve(directory, "serverAlias.mjs"),
    );
    await symlink(
      resolve(directory, ".protected.json"),
      resolve(directory, "hiddenAlias.json"),
    );
    await symlink(
      resolve(root, "src/subjects.js"),
      resolve(directory, "allowedAlias.js"),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}/shots/${basename(directory)}`;
    assert.equal(
      (await fetch(`${base}/serverAlias.mjs`)).status,
      404,
      "Server implementation cannot bypass the allowlist via a symlink",
    );
    assert.equal(
      (await fetch(`${base}/hiddenAlias.json`)).status,
      404,
      "Hidden targets cannot bypass dotfile protection via a symlink",
    );
    assert.equal(
      (await fetch(`${base}/allowedAlias.js`)).status,
      200,
      "Valid symlinks to public source are still served",
    );
  } finally {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await rm(directory, { recursive: true, force: true });
  }
});
