// Packs the package exactly as it would be published and validates the tarball with
// publint and are-the-types-wrong. Works under `pnpm publish --dry-run`, where
// `npm pack` would otherwise skip creating the tarball.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "npm_config_dry_run") {
    delete env[key];
  }
}

const run = (command, args) =>
  execFileSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });

const dir = mkdtempSync(join(tmpdir(), "farazlabs-topichub-pack-"));
try {
  run("pnpm", ["pack", "--pack-destination", dir]);
  const tarball = readdirSync(dir).find((file) => file.endsWith(".tgz"));
  if (tarball === undefined) {
    throw new Error("pnpm pack did not produce a tarball.");
  }
  const path = join(dir, tarball);
  run("pnpm", ["exec", "publint", path]);
  run("pnpm", ["exec", "attw", path, "--quiet"]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
