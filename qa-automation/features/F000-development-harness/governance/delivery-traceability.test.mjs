import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const deliveryValidator = join(repoRoot, "scripts", "governance", "validate-delivery.mjs");
const traceValidator = join(repoRoot, "scripts", "governance", "validate-traceability.mjs");

function run(script, root) {
  return spawnSync(process.execPath, [script, "--root", root], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("delivery traceability passes and missing T90 closure is rejected", async () => {
  const delivery = run(deliveryValidator, repoRoot);
  assert.equal(delivery.status, 0, delivery.stderr || delivery.stdout);
  const trace = run(traceValidator, repoRoot);
  assert.equal(trace.status, 0, trace.stderr || trace.stdout);

  const fixture = await mkdtemp(join(tmpdir(), "echotalk-delivery-"));
  try {
    await cp(join(repoRoot, "docs", "features"), join(fixture, "docs", "features"), {
      recursive: true
    });
    await cp(join(repoRoot, "delivery"), join(fixture, "delivery"), { recursive: true });
    await cp(join(repoRoot, ".agents", "roles"), join(fixture, ".agents", "roles"), {
      recursive: true
    });
    await cp(
      join(repoRoot, "qa-automation", "features"),
      join(fixture, "qa-automation", "features"),
      { recursive: true }
    );
    const qaTask = join(
      fixture,
      "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/tasks/T90-stage-qa-automation-and-execution.md"
    );
    const original = await readFile(qaTask, "utf8");
    await writeFile(qaTask, original.replace(
      "depends_on: [T01, T02, T03, T04, T05, T06]",
      "depends_on: [T01]"
    ));

    const corrupted = run(deliveryValidator, fixture);
    assert.notEqual(corrupted.status, 0);
    assert.match(`${corrupted.stderr}${corrupted.stdout}`, /must depend transitively on T02/);

    await writeFile(qaTask, original);
    const stagePath = join(
      fixture,
      "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/stage.md"
    );
    const stageOriginal = await readFile(stagePath, "utf8");
    await writeFile(
      stagePath,
      stageOriginal
        .replace(
          "acceptance_refs: [F000-AC01, F000-AC02, F000-AC03, F000-AC04, F000-AC05, F000-AC06]",
          "acceptance_refs: []"
        )
        .replace("depends_on: []", "depends_on: [S99]")
    );
    await writeFile(qaTask, original.replace("owner_role: qa-engineer", "owner_role: full-stack-developer"));
    const brokenScope = run(deliveryValidator, fixture);
    assert.notEqual(brokenScope.status, 0);
    assert.match(`${brokenScope.stderr}${brokenScope.stdout}`, /active stage requires a non-empty acceptance subset/);
    assert.match(`${brokenScope.stderr}${brokenScope.stdout}`, /missing stage dependency S99/);
    assert.match(`${brokenScope.stderr}${brokenScope.stdout}`, /T90: owner_role must be qa-engineer/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
