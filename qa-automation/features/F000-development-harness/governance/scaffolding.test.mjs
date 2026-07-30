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

function provisionalId(registry, type) {
  const row = registry.match(new RegExp(`^\\| ${type} \\| [^|]+ \\| ([^|]+) \\|$`, "m"));
  const id = row?.[1].match(/`([^`]+)`/)?.[1];
  assert.ok(id, `Missing provisional ${type} ID`);
  return id;
}

function incrementId(id) {
  const prefix = id.match(/^[A-Z]+/)?.[0] ?? "";
  const digits = id.slice(prefix.length);
  return `${prefix}${String(Number(digits) + 1).padStart(digits.length, "0")}`;
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
    const registryPath = join(fixture, "docs/governance/id-registry.md");
    const initialRegistry = await readFile(registryPath, "utf8");
    const featureId = provisionalId(initialRegistry, "Feature");
    const stageId = provisionalId(initialRegistry, "Stage");
    const secondFeatureId = incrementId(featureId);
    assert.equal(run(scaffold, ["feature", featureId, "sample-feature", "Sample Feature"], fixture).status, 0);
    assert.equal(run(scaffold, ["stage", featureId, stageId, "first-release", "First Release"], fixture).status, 0);
    assert.equal(
      run(
        scaffold,
        ["task", featureId, stageId, "T01", "bounded-change", "implementation", "full-stack-developer", "solution-architect", "Bounded Change"],
        fixture
      ).status,
      0
    );

    const validation = run(validator, [], fixture);
    assert.equal(validation.status, 0, validation.stderr || validation.stdout);
    const registry = await readFile(registryPath, "utf8");
    const featureRow = registry.split("\n").find((line) => line.startsWith("| Feature |")) ?? "";
    const stageRow = registry.split("\n").find((line) => line.startsWith("| Stage |")) ?? "";
    assert.ok(featureRow.includes("`" + featureId + "`"));
    assert.ok(featureRow.includes("`" + secondFeatureId + "`"));
    assert.ok(stageRow.includes("`" + stageId + "`"));
    assert.ok(stageRow.includes("`" + incrementId(stageId) + "`"));
    const qaTask = await readFile(
      join(
        fixture,
        `delivery/features/${featureId}-sample-feature/stages/${stageId}-first-release/tasks/T90-stage-qa-automation-and-execution.md`
      ),
      "utf8"
    );
    assert.match(qaTask, /^depends_on: \[T01]$/m);

    const duplicate = run(
      scaffold,
      ["task", featureId, stageId, "T01", "bounded-change", "implementation", "full-stack-developer", "solution-architect"],
      fixture
    );
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /Refusing to overwrite/);

    await writeFile(
      registryPath,
      registry.replace(`, \`${featureId}\``, "")
    );
    const staleRegistry = run(validator, [], fixture);
    assert.notEqual(staleRegistry.status, 0);
    assert.match(staleRegistry.stderr, new RegExp(`does not allocate ${featureId} in the Allocated column`));
    await writeFile(registryPath, registry);

    const missingRoles = run(
      scaffold,
      ["task", featureId, stageId, "T02", "missing-roles", "implementation"],
      fixture
    );
    assert.notEqual(missingRoles.status, 0);
    assert.match(missingRoles.stderr, /owner role, and reviewer role are required/);

    assert.equal(run(scaffold, ["feature", secondFeatureId, "second-feature"], fixture).status, 0);
    const globalStageCollision = run(
      scaffold,
      ["stage", secondFeatureId, stageId, "duplicate-global-stage"],
      fixture
    );
    assert.notEqual(globalStageCollision.status, 0);
    assert.match(globalStageCollision.stderr, /Stage ID already allocated/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
