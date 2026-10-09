import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/**
 * Serves `root` read-only on an ephemeral loopback port, so the brand pages render without the dev server.
 * @param {string} root
 * @returns {Promise<{origin: string, close: () => void}>}
 */
export function serveFolder(root) {
  const base = resolve(root);
  const server = createServer(async (request, response) => {
    const path = resolve(base, `.${decodeURIComponent(new URL(request.url, "http://x").pathname)}`);
    const type = TYPES[extname(path)];
    if (!type || !path.startsWith(base + sep)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(path);
      response.writeHead(200, { "content-type": type }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((done) =>
    server.listen(0, "127.0.0.1", () =>
      done({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }),
    ),
  );
}
