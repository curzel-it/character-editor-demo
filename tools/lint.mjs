import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(`${path}/${entry.name}`)
          : `${path}/${entry.name}`,
      ),
    )
  ).flat();
}
let count = 0;
for (const path of (
  await Promise.all(["src", "server", "tools", "tests"].map(files))
)
  .flat()
  .filter((p) => /\.(m?js)$/.test(p))) {
  const result = spawnSync(process.execPath, ["--check", path], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exitCode = 1;
  }
  count++;
}
console.log(`Syntax checked ${count} JavaScript modules.`);
