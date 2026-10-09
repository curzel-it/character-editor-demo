import { spawn } from "node:child_process";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { hostname, platform, arch, cpus } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  launch,
  evaluate,
  waitFor,
  watchErrors,
  sleep,
  navigate,
} from "../cdp.mjs";
import { pixelsOf } from "../canvasPixels.mjs";
import { subjects, styles, loadSubject } from "../../src/subjects.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const subject = option("--subject", "dragon");
const style = option("--style", "cozy");
const base = option("--url", "http://127.0.0.1:8094");
const all = args.includes("--all");
if (args.includes("--help")) {
  console.log(
    `node tools/checks/run.mjs [--subject ${subjects.map((item) => item.id).join("|")}] [--style ${styles.map((item) => item.id).join("|")}] [--all] [--url http://127.0.0.1:8094]`,
  );
  console.log(
    "--all checks every available subject, with --style restricting styles when provided. Evidence goes to shots/<subject>/<style>/.",
  );
  process.exit(0);
}
if (
  !subjects.some((item) => item.id === subject) ||
  !styles.some((item) => item.id === style)
)
  throw new Error("Unknown subject or style; use --help");
const url = new URL(base);
let server;
let session;
let failed = false;
try {
  const healthy = await fetch(new URL("/status", url))
    .then((response) => response.ok)
    .catch(() => false);
  if (!healthy) {
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error(`Server unavailable at ${base}`);
    server = spawn(process.execPath, ["server/main.mjs"], {
      cwd: root,
      env: { ...process.env, PORT: url.port || "8094", HOST: url.hostname },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let bootLog = "";
    server.stdout.on("data", (data) => {
      bootLog += data;
    });
    server.stderr.on("data", (data) => {
      bootLog += data;
    });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (server.exitCode !== null)
        throw new Error(`Server exited: ${bootLog}`);
      ready = await fetch(new URL("/status", url))
        .then((response) => response.ok)
        .catch(() => false);
      if (ready) break;
      await sleep(100);
    }
    if (!ready) throw new Error(`Server did not start: ${bootLog}`);
  }
  const page = new URL("/tools/checks/check.html", url).href;
  const sourceRevision = () =>
    fetch(new URL("/api/progress", url))
      .then((response) => response.json())
      .then((progress) => progress.revision);
  let loadedRevision = await sourceRevision();
  session = await launch({ url: "about:blank", width: 1280, height: 780 });
  const browserErrors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: page });
  if (!(await waitFor(session, "window.__checks", 10000)))
    throw new Error(`Check page did not load: ${browserErrors.join("\n")}`);
  const selectedSubjects = all
    ? subjects
    : subjects.filter((item) => item.id === subject);
  const selectedStyles =
    all && !args.includes("--style")
      ? styles
      : styles.filter((item) => item.id === style);
  let checked = 0;
  for (const candidate of selectedSubjects) {
    if (
      all &&
      !["genome", "anatomy", "animate"].every((directory) =>
        existsSync(resolve(root, `src/${directory}/${candidate.id}.js`)),
      )
    ) {
      console.log(`SKIP ${candidate.id}: anatomy not implemented`);
      continue;
    }
    await loadSubject(candidate.id);
    for (const look of selectedStyles) {
      console.log(`Checking ${candidate.id} × ${look.id}…`);
      const directory = resolve(root, "shots", candidate.id, look.id);
      await mkdir(directory, { recursive: true });
      const firstError = browserErrors.length;
      try {
        const revision = await sourceRevision();
        if (revision !== loadedRevision) {
          await navigate(session, `${page}?revision=${revision}`);
          if (!(await waitFor(session, "window.__checks", 10000)))
            throw new Error("Check page did not reload");
          loadedRevision = revision;
        }
        const report = await evaluate(
          session,
          `window.__checks.run(${JSON.stringify(candidate.id)}, ${JSON.stringify(look.id)})`,
        );
        report.environment.sourceRevision = loadedRevision;
        report.environment.sourceChangedDuringCheck =
          loadedRevision !== (await sourceRevision());
        const screen = await evaluate(
          session,
          `(() => {const pixels = ${pixelsOf('document.querySelector("#benchmark-evidence")')};return {width:pixels.width,height:pixels.height,nonblank:pixels.data.some((n,i)=>i%4!==3&&n>30)}})()`,
        );
        report.environment.machine = {
          hostname: hostname(),
          platform: platform(),
          architecture: arch(),
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
        };
        report.environment.browserVersion =
          await session.send("Browser.getVersion");
        report.environment.performanceCanvas = screen;
        if (!screen.nonblank || browserErrors.length > firstError) {
          report.checks.push({
            name: "Browser errors",
            status: "fail",
            details: {
              errors: browserErrors.slice(firstError),
              blankPerformanceCanvas: !screen.nonblank,
            },
          });
          report.summary.status = "fail";
          report.summary.failed++;
        }
        for (const name of [
          "contact",
          "broadcast",
          "genes",
          "animation",
          "performance",
        ]) {
          const data = await evaluate(
            session,
            `window.__checks.image(${JSON.stringify(name)})`,
          );
          if (!data?.startsWith("data:image/png;base64,"))
            throw new Error(`Missing ${name} PNG`);
          await writeFile(
            resolve(directory, `${name}.png`),
            Buffer.from(data.split(",")[1], "base64"),
          );
        }
        const temporary = resolve(directory, "report.tmp.json");
        await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
        await rename(temporary, resolve(directory, "report.json"));
        checked++;
        failed ||= report.summary.failed > 0;
        console.log(
          `${candidate.id} × ${look.id}: ${report.summary.passed} pass, ${report.summary.failed} fail, ${report.summary.review} awaiting review → ${resolve(directory, "report.json")}`,
        );
      } catch (error) {
        failed = true;
        const report = {
          subject: candidate.id,
          style: look.id,
          createdAt: new Date().toISOString(),
          checks: [
            {
              name: "Runner",
              status: "fail",
              details: {
                error: error.message,
                browserErrors: browserErrors.slice(firstError),
              },
            },
          ],
          environment: { platform: platform(), architecture: arch() },
          summary: {
            status: "fail",
            failed: 1,
            review: 0,
            passed: 0,
            proven: false,
          },
        };
        await writeFile(
          resolve(directory, "report.json"),
          JSON.stringify(report, null, 2) + "\n",
        );
        console.error(`${candidate.id} × ${look.id}: ${error.message}`);
      }
    }
  }
  if (!checked) failed = true;
} finally {
  if (session) await session.close();
  if (server) server.kill("SIGTERM");
}
process.exitCode = failed ? 1 : 0;
