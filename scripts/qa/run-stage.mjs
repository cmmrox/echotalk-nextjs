#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  defaultRepoRoot,
  exists,
  parseFrontmatter,
  readJson,
  readText,
  rootFromArgs,
  walkFiles,
  withoutRootArgs
} from "../governance/lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const args = withoutRootArgs();
const [featureId, stageId] = args.filter((arg) => !arg.startsWith("--"));
const allowDirty = args.includes("--allow-dirty");
const promoteEvidence = args.includes("--promote-evidence");
const candidateIndex = args.indexOf("--candidate");
const expectedCandidate = candidateIndex === -1 ? null : args[candidateIndex + 1];
const ownerIndex = args.indexOf("--qa-owner");
const qaOwner = ownerIndex === -1 ? null : args[ownerIndex + 1];

if (!/^F\d{3}$/.test(featureId ?? "") || !/^S\d{2}$/.test(stageId ?? "")) {
  console.error(
    "Usage: run-stage.mjs FNNN SNN [--candidate SHA] [--allow-dirty] " +
    "[--promote-evidence --qa-owner /root/agent]"
  );
  process.exit(2);
}
if (promoteEvidence && (allowDirty || !/^\/root\/[a-z0-9][a-z0-9_/-]*$/.test(qaOwner ?? ""))) {
  console.error("Promoted evidence requires a clean run and a canonical /root/<agent> QA owner.");
  process.exit(2);
}

function git(...gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
  return result.stdout.trim();
}

const harness = git("rev-parse", "HEAD");
const candidate = expectedCandidate ?? harness;
if (expectedCandidate && git("rev-parse", expectedCandidate) !== expectedCandidate) {
  console.error(`Candidate does not resolve exactly: ${expectedCandidate}.`);
  process.exit(1);
}
const dirtyStatus = git("status", "--porcelain");
if (!allowDirty && dirtyStatus) {
  console.error("Stage QA requires a clean worktree. Freeze/commit the candidate first.");
  process.exit(1);
}
if (allowDirty && dirtyStatus) {
  console.warn("Dirty-worktree precheck only: this run cannot certify a candidate.");
}

const qaValidation = spawnSync(
  process.execPath,
  [join(repoRoot, "scripts", "governance", "validate-qa.mjs"), "--root", repoRoot],
  { cwd: repoRoot, encoding: "utf8" }
);
if (qaValidation.status !== 0) {
  process.stdout.write(qaValidation.stdout ?? "");
  process.stderr.write(qaValidation.stderr ?? "");
  console.error("Stage QA aborted because the permanent QA library is invalid.");
  process.exit(1);
}

