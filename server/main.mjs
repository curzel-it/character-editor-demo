import { createServer as httpServer } from "node:http";
import { readFile, stat, realpath, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname, sep, relative } from "node:path";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { subjects, styles } from "../src/subjects.js";
import { readBuiltPage } from "./builtPage.mjs";

export const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
// A pitch deck's media may live on another disk, behind its `media` symlink.
const pitchMedia = (pathname) => {
  const deck = pathname.match(/^\/tools\/pitch\/[^/]+\/media\//)?.[0];
  try {
    return deck && realpathSync(resolve(root, `.${deck}`));
  } catch {
    return null;
  }
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};
const allowed = (path) =>
  !path.split("/").some((p) => p.startsWith(".")) &&
  types[extname(path)] &&
  (/^\/(src|styles|tools\/checks|tools\/pitch|shots|brand|node_modules\/musicbox\/src)\//.test(path) ||
    [
      "/index.html",
      "/editor.html",
      "/lab.html",
      "/race.html",
      "/raceMap.html",
      "/cameraMap.html",
      "/style.css",
      "/favicon.ico",
    ].includes(path));
async function exists(path) {
  return stat(resolve(root, path))
    .then((s) => s.isFile())
    .catch(() => false);
}
async function sourceStamp(directory) {
  const entries = await readdir(resolve(root, directory), {
    withFileTypes: true,
  });
  const stamps = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith("."))
      .map(async (entry) => {
        const name = `${directory}/${entry.name}`;
        return entry.isDirectory()
          ? sourceStamp(name)
          : `${name}:${(await stat(resolve(root, name))).mtimeMs}`;
      }),
  );
  return stamps.flat();
}
export async function progress() {
  const cells = [];
  for (const subject of subjects)
    for (const style of styles) {
      const available = (
        await Promise.all(
          [
            `src/genome/${subject.id}.js`,
            `src/anatomy/${subject.id}.js`,
            `src/animate/${subject.id}.js`,
            `src/style/${style.id}.js`,
          ].map(exists),
        )
      ).every(Boolean);
      let report = null;
      try {
        report = JSON.parse(
          await readFile(
            resolve(root, `shots/${subject.id}/${style.id}/report.json`),
            "utf8",
          ),
        );
      } catch {
        /* No evidence yet. */
      }
      cells.push({ subject: subject.id, style: style.id, available, report });
    }
  let activity = { message: "Building the first visual pass", updatedAt: null };
  try {
    activity = JSON.parse(
      await readFile(resolve(root, "runtime/progress.json"), "utf8"),
    );
  } catch {
    /* Fresh workspace. */
  }
  const stamps = [...(await sourceStamp("src")), ...(await sourceStamp("styles"))];
  for (const name of ["index.html", "race.html", "lab.html", "style.css"]) {
    const file = await stat(resolve(root, name)).catch(() => null);
    if (file) stamps.push(`${name}:${file.mtimeMs}`);
  }
  const revision = createHash("sha1")
    .update(stamps.sort().join("|"))
    .digest("hex")
    .slice(0, 12);
  return { revision, cells, activity, updatedAt: new Date().toISOString() };
}

/** @param {{dist?: string}} [options] `dist` is a `npm run build` folder whose page replaces `/`. */
export function createServer({ dist } = {}) {
  return httpServer(async (req, res) => {
    const send = (status, body, type = "application/json; charset=utf-8", headers = {}) => {
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (!["GET", "HEAD"].includes(req.method)) {
      send(405, JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      send(400, "{}");
      return;
    }
    if (pathname === "/status") {
      send(
        200,
        JSON.stringify({
          uptime: process.uptime(),
          rss: process.memoryUsage().rss,
        }),
      );
      return;
    }
    if (pathname === "/api/progress") {
      try {
        send(200, JSON.stringify(await progress()));
      } catch {
        send(500, JSON.stringify({ error: "Progress unavailable" }));
      }
      return;
    }
    if (pathname === "/") pathname = dist ? "/index.html" : "/editor.html";
    if (pathname === "/game") pathname = "/index.html";
    const built = pathname === "/index.html" && dist ? await readBuiltPage(dist, req.headers["accept-encoding"]) : null;
    if (built) {
      send(200, built.data, types[".html"], {
        Vary: "Accept-Encoding",
        ...(built.encoding === "identity" ? {} : { "Content-Encoding": built.encoding }),
      });
      return;
    }
    if (!allowed(pathname)) {
      send(404, "{}");
      return;
    }
    const path = resolve(root, `.${pathname}`);
    try {
      const actual = await realpath(path);
      const inRoot = actual.startsWith(root + sep) && allowed(`/${relative(root, actual).split(sep).join("/")}`);
      const media = inRoot ? null : pitchMedia(pathname);
      if (!inRoot && !(media && actual.startsWith(media + sep))) {
        send(404, "{}");
        return;
      }
      const data = await readFile(actual);
      send(200, data, types[extname(actual)]);
    } catch {
      send(404, "{}");
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
) {
  const server = createServer({
    dist: process.env.DIST_ROOT ? resolve(process.env.DIST_ROOT) : undefined,
  });
  server.listen(
    Number(process.env.PORT || 8120),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Character editor: http://${process.env.HOST || "127.0.0.1"}:${server.address().port}/`,
      ),
  );
}
