#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, sep } from "node:path";
import {
  defaultRepoRoot,
  exists,
  gitCommitExists,
  isCommit,
  parseFrontmatter,
  readJson,
  readText,
  repoPath,
  report,
  rootFromArgs,
  walkFiles
} from "./lib.mjs";
import {
  canonicalEd25519Fingerprint,
  verifyEd25519Record
} from "./crypto-evidence.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const gated = new Set([
  "qa-passed", "uat-ready", "accepted", "release-authorized", "released"
]);
const qaOrLater = new Set(["qa-passed", "uat-ready", "accepted", "release-authorized", "released"]);
const authorityRegistryPath = join(repoRoot, "docs", "product", "authority-registry.json");
const authorityRegistry = await readJson(authorityRegistryPath).catch(() => null);

function field(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^- ${escaped}:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function substantive(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/^(?:pending|tbd|unknown|not[- ]?set|version)$/i.test(value.trim()) &&
    !/(?:DURABLE_|PRODUCTION_ENVIRONMENT|DEPLOYER_PRINCIPAL_ID|PINNED_PRINCIPAL_ID|PROTECTED_REVIEW_OR_CI_ATTESTATION|YYYY-MM-DD)/i.test(value)
  );
}

function git(repo, args) {
  return spawnSync("git", args, { cwd: repo, encoding: "utf8" });
}

function gitText(commit, path) {
  const result = git(repoRoot, ["show", `${commit}:${path}`]);
  if (result.status !== 0) return null;
  return result.stdout;
}

function isAncestor(ancestor, descendant) {
  return git(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]).status === 0;
}

function gitDiffPaths(from, to) {
  const result = git(repoRoot, ["diff", "--name-only", from, to]);
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/).filter(Boolean) : null;
}

function exactRepoPath(value, expected, label) {
  if (value !== expected) {
    errors.push(`${label}: expected tracked path ${expected}`);
    return null;
  }
  const absolute = resolve(repoRoot, value);
  if (absolute !== join(repoRoot, ...value.split("/")) || value.split("/").includes("..")) {
    errors.push(`${label}: unsafe repository path`);
    return null;
  }
  return absolute;
}

async function signedRecord({
  label,
  authorityName,
  principal,
  keyCommit,
  recordPath,
  signaturePath,
  expectedRecordPath,
  expectedSignaturePath
}) {
  if (!principal || principal.status !== "assigned") {
    errors.push(`${label}: ${authorityName} is not assigned in the authority registry`);
    return null;
  }
  const verification = principal.verification;
  if (
    verification?.method !== "ed25519" ||
    !/^docs\/product\/authority-keys\/[a-z0-9][a-z0-9._-]*\.pem$/.test(verification.public_key_path ?? "") ||
    !/^[0-9a-f]{64}$/i.test(verification.public_key_sha256 ?? "")
  ) {
    errors.push(`${label}: ${authorityName} has no pinned Ed25519 verification key`);
    return null;
  }
  const recordAbsolute = exactRepoPath(recordPath, expectedRecordPath, label);
  const signatureAbsolute = exactRepoPath(signaturePath, expectedSignaturePath, label);
  if (!recordAbsolute || !signatureAbsolute) return null;
  try {
    const [recordText, signatureText] = await Promise.all([
      readText(recordAbsolute),
      readText(signatureAbsolute)
    ]);
    const publicKey = gitText(keyCommit, verification.public_key_path);
    if (publicKey === null) {
      errors.push(`${label}: pinned public key is absent from the candidate commit`);
      return null;
    }
    if (canonicalEd25519Fingerprint(publicKey) !== verification.public_key_sha256.toLowerCase()) {
      errors.push(`${label}: canonical public key fingerprint differs from the authority registry`);
      return null;
    }
    const signature = Buffer.from(signatureText.trim(), "base64");
    if (
      !signature.length ||
      !verifyEd25519Record(publicKey, Buffer.from(recordText), signature)
    ) {
      errors.push(`${label}: signature verification failed`);
      return null;
    }
    return JSON.parse(recordText);
  } catch (error) {
    errors.push(`${label}: cannot verify signed record: ${error.message}`);
    return null;
  }
}

