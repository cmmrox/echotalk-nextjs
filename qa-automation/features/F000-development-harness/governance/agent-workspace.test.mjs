import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const validator = join(repoRoot, "scripts", "governance", "validate-agent-workspace.mjs");

function run(root) {
  return spawnSync(process.execPath, [validator, "--root", root], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("agent workspace is valid and rejects a stale generated adapter", async () => {
  const current = run(repoRoot);
  assert.equal(current.status, 0, current.stderr || current.stdout);

  const fixture = await mkdtemp(join(tmpdir(), "echotalk-agent-"));
  try {
    for (const path of ["AGENTS.md", "CLAUDE.md", ".agents", ".codex", "docs"]) {
      await cp(join(repoRoot, path), join(fixture, path), { recursive: true });
    }
    await cp(join(repoRoot, ".claude", "agents"), join(fixture, ".claude", "agents"), {
      recursive: true
    });
    await cp(
      join(repoRoot, "scripts", "governance"),
      join(fixture, "scripts", "governance"),
      { recursive: true }
    );
    await mkdir(join(fixture, ".claude", "skills"), { recursive: true });
    await symlink(
      "../../.agents/skills/echotalk-development",
      join(fixture, ".claude", "skills", "echotalk-development")
    );

    const clean = run(fixture);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const adapter = join(fixture, ".codex", "agents", "project-manager.toml");
    await writeFile(adapter, `${await readFile(adapter, "utf8")}\n# stale\n`);
    const corrupted = run(fixture);
    assert.notEqual(corrupted.status, 0);
    assert.match(`${corrupted.stderr}${corrupted.stdout}`, /stale generated adapter/);

    const generator = join(fixture, "scripts", "governance", "generate-agent-adapters.mjs");
    const restored = spawnSync(process.execPath, [generator, "--root", fixture], {
      cwd: fixture,
      encoding: "utf8"
    });
    assert.equal(restored.status, 0, restored.stderr || restored.stdout);
    const manifestPath = join(fixture, ".agents", "roles", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const qaRole = manifest.roles.find((role) => role.slug === "qa-engineer");
    qaRole.title = "QA Approver";
    qaRole.description = "Approves UAT and production release.";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const regenerated = spawnSync(process.execPath, [generator, "--root", fixture], {
      cwd: fixture,
      encoding: "utf8"
    });
    assert.equal(regenerated.status, 0, regenerated.stderr || regenerated.stdout);
    const authorityCorruption = run(fixture);
    assert.notEqual(authorityCorruption.status, 0);
    assert.match(
      `${authorityCorruption.stderr}${authorityCorruption.stdout}`,
      /qa-engineer: (?:title|description) must match the locked role schema/
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
