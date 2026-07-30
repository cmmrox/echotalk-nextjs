import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function run(script) {
  return spawnSync(
    process.execPath,
    [join(repoRoot, "scripts", "governance", script), "--root", repoRoot],
    { cwd: repoRoot, encoding: "utf8" }
  );
}

function runAt(script, root) {
  return spawnSync(
    process.execPath,
    [join(repoRoot, "scripts", "governance", script), "--root", root],
    { cwd: repoRoot, encoding: "utf8" }
  );
}

function initGit(root) {
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "qa@example.invalid"],
    ["config", "user.name", "QA Fixture"],
    ["add", "."],
    ["commit", "-qm", "fixture"]
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
}

test("canonical structure, QA matrix, ignored runs, and pending gates are valid", async () => {
  for (const script of ["validate-docs.mjs", "validate-qa.mjs", "validate-release.mjs"]) {
    const result = run(script);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }

  const manifest = JSON.parse(await readFile(
    join(repoRoot, "qa-automation/features/F000-development-harness/stages/S00.json"),
    "utf8"
  ));
  assert.deepEqual(
    manifest.checks.map((check) => check.case),
    ["TC-F000-001", "TC-F000-002", "TC-F000-003", "TC-F000-004", "TC-F000-005"]
  );
  assert.ok(manifest.checks.every((check) => !("required" in check)));

  const ignored = spawnSync(
    "git",
    ["check-ignore", "-q", "qa-automation/runs/example.json"],
    { cwd: repoRoot }
  );
  assert.equal(ignored.status, 0, "qa-automation/runs must be ignored");

  const uat = await readFile(
    join(repoRoot, "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/uat-record.md"),
    "utf8"
  );
  const release = await readFile(
    join(repoRoot, "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/release-evidence.md"),
    "utf8"
  );
  assert.match(uat, /Decision: pending human input/);
  assert.match(uat, /Production release authorized: pending human input/);
  assert.match(release, /Operational go\/no-go: pending release owner/);
});