async function validateQaEvidence({
  stage,
  stagePath,
  qa,
  qaTask,
  qaTaskPath
}) {
  const gateRoot = dirname(stagePath);
  const stageRel = repoPath(repoRoot, gateRoot);
  const qaReportRel = `${stageRel}/gates/qa-report.md`;
  const runRel = `${stageRel}/gates/qa-run.json`;
  const runPath = exactRepoPath(field(qa, "Certifying run record"), runRel, `${stage.id} QA run`);
  if (!runPath || !(await exists(runPath))) {
    errors.push(`${stage.id}: tracked certifying QA run record is missing`);
    return;
  }

  let runText;
  let run;
  try {
    runText = await readText(runPath);
    run = JSON.parse(runText);
  } catch (error) {
    errors.push(`${stage.id}: invalid certifying QA run record: ${error.message}`);
    return;
  }

  const runHash = sha256(runText);
  if (field(qa, "Certifying run record SHA-256") !== runHash) {
    errors.push(`${stage.id}: QA run record SHA-256 does not match tracked evidence`);
  }
  if (
    run.feature !== stage.feature ||
    run.stage !== stage.id ||
    run.candidate_sha !== stage.candidate_sha ||
    run.working_tree_clean !== true ||
    run.certifying_run !== true ||
    run.result !== "passed"
  ) {
    errors.push(`${stage.id}: certifying QA run identity or clean-pass state is invalid`);
  }
  if (
    !/^\/root\/[a-z0-9][a-z0-9_/-]*$/.test(run.qa_owner ?? "") ||
    run.qa_owner !== qaTask?.owner ||
    run.qa_owner !== field(qa, "QA owner")
  ) {
    errors.push(`${stage.id}: QA owner must be the canonical independent T90 agent identity`);
  }

  const harnessSha = field(qa, "QA harness/final source commit");
  if (!isCommit(harnessSha) || !gitCommitExists(repoRoot, harnessSha)) {
    errors.push(`${stage.id}: QA report lacks an existing QA harness/final source commit`);
    return;
  }
  if (!isAncestor(stage.candidate_sha, harnessSha)) {
    errors.push(`${stage.id}: QA harness commit does not descend from the candidate`);
  }
  if (run.harness_sha !== harnessSha) {
    errors.push(`${stage.id}: QA run harness identity differs from the QA report`);
  }

  const manifestText = gitText(harnessSha, run.manifest);
  if (manifestText === null) {
    errors.push(`${stage.id}: QA manifest does not exist at the recorded harness commit`);
    return;
  }
  const manifestHash = sha256(manifestText);
  if (
    run.manifest_sha256 !== manifestHash ||
    field(qa, "Certifying run manifest SHA-256") !== manifestHash
  ) {
    errors.push(`${stage.id}: certifying manifest hash does not match the recorded harness commit`);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    errors.push(`${stage.id}: recorded harness manifest is invalid JSON: ${error.message}`);
    return;
  }
  if (manifest.feature !== stage.feature || manifest.stage !== stage.id) {
    errors.push(`${stage.id}: recorded harness manifest identity is invalid`);
  }
  if (!Array.isArray(manifest.checks) || !manifest.checks.length) {
    errors.push(`${stage.id}: recorded harness manifest checks cannot be empty`);
  }

  const manifestParts = String(run.manifest).split("/");
  if (
    manifestParts.length !== 5 ||
    manifestParts[0] !== "qa-automation" ||
    manifestParts[1] !== "features" ||
    manifestParts[3] !== "stages" ||
    manifestParts[4] !== `${stage.id}.json`
  ) {
    errors.push(`${stage.id}: QA run points to an unexpected manifest path`);
    return;
  }
  const qaFeatureRoot = manifestParts.slice(0, 3).join("/");
  const caseList = git(repoRoot, [
    "ls-tree", "-r", "--name-only", harnessSha, "--", `${qaFeatureRoot}/cases`
  ]);
  if (caseList.status !== 0) {
    errors.push(`${stage.id}: cannot enumerate QA cases at the harness commit`);
    return;
  }
  const cases = new Map();
  for (const casePath of caseList.stdout.trim().split(/\r?\n/).filter((value) => value.endsWith(".md"))) {
    const caseText = gitText(harnessSha, casePath);
    if (caseText === null) continue;
    try {
      const data = parseFrontmatter(caseText, casePath).data;
      const automationText = gitText(harnessSha, data.automation);
      if (automationText === null) {
        errors.push(`${stage.id}: QA automation is absent at harness commit: ${data.automation}`);
      }
      cases.set(data.id, {
        data,
        caseHash: sha256(caseText),
        automationHash: automationText === null ? null : sha256(automationText)
      });
    } catch (error) {
      errors.push(`${stage.id}: invalid QA case at harness commit: ${error.message}`);
    }
  }

  const expected = new Map();
  for (const check of manifest.checks ?? []) {
    if (expected.has(check.case)) {
      errors.push(`${stage.id}: duplicate case in recorded harness manifest: ${check.case}`);
      continue;
    }
    const qaCaseSource = cases.get(check.case);
    const qaCase = qaCaseSource?.data;
    if (
      !qaCase ||
      qaCase.feature !== stage.feature ||
      !qaCase.stages?.includes(stage.id) ||
      qaCase.command !== check.command
    ) {
      errors.push(`${stage.id}: manifest case ${check.case} differs from its harness case`);
      continue;
    }
    if ("required" in check) {
      errors.push(`${stage.id}: recorded manifest duplicates QA requiredness`);
    }
    if (qaCase.priority === "required" && check.skip_reason) {
      errors.push(`${stage.id}: required harness case ${check.case} is skipped`);
    }
    expected.set(check.case, {
      required: qaCase.priority === "required",
      command: check.command,
      skipReason: check.skip_reason ?? null,
      caseHash: qaCaseSource.caseHash,
      automationHash: qaCaseSource.automationHash
    });
  }
  for (const qaCaseSource of cases.values()) {
    const qaCase = qaCaseSource.data;
    if (
      qaCase.feature === stage.feature &&
      qaCase.stages?.includes(stage.id) &&
      !expected.has(qaCase.id)
    ) {
      errors.push(`${stage.id}: applicable harness case missing from manifest: ${qaCase.id}`);
    }
  }
  for (const acceptanceRef of stage.acceptance_refs ?? []) {
    const covered = [...cases.values()].some(({ data: qaCase }) =>
      qaCase.feature === stage.feature &&
      qaCase.stages?.includes(stage.id) &&
      qaCase.priority === "required" &&
      qaCase.acceptance_refs?.includes(acceptanceRef)
    );
    if (!covered) errors.push(`${stage.id}: harness lacks required QA coverage for ${acceptanceRef}`);
  }

  const actual = new Map();
  for (const check of run.checks ?? []) {
    if (actual.has(check.case)) errors.push(`${stage.id}: duplicate run result ${check.case}`);
    actual.set(check.case, check);
  }
  if (actual.size !== expected.size) {
    errors.push(`${stage.id}: run result set differs from the harness manifest`);
  }
  for (const [caseId, expectation] of expected) {
    const result = actual.get(caseId);
    if (
      !result ||
      result.required !== expectation.required ||
      result.command !== expectation.command ||
      result.case_sha256 !== expectation.caseHash ||
      result.automation_sha256 !== expectation.automationHash
    ) {
      errors.push(`${stage.id}: run result requiredness differs for ${caseId}`);
    } else if (
      expectation.required &&
      (
        result.status !== "passed" ||
        result.exit_code !== 0 ||
        !/^[0-9a-f]{64}$/i.test(result.output_sha256 ?? "")
      )
    ) {
      errors.push(`${stage.id}: required QA case ${caseId} did not pass`);
    } else if (
      !expectation.required &&
      expectation.skipReason &&
      (result.status !== "skipped" || result.reason !== expectation.skipReason)
    ) {
      errors.push(`${stage.id}: optional skip result differs for ${caseId}`);
    }
  }

  if (qaTask?.base_sha !== stage.candidate_sha) {
    errors.push(`${stage.id}: T90 base_sha must equal the certified candidate`);
  }
  if (!isCommit(qaTask?.result_sha) || !gitCommitExists(repoRoot, qaTask?.result_sha)) {
    errors.push(`${stage.id}: completed T90 requires an existing evidence result commit`);
    return;
  }
  if (!isAncestor(stage.candidate_sha, qaTask.result_sha)) {
    errors.push(`${stage.id}: T90 evidence commit does not descend from the candidate`);
  }
  const resultRun = gitText(qaTask.result_sha, runRel);
  const resultReport = gitText(qaTask.result_sha, qaReportRel);
  if (resultRun === null || sha256(resultRun) !== runHash) {
    errors.push(`${stage.id}: T90 result commit does not contain the certified QA run`);
  }
  if (resultReport === null || resultReport !== qa) {
    errors.push(`${stage.id}: T90 result commit does not contain the current QA report`);
  }
  const harnessChangedPaths = gitDiffPaths(stage.candidate_sha, harnessSha);
  const evidenceChangedPaths = gitDiffPaths(harnessSha, qaTask.result_sha);
  const allowedQaPrefix = `${qaFeatureRoot}/`;
  const allowedGatePaths = new Set([runRel, qaReportRel]);
  if (
    !harnessChangedPaths ||
    harnessChangedPaths.some((path) => !path.startsWith(allowedQaPrefix))
  ) {
    errors.push(`${stage.id}: candidate-to-harness diff exceeds the QA-feature allowlist`);
  }
  if (
    !evidenceChangedPaths ||
    evidenceChangedPaths.some((path) => !allowedGatePaths.has(path))
  ) {
    errors.push(`${stage.id}: harness-to-T90 result diff exceeds the evidence-only allowlist`);
  }
  if (
    qaTaskPath &&
    repoPath(repoRoot, qaTaskPath) === runRel
  ) {
    errors.push(`${stage.id}: invalid T90 task/evidence path collision`);
  }
}

