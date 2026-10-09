#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Folders the built page loads by URL rather than inline. */
export const COPIED = ["styles/ui/fonts", "styles/ui/img"];
const FONT_URL = /url\((["']?)([\w-]+\.woff2)\1\)/g;

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*(["'])([^"'\n]+)\2[ \t]*;?/y;
const NAMESPACE_IMPORT = /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*(["'])([^"'\n]+)\2[ \t]*;?/y;
const BARE_IMPORT = /import\s*(["'])([^"'\n]+)\1[ \t]*;?/y;
const EXPORT_LIST = /export\s*\{([^}]*)\}(?:\s*from\s*(["'])([^"'\n]+)\2)?[ \t]*;?/y;
const EXPORT_DECLARATION = /export\s+((?:async\s+)?function\s*\*?\s*|const\s+|class\s+)([A-Za-z_$][\w$]*)/y;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * `name` is what the exporting module calls a binding, `local` what this module calls it; the
 * name `*` binds the whole module. An export with `from` re-exports binding `local` of request
 * number `from`.
 * @typedef {{name: string, local: string, from?: number}} Binding
 * @typedef {{request: string, bindings: Binding[]}} Request
 */

/** @param {string} list the inside of `{ ... }` */
function bindings(list, fail) {
  return list
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, local = name, extra] = part.split(/\s+as\s+/);
      if (extra !== undefined || !IDENTIFIER.test(name) || !IDENTIFIER.test(local))
        fail(`cannot read "${part}"`);
      if (name === "default" || local === "default") fail("default imports and exports are not supported");
      return { name, local };
    });
}

/**
 * Reads a module's import and export statements, which sit at column 0, and returns its body
 * with the imports removed and `export` stripped.
 * @param {string} source
 * @param {string} label root-relative, for errors
 * @returns {{body: string, requests: Request[], exports: Binding[]}}
 */
export function parseModule(source, label) {
  source.split("\n").forEach((line, index) => {
    const code = line.trim().replace(/\/\*.*?\*\//g, "");
    if (/^(\/\/|\/?\*)/.test(code)) return;
    const unsupported = [
      [/\bimport\s*\(/, "dynamic import() is not supported"],
      [/\bimport\.meta\b/, "import.meta is not supported"],
      [/\b__dz\d/, "__dz<n> names are reserved for the bundle"],
    ].find(([pattern]) => pattern.test(code));
    if (unsupported) throw new Error(`${label}:${index + 1}: ${unsupported[1]}`);
  });

  /** @type {Request[]} */
  const requests = [];
  /** @type {Binding[]} */
  const exports = [];
  let body = "";
  let from = 0;
  for (const match of source.matchAll(/^(import|export)\b/gm)) {
    const at = match.index;
    const head = source.slice(at, at + 16);
    const fail = (why) => {
      throw new Error(`${label}:${source.slice(0, at).split("\n").length}: ${why}`);
    };
    const read = (pattern) => {
      pattern.lastIndex = at;
      return pattern.exec(source);
    };
    body += source.slice(from, at);
    let found;
    if ((found = read(IMPORT))) {
      requests.push({ request: found[3], bindings: bindings(found[1], fail) });
    } else if ((found = read(NAMESPACE_IMPORT))) {
      requests.push({ request: found[3], bindings: [{ name: "*", local: found[1] }] });
    } else if ((found = read(BARE_IMPORT))) {
      requests.push({ request: found[2], bindings: [] });
    } else if ((found = read(EXPORT_LIST))) {
      const list = bindings(found[1], fail);
      if (found[3]) {
        exports.push(...list.map(({ name, local }) => ({ name: local, local: name, from: requests.length })));
        requests.push({ request: found[3], bindings: list.map(({ name }) => ({ name, local: name })) });
      } else {
        exports.push(...list.map(({ name, local }) => ({ name: local, local: name })));
      }
    } else if ((found = read(EXPORT_DECLARATION))) {
      exports.push({ name: found[2], local: found[2] });
      body += found[0].replace(/^export\s+/, "");
    } else if (/^export\s+(let|var)\b/.test(head)) {
      fail("export let/var is not supported: an exported binding must never be reassigned");
    } else if (/^export\s*\*/.test(head)) {
      fail("export * is not supported");
    } else if (/^export\s+default\b/.test(head)) {
      fail("default exports are not supported");
    } else if (/^import\s*[\w$]/.test(head)) {
      fail("only named and namespace imports are supported");
    } else {
      fail(`cannot read this ${match[1]} statement`);
    }
    from = at + found[0].length;
  }
  body += source.slice(from);

  const names = exports.map(({ name }) => name);
  const twice = names.find((name, index) => names.indexOf(name) !== index);
  if (twice) throw new Error(`${label}: exports ${twice} twice`);
  return { body, requests, exports };
}

/** @param {string} root @param {string} file absolute */
const labelOf = (root, file) => relative(root, file).split(sep).join("/");

/** @param {string} request @param {string} importer absolute @param {string} root */
function resolveRequest(request, importer, root) {
  let file;
  if (request.startsWith("./") || request.startsWith("../")) file = resolve(dirname(importer), request);
  else if (request.startsWith("/")) file = resolve(root, `.${request}`);
  else throw new Error(`${labelOf(root, importer)}: bare specifier "${request}" is not supported`);
  if (!existsSync(file)) throw new Error(`${labelOf(root, importer)}: "${request}" does not exist`);
  return file;
}

/**
 * Bundles a module graph into one script: every module becomes an arrow IIFE in the order ES
 * modules evaluate, and its imports copy the values its dependencies already returned. That is
 * only exact with no cycles and no reassigned exports, so both are refused. The entry runs in an
 * async function, which is what lets it keep its top-level await.
 * @param {string} file the entry, absolute; imports resolve from it
 * @param {string} root the served root, for `/`-rooted imports
 * @returns {{code: string, modules: {label: string, line: number}[]}}
 */
export function bundleModules(file, root) {
  const done = new Map();
  const visiting = [];
  const order = [];

  const visit = (path) => {
    if (done.has(path)) return done.get(path);
    const cycle = visiting.indexOf(path);
    if (cycle !== -1) {
      throw new Error(`import cycle: ${[...visiting.slice(cycle), path].map((entry) => labelOf(root, entry)).join(" -> ")}`);
    }
    const label = labelOf(root, path);
    visiting.push(path);
    const parsed = parseModule(readFileSync(path, "utf8"), label);
    const deps = parsed.requests.map(({ request }) => visit(resolveRequest(request, path, root)));
    visiting.pop();
    const module = { file: path, label, ...parsed, deps, id: order.length };
    order.push(module);
    done.set(path, module);
    return module;
  };
  visit(file);

  const lines = [];
  const modules = [];
  let line = 1;
  const emit = (text) => {
    lines.push(text);
    line += text.split("\n").length;
  };
  for (const module of order) {
    const bound = [];
    module.requests.forEach(({ bindings: list }, index) => {
      const dep = module.deps[index];
      for (const { name, local } of list) {
        if (name !== "*" && !dep.exports.some((entry) => entry.name === name)) {
          throw new Error(`${module.label}: ${dep.label} does not export ${name}`);
        }
        if (name === "*") bound.push(`${local} = __dz${dep.id}`);
        else if (!module.exports.some((entry) => entry.from === index)) bound.push(`${local} = __dz${dep.id}.${name}`);
      }
    });
    if (module.body.includes("<!--")) throw new Error(`${module.label}: "<!--" cannot sit inside an inline script`);
    const members = module.exports.map(({ name, local, from }) =>
      from !== undefined ? `${name}: __dz${module.deps[from].id}.${local}` : name === local ? name : `${name}: ${local}`);
    const entry = module.id === order.length - 1;

    modules.push({ label: module.label, line });
    emit(`// ${module.label}`);
    emit(entry ? "(async () => {" : `const __dz${module.id} = (() => {`);
    if (bound.length) emit(`const ${bound.join(", ")};`);
    emit(module.body.trim());
    if (!entry) emit(`return { ${members.join(", ")} };`);
    emit("})();");
  }
  return { code: lines.join("\n").replace(/<\/(script)/gi, "<\\/$1"), modules };
}

/**
 * Parses a bundle the way the browser will and names the source file of any syntax error.
 * Top-level `await` outside the entry lands here too: inside an IIFE it no longer parses.
 * @param {{code: string, modules: {label: string, line: number}[]}} bundle
 */
export function checkBundle({ code, modules }) {
  const dir = mkdtempSync(join(tmpdir(), "dragonz-build-"));
  try {
    const file = join(dir, "bundle.mjs");
    writeFileSync(file, code);
    const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (r.status === 0) return;
    const line = Number(/bundle\.mjs:(\d+)/.exec(r.stderr)?.[1]);
    const culprit = modules.findLast((module) => module.line <= line)?.label ?? "the bundle";
    throw new Error(`${culprit} does not parse once bundled:\n${r.stderr.trim()}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** @param {string} attributes the inside of a tag */
function attributesOf(attributes) {
  return Object.fromEntries([...attributes.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)].map((m) => [m[1].toLowerCase(), m[2] ?? ""]));
}

/** @param {string} root @param {string} href */
const localFile = (root, href) => join(root, href.replace(/^\/+/, ""));

/** Inlines a stylesheet; the fonts beside it stay files, addressed from the root. */
function inlineStylesheet(root, href) {
  const folder = dirname(href);
  const css = readFileSync(localFile(root, href), "utf8").replace(FONT_URL, (_, quote, font) => {
    const path = `${folder}/${font}`;
    if (!existsSync(localFile(root, path))) throw new Error(`${href}: ${font} does not exist`);
    return `url("${path}")`;
  });
  if (/<\/style/i.test(css)) throw new Error(`${href}: "</style" cannot sit inside an inline stylesheet`);
  return css;
}

/**
 * Turns `index.html` into one self-contained page: the modules bundled inline and the stylesheets
 * inline. Only the fonts and the logo art stay files, so each device fetches just what it draws.
 * @param {string} root the source tree
 * @returns {{html: string, files: string[]}} the page and the root-relative files it still loads
 */
export function buildPage(root) {
  const files = COPIED.flatMap((path) =>
    readdirSync(join(root, path)).filter((name) => /\.(woff2|png)$/.test(name)).map((name) => `${path}/${name}`),
  ).sort();

  const html = readFileSync(join(root, "index.html"), "utf8")
    .replace(/([ \t]*)<link\b([^>]*)>(\r?\n)?/gi, (tag, indent, inside, newline = "") => {
      const { rel, href = "" } = attributesOf(inside);
      if (rel === "stylesheet" && href.startsWith("/")) {
        return `${indent}<style>\n${inlineStylesheet(root, href).trim()}\n${indent}</style>${newline}`;
      }
      return tag;
    })
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, inside) => {
      const { type, src } = attributesOf(inside);
      if (type !== "module" || !src) return tag;
      const bundle = bundleModules(localFile(root, src), root);
      checkBundle(bundle);
      return `<script type="module">\n${bundle.code}\n</script>`;
    });

  const left = [...html.matchAll(/(?:href|src)="(\/(?:src|styles)\/[^"]*)"/g)]
    .map((match) => match[1])
    .filter((path) => !files.includes(path.slice(1)));
  if (left.length) throw new Error(`the built page still references ${left.join(", ")}`);
  const missing = [...html.matchAll(/url\("(\/styles\/[^"]+)"\)/g)]
    .map((match) => match[1].slice(1))
    .filter((path) => !files.includes(path));
  if (missing.length) throw new Error(`the built page loads files the build does not ship: ${[...new Set(missing)].join(", ")}`);
  return { html, files };
}

/** @param {Buffer} bytes */
const brotli = (bytes) =>
  brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
    },
  });

/**
 * Replaces `outDir` with the built page and the files it loads; `precompress` adds the `.br` and
 * `.gz` copies of the page the server hands to browsers that accept them.
 * @param {string} root
 * @param {string} outDir
 * @param {{precompress?: boolean, page?: {html: string, files: string[]}}} [options]
 * @returns {string[]} the written files, relative to `outDir`
 */
export function writeBuild(root, outDir, { precompress = true, page = buildPage(root) } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const html = Buffer.from(page.html);
  writeFileSync(join(outDir, "index.html"), html);
  const written = ["index.html"];
  if (precompress) {
    writeFileSync(join(outDir, "index.html.br"), brotli(html));
    writeFileSync(join(outDir, "index.html.gz"), gzipSync(html, { level: constants.Z_BEST_COMPRESSION }));
    written.push("index.html.br", "index.html.gz");
  }
  for (const file of page.files) {
    mkdirSync(dirname(join(outDir, file)), { recursive: true });
    cpSync(join(root, file), join(outDir, file));
    written.push(file);
  }
  return written.sort();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const outDir = join(ROOT, "dist");
  const written = writeBuild(ROOT, outDir, { precompress: !process.argv.includes("--no-precompress") });
  for (const file of written) {
    console.log(`  ${file.padEnd(42)} ${(statSync(join(outDir, file)).size / 1024).toFixed(0).padStart(6)} KB`);
  }
  console.log(`built ${written.length} files into dist/`);
}