test("proposed stage may omit its matrix but ready stage may not", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-proposed-qa-"));
  try {
    await cp(join(repoRoot, "delivery"), join(fixture, "delivery"), { recursive: true });
    await cp(
      join(repoRoot, "qa-automation", "features"),
      join(fixture, "qa-automation", "features"),
      { recursive: true }
    );
    const stagePath = join(
      fixture,
      "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/stage.md"
    );
    const matrixPath = join(
      fixture,
      "qa-automation/features/F000-development-harness/stages/S00.json"
    );
    await rm(matrixPath);
    await writeFile(
      stagePath,
      (await readFile(stagePath, "utf8")).replace(/^status: .+$/m, "status: proposed")
    );
    const proposed = runAt("validate-qa.mjs", fixture);
    assert.equal(proposed.status, 0, proposed.stderr || proposed.stdout);
    await writeFile(
      stagePath,
      (await readFile(stagePath, "utf8")).replace(/^status: .+$/m, "status: ready")
    );
    const ready = runAt("validate-qa.mjs", fixture);
    assert.notEqual(ready.status, 0);
    assert.match(`${ready.stderr}${ready.stdout}`, /missing QA stage manifest/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("required QA cannot be downgraded at both case and manifest layers", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-gates-"));
  try {
    await cp(join(repoRoot, "delivery"), join(fixture, "delivery"), { recursive: true });
    await cp(join(repoRoot, "docs", "features"), join(fixture, "docs", "features"), {
      recursive: true
    });
    await cp(
      join(repoRoot, "qa-automation", "features"),
      join(fixture, "qa-automation", "features"),
      { recursive: true }
    );
    await cp(join(repoRoot, ".agents", "roles"), join(fixture, ".agents", "roles"), {
      recursive: true
    });

    const matrixPath = join(
      fixture,
      "qa-automation/features/F000-development-harness/stages/S00.json"
    );
    for (const casePath of await readdir(
      join(fixture, "qa-automation/features/F000-development-harness/cases")
    )) {
      const path = join(fixture, "qa-automation/features/F000-development-harness/cases", casePath);
      await writeFile(path, (await readFile(path, "utf8")).replace("priority: required", "priority: optional"));
    }
    const matrix = JSON.parse(await readFile(matrixPath, "utf8"));
    for (const check of matrix.checks) check.skip_reason = "downgraded";
    await writeFile(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
    const downgraded = runAt("validate-qa.mjs", fixture);
    assert.notEqual(downgraded.status, 0);
    assert.match(`${downgraded.stderr}${downgraded.stdout}`, /has no required QA case/);
    const downgradedTraceability = runAt("validate-traceability.mjs", fixture);
    assert.notEqual(downgradedTraceability.status, 0);
    assert.match(
      `${downgradedTraceability.stderr}${downgradedTraceability.stdout}`,
      /has no required permanent QA coverage/
    );
    const candidate = initGit(fixture);
    const downgradedRun = spawnSync(
      process.execPath,
      [
        join(repoRoot, "scripts", "qa", "run-stage.mjs"),
        "F000",
        "S00",
        "--candidate",
        candidate,
        "--root",
        fixture
      ],
      { cwd: fixture, encoding: "utf8" }
    );
    assert.notEqual(downgradedRun.status, 0);
    assert.match(`${downgradedRun.stderr}${downgradedRun.stdout}`, /permanent QA library is invalid/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("fabricated authorities and QA hashes fail with a real candidate commit", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-release-auth-"));
  try {
    await cp(join(repoRoot, "delivery"), join(fixture, "delivery"), { recursive: true });
    await cp(join(repoRoot, "docs"), join(fixture, "docs"), { recursive: true });
    await cp(
      join(repoRoot, "qa-automation", "features"),
      join(fixture, "qa-automation", "features"),
      { recursive: true }
    );
    await cp(join(repoRoot, ".agents", "roles"), join(fixture, ".agents", "roles"), {
      recursive: true
    });
    const candidate = initGit(fixture);
    const matrixPath = join(
      fixture,
      "qa-automation/features/F000-development-harness/stages/S00.json"
    );
    const emptyManifest = `${JSON.stringify({
      schema_version: 1,
      feature: "F000",
      stage: "S00",
      checks: []
    }, null, 2)}\n`;
    await writeFile(matrixPath, emptyManifest);
    for (const args of [
      ["add", "qa-automation/features/F000-development-harness/stages/S00.json"],
      ["commit", "-qm", "empty harness manifest"]
    ]) {
      const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const harness = spawnSync(
      "git",
      ["rev-parse", "HEAD"],
      { cwd: fixture, encoding: "utf8" }
    ).stdout.trim();
    const manifestHash = createHash("sha256").update(emptyManifest).digest("hex");
    const stagePath = join(
      fixture,
      "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/stage.md"
    );
    await writeFile(
      stagePath,
      (await readFile(stagePath, "utf8"))
        .replace(/^status: .+$/m, "status: released")
        .replace(/^candidate_sha: .+$/m, `candidate_sha: ${candidate}`)
        .replace(/^human_client: .+$/m, "human_client: Nobody")
        .replace(/^release_owner: .+$/m, "release_owner: Fake-Ops")
    );
    const taskRoot = join(stagePath, "../tasks");
    for (const taskName of await readdir(taskRoot)) {
      const taskPath = join(taskRoot, taskName);
      let task = await readFile(taskPath, "utf8");
      task = task
        .replace(/^status: .+$/m, "status: done")
        .replace(/^base_sha: .+$/m, `base_sha: ${candidate}`)
        .replace(/^result_sha: .+$/m, `result_sha: ${candidate}`);
      if (taskName.startsWith("T90-")) {
        task = task.replace(/^owner: .+$/m, "owner: /root/fake_qa");
      }
      await writeFile(taskPath, task);
    }

    const gateRoot = join(stagePath, "../gates");
    const qaPath = join(gateRoot, "qa-report.md");
    const uatPath = join(gateRoot, "uat-record.md");
    const releasePath = join(gateRoot, "release-evidence.md");
    const runRel =
      "delivery/features/F000-development-harness/stages/" +
      "S00-production-delivery-harness/gates/qa-run.json";
    await writeFile(
      qaPath,
      (await readFile(qaPath, "utf8"))
        .replace(/^- Status: .+$/m, "- Status: passed")
        .replace(/^- Candidate commit\/artifact: .+$/m, `- Candidate commit/artifact: ${candidate}`)
        .replace(/^- QA harness\/final source commit: .+$/m, `- QA harness/final source commit: ${harness}`)
        .replace(/^- Certifying run result: .+$/m, "- Certifying run result: passed")
        .replace(/^- Certifying run record: .+$/m, `- Certifying run record: ${runRel}`)
        .replace(/^- Certifying run record SHA-256: .+$/m, `- Certifying run record SHA-256: ${"a".repeat(64)}`)
        .replace(/^- Certifying run manifest SHA-256: .+$/m, `- Certifying run manifest SHA-256: ${manifestHash}`)
        .replace(/^- QA owner: .+$/m, "- QA owner: /root/fake_qa")
        .replace(/^- QA completed at: .+$/m, "- QA completed at: 2026-07-30T12:00:00Z")
    );
    await writeFile(
      join(fixture, runRel),
      `${JSON.stringify({
        schema_version: 1,
        feature: "F000",
        stage: "S00",
        candidate_sha: candidate,
        harness_sha: harness,
        manifest: "qa-automation/features/F000-development-harness/stages/S00.json",
        manifest_sha256: manifestHash,
        working_tree_clean: true,
        certifying_run: true,
        result: "passed",
        qa_owner: "/root/fake_qa",
        checks: []
      }, null, 2)}\n`
    );
    await writeFile(
      uatPath,
      (await readFile(uatPath, "utf8"))
        .replace("Human client: user-client", "Human client: Nobody")
        .replace("Decision at: pending", "Decision at: 2026-07-30T12:01:00Z")
        .replace("Decision: pending human input", "Decision: accepted")
        .replace("Production release authorized: pending human input", "Production release authorized: yes")
        .replace("Recorded evidence: pending", "Recorded evidence: invented")
    );
    await writeFile(
      releasePath,
      (await readFile(releasePath, "utf8"))
        .replace("Status: not-authorized", "Status: released")
        .replace("Accepted source commit: pending", `Accepted source commit: ${candidate}`)
        .replace("Operational go/no-go: pending release owner", "Operational go/no-go: go")
        .replace("Human release owner: pending", "Human release owner: Fake-Ops")
    );

    const deliveryGate = runAt("validate-delivery.mjs", fixture);
    assert.notEqual(deliveryGate.status, 0);
    assert.match(
      `${deliveryGate.stderr}${deliveryGate.stdout}`,
      /human_client must match an assigned authority registry principal|release_owner must match/
    );
    const releaseGate = runAt("validate-release.mjs", fixture);
    assert.notEqual(releaseGate.status, 0);
    const releaseOutput = `${releaseGate.stderr}${releaseGate.stdout}`;
    assert.match(releaseOutput, /QA run record SHA-256 does not match tracked evidence/);
    assert.match(releaseOutput, /recorded harness manifest checks cannot be empty/);
    assert.match(releaseOutput, /applicable harness case missing from manifest/);
    assert.match(releaseOutput, /T90 result commit does not contain the certified QA run/);
    assert.match(releaseOutput, /human_client must match the canonical authority registry/);
    assert.match(releaseOutput, /release_owner is not assigned in the authority registry/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("dirty stage execution is explicitly non-certifying and nonzero", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-dirty-qa-"));
  try {
    const stageDir = join(fixture, "delivery/features/F900-dirty/stages/S90-dirty");
    const qaDir = join(fixture, "qa-automation/features/F900-dirty");
    await mkdir(join(stageDir, "tasks"), { recursive: true });
    await mkdir(join(qaDir, "cases"), { recursive: true });
    await mkdir(join(qaDir, "governance"), { recursive: true });
    await mkdir(join(qaDir, "stages"), { recursive: true });
    await mkdir(join(fixture, "scripts", "governance"), { recursive: true });
    await cp(
      join(repoRoot, "scripts", "governance", "lib.mjs"),
      join(fixture, "scripts", "governance", "lib.mjs")
    );
    await cp(
      join(repoRoot, "scripts", "governance", "validate-qa.mjs"),
      join(fixture, "scripts", "governance", "validate-qa.mjs")
    );
    await writeFile(
      join(stageDir, "stage.md"),
      "---\nid: S90\nfeature: F900\nslug: dirty\nstatus: in-progress\n---\n\n# Dirty QA fixture\n"
    );
    const automation = "qa-automation/features/F900-dirty/governance/noop.mjs";
    const command = `node ${automation}`;
    await writeFile(join(fixture, automation), "process.exit(0);\n");
    await writeFile(
      join(qaDir, "cases", "TC-F900-001-noop.md"),
      [
        "---",
        "id: TC-F900-001",
        "feature: F900",
        "stages: [S90]",
        "acceptance_refs: [F900-AC01]",
        "risk: governance",
        "priority: required",
        `automation: ${automation}`,
        `command: ${command}`,
        "---",
        "",
        "# No-op",
        "",
        "## Expected results",
        "",
        "Pass.",
        ""
      ].join("\n")
    );
    await writeFile(
      join(qaDir, "stages", "S90.json"),
      `${JSON.stringify({
        schema_version: 1,
        feature: "F900",
        stage: "S90",
        checks: [{ case: "TC-F900-001", command }]
      }, null, 2)}\n`
    );
    await writeFile(join(fixture, ".gitignore"), "/qa-automation/runs/\n");
    initGit(fixture);
    await writeFile(join(stageDir, "stage.md"), `${await readFile(join(stageDir, "stage.md"), "utf8")}\n<!-- dirty -->\n`);
    const dirtyRun = spawnSync(
      process.execPath,
      [
        join(repoRoot, "scripts", "qa", "run-stage.mjs"),
        "F900",
        "S90",
        "--allow-dirty",
        "--root",
        fixture
      ],
      { cwd: fixture, encoding: "utf8" }
    );
    assert.equal(dirtyRun.status, 2, dirtyRun.stderr || dirtyRun.stdout);
    assert.match(`${dirtyRun.stderr}${dirtyRun.stdout}`, /precheck-passed/);
    assert.match(`${dirtyRun.stderr}${dirtyRun.stdout}`, /cannot certify a candidate/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test("a QA check that mutates the candidate invalidates promoted evidence", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "echotalk-mutating-qa-"));
  try {
    const stageDir = join(fixture, "delivery/features/F900-mutating/stages/S90-mutating");
    const qaDir = join(fixture, "qa-automation/features/F900-mutating");
    await mkdir(join(stageDir, "tasks"), { recursive: true });
    await mkdir(join(stageDir, "gates"), { recursive: true });
    await mkdir(join(qaDir, "cases"), { recursive: true });
    await mkdir(join(qaDir, "governance"), { recursive: true });
    await mkdir(join(qaDir, "stages"), { recursive: true });
    await mkdir(join(fixture, "scripts", "governance"), { recursive: true });
    await cp(
      join(repoRoot, "scripts", "governance", "lib.mjs"),
      join(fixture, "scripts", "governance", "lib.mjs")
    );
    await cp(
      join(repoRoot, "scripts", "governance", "validate-qa.mjs"),
      join(fixture, "scripts", "governance", "validate-qa.mjs")
    );
    await writeFile(
      join(stageDir, "stage.md"),
      "---\nid: S90\nfeature: F900\nslug: mutating\nstatus: in-progress\nacceptance_refs: [F900-AC01]\n---\n\n# Mutating QA fixture\n"
    );
    const automation = "qa-automation/features/F900-mutating/governance/mutate.mjs";
    const command = `node ${automation}`;
    await writeFile(
      join(fixture, automation),
      [
        'import { appendFileSync } from "node:fs";',
        'appendFileSync(new URL(import.meta.url), "\\n// mutation\\n");',
        ""
      ].join("\n")
    );
    await writeFile(
      join(qaDir, "cases", "TC-F900-001-mutate.md"),
      [
        "---",
        "id: TC-F900-001",
        "feature: F900",
        "stages: [S90]",
        "acceptance_refs: [F900-AC01]",
        "risk: governance",
        "priority: required",
        `automation: ${automation}`,
        `command: ${command}`,
        "---",
        "",
        "# Mutating check",
        "",
        "## Expected results",
        "",
        "The runner must invalidate certification.",
        ""
      ].join("\n")
    );
    await writeFile(
      join(qaDir, "stages", "S90.json"),
      `${JSON.stringify({
        schema_version: 1,
        feature: "F900",
        stage: "S90",
        checks: [{ case: "TC-F900-001", command }]
      }, null, 2)}\n`
    );
    await writeFile(join(fixture, ".gitignore"), "/qa-automation/runs/\n");
    const candidate = initGit(fixture);
    const run = spawnSync(
      process.execPath,
      [
        join(repoRoot, "scripts", "qa", "run-stage.mjs"),
        "F900",
        "S90",
        "--candidate",
        candidate,
        "--promote-evidence",
        "--qa-owner",
        "/root/qa_agent",
        "--root",
        fixture
      ],
      { cwd: fixture, encoding: "utf8" }
    );
    assert.equal(run.status, 1, run.stderr || run.stdout);
    assert.match(`${run.stderr}${run.stdout}`, /Stage QA invalidated/);
    await assert.rejects(access(join(stageDir, "gates", "qa-run.json")));
    const status = spawnSync("git", ["status", "--porcelain"], {
      cwd: fixture,
      encoding: "utf8"
    }).stdout;
    assert.match(status, /mutate\.mjs/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