if (!authorityRegistry) {
  errors.push("missing or invalid docs/product/authority-registry.json");
}

for (const stagePath of await walkFiles(join(repoRoot, "delivery", "features"), { extension: "stage.md" })) {
  const stage = parseFrontmatter(await readText(stagePath), repoPath(repoRoot, stagePath)).data;
  const gates = join(dirname(stagePath), "gates");
  const qa = await readText(join(gates, "qa-report.md")).catch(() => "");
  const uat = await readText(join(gates, "uat-record.md")).catch(() => "");
  const release = await readText(join(gates, "release-evidence.md")).catch(() => "");
  const tasksRoot = join(dirname(stagePath), "tasks");
  const qaTaskPath = (await walkFiles(tasksRoot, { extension: ".md" }))
    .find((path) => path.includes(`${sep}T90-`));
  const qaTask = qaTaskPath
    ? parseFrontmatter(await readText(qaTaskPath), repoPath(repoRoot, qaTaskPath)).data
    : null;
  const stageRel = repoPath(repoRoot, dirname(stagePath));
  let stageRegistry = authorityRegistry;
  if (gated.has(stage.status) && isCommit(stage.candidate_sha) && gitCommitExists(repoRoot, stage.candidate_sha)) {
    const candidateRegistryText = gitText(
      stage.candidate_sha,
      "docs/product/authority-registry.json"
    );
    try {
      stageRegistry = candidateRegistryText ? JSON.parse(candidateRegistryText) : null;
    } catch (error) {
      stageRegistry = null;
      errors.push(`${stage.id}: candidate authority registry is invalid JSON: ${error.message}`);
    }
    if (!stageRegistry) {
      errors.push(`${stage.id}: candidate does not contain the authority registry`);
    }
  }
  const stageAuthority = (name) => stageRegistry?.authorities?.[name] ?? null;

  for (const [stageField, registryName] of [
    ["product_owner", "product_owner"],
    ["human_client", "human_client"],
    ["release_owner", "release_owner"]
  ]) {
    const registered = stageAuthority(registryName)?.principal_id;
    if (!registered || stage[stageField] !== registered) {
      errors.push(`${stage.id}: ${stageField} must match the canonical authority registry`);
    }
  }
  if (
    stage.status !== "proposed" &&
    (
      stageAuthority("product_owner")?.status !== "assigned" ||
      stageAuthority("human_client")?.status !== "assigned"
    )
  ) {
    errors.push(`${stage.id}: active stage requires assigned product-owner and human-client authorities`);
  }

  if (gated.has(stage.status)) {
    if (!isCommit(stage.candidate_sha) || !gitCommitExists(repoRoot, stage.candidate_sha)) {
      errors.push(`${stage.id}: gated stage lacks an existing full candidate_sha`);
    }
    if (!["passed", "qa-passed"].includes(field(qa, "Status"))) {
      errors.push(`${stage.id}: ${stage.status} requires a passed QA report`);
    }
    const qaCandidate = field(qa, "Candidate commit/artifact").split(/\s/, 1)[0];
    if (qaCandidate !== stage.candidate_sha) errors.push(`${stage.id}: QA candidate does not match stage`);
  }
  if (qaOrLater.has(stage.status)) {
    if (!qaTask || qaTask.status !== "done" || qaTask.owner_role !== "qa-engineer") {
      errors.push(`${stage.id}: QA gate requires a completed QA-owned T90`);
    }
    if (field(qa, "QA owner") !== qaTask?.owner || /pending/i.test(field(qa, "QA owner"))) {
      errors.push(`${stage.id}: QA report owner must match the named T90 owner`);
    }
    if (field(qa, "Certifying run result") !== "passed") {
      errors.push(`${stage.id}: QA report lacks a passed certifying run`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(field(qa, "QA completed at"))) {
      errors.push(`${stage.id}: QA report lacks a completion timestamp`);
    }
    await validateQaEvidence({ stage, stagePath, qa, qaTask, qaTaskPath });
  }
  if (["uat-ready", "accepted", "release-authorized", "released"].includes(stage.status)) {
    if (!field(uat, "Candidate commit/artifact").includes(stage.candidate_sha)) {
      errors.push(`${stage.id}: UAT record does not identify the QA candidate`);
    }
  }

  let uatDecision = null;
  if (["accepted", "release-authorized", "released"].includes(stage.status)) {
    const expectedRecord = `${stageRel}/gates/uat-decision.json`;
    const expectedSignature = `${stageRel}/gates/uat-decision.sig`;
    uatDecision = await signedRecord({
      label: `${stage.id} UAT`,
      authorityName: "human_client",
      principal: stageAuthority("human_client"),
      keyCommit: stage.candidate_sha,
      recordPath: field(uat, "Signed decision record"),
      signaturePath: field(uat, "Decision signature"),
      expectedRecordPath: expectedRecord,
      expectedSignaturePath: expectedSignature
    });
    if (uatDecision) {
      const validConditions =
        uatDecision.decision === "accepted"
          ? Array.isArray(uatDecision.conditions) && uatDecision.conditions.length === 0
          : (
              uatDecision.decision === "accepted-with-conditions" &&
              Array.isArray(uatDecision.conditions) &&
              uatDecision.conditions.length > 0 &&
              uatDecision.conditions.every((condition) =>
                condition &&
                substantive(condition.owner) &&
                /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?/.test(condition.deadline ?? "") &&
                substantive(condition.risk) &&
                typeof condition.release_permitted === "boolean"
              )
            );
      if (
        uatDecision.schema_version !== 1 ||
        uatDecision.feature !== stage.feature ||
        uatDecision.stage !== stage.id ||
        uatDecision.candidate_sha !== stage.candidate_sha ||
        uatDecision.human_client !== stage.human_client ||
        !["accepted", "accepted-with-conditions"].includes(uatDecision.decision) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(uatDecision.decided_at ?? "") ||
        !Array.isArray(uatDecision.evidence_refs) ||
        !uatDecision.evidence_refs.length ||
        !uatDecision.evidence_refs.every(substantive) ||
        !validConditions
      ) {
        errors.push(`${stage.id}: signed UAT decision content is invalid`);
      }
      if (
        field(uat, "Decision") !== uatDecision.decision ||
        field(uat, "Decision at") !== uatDecision.decided_at ||
        field(uat, "Human client") !== uatDecision.human_client
      ) {
        errors.push(`${stage.id}: UAT summary differs from the signed decision`);
      }
    }
  }

  let releaseAuthorization = null;
  if (["release-authorized", "released"].includes(stage.status)) {
    if (
      stageRegistry?.change_control?.protected_branch_required_for_release !== true ||
      stageRegistry?.change_control?.external_qa_attestation_required_for_release !== true
    ) {
      errors.push(`${stage.id}: candidate authority registry lacks required release trust controls`);
    }
    if (
      stageAuthority("release_owner")?.status !== "assigned" ||
      stage.release_owner === stage.human_client
    ) {
      errors.push(`${stage.id}: release requires a distinct assigned release-owner principal`);
    }
    const clientKeyFingerprint =
      stageAuthority("human_client")?.verification?.public_key_sha256;
    const releaseKeyFingerprint =
      stageAuthority("release_owner")?.verification?.public_key_sha256;
    if (
      !/^[0-9a-f]{64}$/i.test(clientKeyFingerprint ?? "") ||
      !/^[0-9a-f]{64}$/i.test(releaseKeyFingerprint ?? "") ||
      clientKeyFingerprint.toLowerCase() === releaseKeyFingerprint.toLowerCase()
    ) {
      errors.push(`${stage.id}: client and release owner require distinct pinned verification keys`);
    }
    if (
      !uatDecision ||
      uatDecision.production_release_authorized !== true ||
      uatDecision.conditions?.some((condition) => condition.release_permitted !== true) ||
      !/^yes\b/i.test(field(uat, "Production release authorized")) ||
      !/^yes\b/i.test(field(release, "Client production permission"))
    ) {
      errors.push(`${stage.id}: release requires signed client production permission`);
    }
    releaseAuthorization = await signedRecord({
      label: `${stage.id} release authorization`,
      authorityName: "release_owner",
      principal: stageAuthority("release_owner"),
      keyCommit: stage.candidate_sha,
      recordPath: field(release, "Signed authorization record"),
      signaturePath: field(release, "Authorization signature"),
      expectedRecordPath: `${stageRel}/gates/release-authorization.json`,
      expectedSignaturePath: `${stageRel}/gates/release-authorization.sig`
    });
    if (releaseAuthorization) {
      if (
        releaseAuthorization.schema_version !== 1 ||
        releaseAuthorization.feature !== stage.feature ||
        releaseAuthorization.stage !== stage.id ||
        releaseAuthorization.candidate_sha !== stage.candidate_sha ||
        releaseAuthorization.release_owner !== stage.release_owner ||
        releaseAuthorization.operational_decision !== "go" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(releaseAuthorization.approved_at ?? "") ||
        !/^(?:sha256:[0-9a-f]{64}|git:[0-9a-f]{40})$/i.test(releaseAuthorization.immutable_artifact ?? "") ||
        !substantive(releaseAuthorization.configuration_schema_version) ||
        !substantive(releaseAuthorization.environment) ||
        !substantive(releaseAuthorization.qa_independence_evidence) ||
        !substantive(releaseAuthorization.rollback_ref)
      ) {
        errors.push(`${stage.id}: signed release authorization content is invalid`);
      }
      if (
        field(release, "Accepted source commit") !== releaseAuthorization.candidate_sha ||
        field(release, "Immutable artifact/digest") !== releaseAuthorization.immutable_artifact ||
        field(release, "Configuration/schema version") !== releaseAuthorization.configuration_schema_version ||
        field(release, "Environment") !== releaseAuthorization.environment ||
        field(release, "Human release owner") !== releaseAuthorization.release_owner ||
        !/^go\b/i.test(field(release, "Operational go/no-go"))
      ) {
        errors.push(`${stage.id}: release summary differs from the signed authorization`);
      }
    }
  }

  if (stage.status === "released") {
    const releaseResult = await signedRecord({
      label: `${stage.id} release result`,
      authorityName: "release_owner",
      principal: stageAuthority("release_owner"),
      keyCommit: stage.candidate_sha,
      recordPath: field(release, "Signed release result"),
      signaturePath: field(release, "Release result signature"),
      expectedRecordPath: `${stageRel}/gates/release-result.json`,
      expectedSignaturePath: `${stageRel}/gates/release-result.sig`
    });
    if (field(release, "Status") !== "released") {
      errors.push(`${stage.id}: released stage lacks released evidence status`);
    }
    if (releaseResult) {
      if (
        releaseResult.schema_version !== 1 ||
        releaseResult.feature !== stage.feature ||
        releaseResult.stage !== stage.id ||
        releaseResult.candidate_sha !== stage.candidate_sha ||
        releaseResult.release_owner !== stage.release_owner ||
        releaseResult.immutable_artifact !== releaseAuthorization?.immutable_artifact ||
        !substantive(releaseResult.deployer) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(releaseResult.deployed_at ?? "") ||
        releaseResult.deployment_verification !== "passed" ||
        releaseResult.monitoring_result !== "passed" ||
        !substantive(releaseResult.rollback_ref)
      ) {
        errors.push(`${stage.id}: signed release result content is invalid`);
      }
      if (
        field(release, "Deployer/date") !== `${releaseResult.deployer} / ${releaseResult.deployed_at}` ||
        !/^passed\b/i.test(field(release, "Deployment/post-deployment verification")) ||
        !/^passed\b/i.test(field(release, "Monitoring result")) ||
        field(release, "Rollback artifact and procedure") !== releaseResult.rollback_ref
      ) {
        errors.push(`${stage.id}: release result summary differs from the signed result`);
      }
    }
  }
  if (!["accepted", "release-authorized", "released"].includes(stage.status)) {
    const decision = field(uat, "Decision");
    if (decision && !/pending/i.test(decision)) {
      errors.push(`${stage.id}: UAT decision is populated before accepted status`);
    }
  }
}

report(errors, "Release gates valid for all current stages.");
