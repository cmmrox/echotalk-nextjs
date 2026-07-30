import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const scaffold = join(repoRoot, "scripts", "governance", "scaffold.mjs");
const validator = join(repoRoot, "scripts", "governance", "validate-delivery.mjs");

function run(script, args, root) {
  return spawnSync(process.execPath, [script, ...args, "--root", root], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

async function normalizeF000ToPlanningState(root) {
  const stagePath = join(
    root,
    "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/stage.md"
  );
  await writeFile(
    stagePath,
    (await readFile(stagePath, "utf8"))
      .replace(/^status: .+$/m, "status: in-progress")
      .replace(/^candidate_sha: .+$/m, "candidate_sha: pending")
  );
  const taskRoot = join(stagePath, "../tasks");
  for (const taskName of await readdir(taskRoot)) {
    const taskPath = join(taskRoot, taskName);
    let task = await readFile(taskPath, "utf8");
    task = task.replace(/^result_sha: .+$/m, "result_sha: pending");
    if (taskName.startsWith("T90-")) {
      task = task
        .replace(/^status: .+$/m, "status: draft")
        .replace(/^owner: .+$/m, "owner: pending-independent-qa")
        .replace(/^base_sha: .+$/m, "base_sha: pending");
    } else {
      task = task.replace(/^status: .+$/m, "status: in-review");
    }
    await writeFile(taskPath, task);
  }
}

test("scaffolds a valid feature, stage, and task without overwriting", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-scaffold-"));
  try {
    await cp(join(repoRoot, "docs"), join(fixture, "docs"), { recursive: true });
    await cp(join(repoRoot, "delivery"), join(fixture, "delivery"), { recursive: true });
    await normalizeF000ToPlanningState(fixture);
    await cp(join(repoRoot, ".agents", "roles"), join(fixture, ".agents", "roles"), {
      recursive: true
    });
    assert.equal(run(scaffold, ["feature", "F001", "sample-feature", "Sample Feature"], fixture).status, 0);
    assert.equal(run(scaffold, ["stage", "F001", "S01", "first-release", "First Release"], fixture).status, 0);
    assert.equal(
      run(
        scaffold,
        ["task", "F001", "S01", "T01", "bounded-change", "implementation", "full-stack-developer", "solution-architect", "Bounded Change"],
        fixture
      ).status,
      0
    );

    const validation = run(validator, [], fixture);
    assert.equal(validation.status, 0, validation.stderr || validation.stdout);
    const registryPath = join(fixture, "docs/governance/id-registry.md");
    const registry = await readFile(registryPath, "utf8");
    assert.match(registry, /\| Feature \| `F000`, `F001` \| `F002` \|/);
    assert.match(registry, /\| Stage \| `S00`, `S01` \| `S02` \|/);
    const qaTask = await readFile(
      join(
        fixture,
        "delivery/features/F001-sample-feature/stages/S01-first-release/tasks/T90-stage-qa-automation-and-execution.md"
      ),
      "utf8"
    );
    assert.match(qaTask, /^depends_on: \[T01]$/m);

    const duplicate = run(
      scaffold,
      ["task", "F001", "S01", "T01", "bounded-change", "implementation", "full-stack-developer", "solution-architect"],
      fixture
    );
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /Refusing to overwrite/);

    await writeFile(
      registryPath,
      registry.replace("`F000`, `F001`", "`F000`")
    );
    const staleRegistry = run(validator, [], fixture);
    assert.notEqual(staleRegistry.status, 0);
    assert.match(staleRegistry.stderr, /does not allocate F001 in the Allocated column/);
    await writeFile(registryPath, registry);

    const missingRoles = run(
      scaffold,
      ["task", "F001", "S01", "T02", "missing-roles", "implementation"],
      fixture
    );
    assert.notEqual(missingRoles.status, 0);
    assert.match(missingRoles.stderr, /owner role, and reviewer role are required/);

    assert.equal(run(scaffold, ["feature", "F002", "second-feature"], fixture).status, 0);
    const globalStageCollision = run(
      scaffold,
      ["stage", "F002", "S01", "duplicate-global-stage"],
      fixture
    );
    assert.notEqual(globalStageCollision.status, 0);
    assert.match(globalStageCollision.stderr, /Stage ID already allocated/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