const featureRoot = join(repoRoot, "qa-automation", "features");
const featureEntries = await readdir(featureRoot, { withFileTypes: true });
const featureFolder = featureEntries
  .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${featureId}-`))
  .map((entry) => entry.name);
if (featureFolder.length !== 1) {
  console.error(`Expected exactly one QA feature folder for ${featureId}.`);
  process.exit(1);
}
if (candidate !== harness) {
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", candidate, harness], {
    cwd: repoRoot
  });
  const changed = git("diff", "--name-only", candidate, harness)
    .split(/\r?\n/)
    .filter(Boolean);
  const qaPrefix = `qa-automation/features/${featureFolder[0]}/`;
  if (ancestor.status !== 0 || changed.some((path) => !path.startsWith(qaPrefix))) {
    console.error("QA harness must descend from the candidate with QA-feature-only changes.");
    process.exit(1);
  }
}
const manifestPath = join(featureRoot, featureFolder[0], "stages", `${stageId}.json`);
if (!(await exists(manifestPath))) {
  console.error(`Missing stage QA manifest: ${manifestPath}`);
  process.exit(1);
}
const manifest = await readJson(manifestPath);
const manifestText = await readFile(manifestPath, "utf8");
const cases = new Map();
for (const casePath of await walkFiles(join(featureRoot, featureFolder[0], "cases"), {
  extension: ".md"
})) {
  const qaCase = parseFrontmatter(await readText(casePath), casePath).data;
  const caseText = await readText(casePath);
  const automationText = await readFile(join(repoRoot, qaCase.automation));
  cases.set(qaCase.id, { data: qaCase, caseText, automationText });
}
const startedAt = new Date();
const results = [];
let failed = false;

for (const check of manifest.checks ?? []) {
  const qaCaseSource = cases.get(check.case);
  if (!qaCaseSource) {
    console.error(`Validated manifest case disappeared before execution: ${check.case}`);
    process.exit(1);
  }
  const qaCase = qaCaseSource.data;
  const required = qaCase.priority === "required";
  const sourceHashes = {
    case_sha256: createHash("sha256").update(qaCaseSource.caseText).digest("hex"),
    automation_sha256: createHash("sha256").update(qaCaseSource.automationText).digest("hex")
  };
  if (check.skip_reason) {
    const result = {
      case: check.case,
      command: check.command,
      required,
      status: "skipped",
      reason: check.skip_reason,
      duration_ms: 0,
      ...sourceHashes
    };
    results.push(result);
    if (result.required) failed = true;
    console.log(`[skipped] ${check.case}: ${check.skip_reason}`);
    continue;
  }
  const started = Date.now();
  console.log(`\n[run] ${check.case}: ${check.command}`);
  const [executable, ...commandArgs] = check.command.split(/\s+/);
  const result = spawnSync(executable, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ECHOTALK_QA_CANDIDATE: candidate }
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const status = result.status === 0 ? "passed" : "failed";
  if (status === "failed" && required) failed = true;
  results.push({
    case: check.case,
    command: check.command,
    required,
    status,
    exit_code: result.status,
    duration_ms: Date.now() - started,
    output_sha256: createHash("sha256").update(output).digest("hex"),
    ...sourceHashes
  });
}

const finishedAt = new Date();
const postHarness = git("rev-parse", "HEAD");
const postDirtyStatus = git("status", "--porcelain");
const executionStable = postHarness === harness && (dirtyStatus ? true : !postDirtyStatus);
const record = {
  schema_version: 1,
  feature: featureId,
  stage: stageId,
  candidate_sha: candidate,
  harness_sha: harness,
  manifest: `qa-automation/features/${featureFolder[0]}/stages/${stageId}.json`,
  manifest_sha256: createHash("sha256").update(manifestText).digest("hex"),
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch
  },
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  working_tree_clean: !dirtyStatus && executionStable,
  certifying_run: !dirtyStatus && executionStable,
  qa_owner: qaOwner ?? "not-recorded",
  result: failed
    ? "failed"
    : !executionStable
      ? "invalidated"
      : dirtyStatus
        ? "precheck-passed"
        : "passed",
  checks: results
};
const runDir = join(repoRoot, "qa-automation", "runs");
await mkdir(runDir, { recursive: true });
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const outputPath = join(runDir, `${stamp}-${featureId}-${stageId}-${candidate.slice(0, 12)}.json`);
await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
if (promoteEvidence && record.result === "passed") {
  const deliveryFeatureRoot = join(repoRoot, "delivery", "features");
  const deliveryFeatures = (await readdir(deliveryFeatureRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${featureId}-`));
  if (deliveryFeatures.length !== 1) {
    console.error(`Expected exactly one delivery feature folder for ${featureId}.`);
    process.exit(1);
  }
  const stagesRoot = join(deliveryFeatureRoot, deliveryFeatures[0].name, "stages");
  const stageFolders = (await readdir(stagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${stageId}-`));
  if (stageFolders.length !== 1) {
    console.error(`Expected exactly one delivery stage folder for ${stageId}.`);
    process.exit(1);
  }
  const evidencePath = join(stagesRoot, stageFolders[0].name, "gates", "qa-run.json");
  await writeFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  console.log(`Promoted redacted QA evidence: ${evidencePath}`);
}
console.log(`\nStage QA ${record.result}; local record: ${outputPath}`);
if (failed) process.exit(1);
if (!executionStable) process.exit(1);
if (dirtyStatus) process.exit(2);
