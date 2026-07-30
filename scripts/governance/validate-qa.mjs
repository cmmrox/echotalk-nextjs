#!/usr/bin/env node

import { join } from "node:path";
import {
  defaultRepoRoot,
  exists,
  parseFrontmatter,
  readJson,
  readText,
  repoPath,
  report,
  requireFields,
  rootFromArgs,
  walkFiles
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const cases = new Map();
const qaRoot = join(repoRoot, "qa-automation", "features");
const safeCommand = /^[a-zA-Z0-9_./:@=-]+(?: [a-zA-Z0-9_./:@=-]+)*$/;

for (const casePath of await walkFiles(qaRoot, { extension: ".md" })) {
  if (!casePath.includes("/cases/")) continue;
  try {
    const { data, body } = parseFrontmatter(await readText(casePath), repoPath(repoRoot, casePath));
    requireFields(
      data,
      ["id", "feature", "stages", "acceptance_refs", "risk", "priority", "automation", "command"],
      repoPath(repoRoot, casePath),
      errors
    );
    if (!/^TC-F\d{3}-\d{3}$/.test(data.id)) errors.push(`${repoPath(repoRoot, casePath)}: invalid QA case id`);
    if (cases.has(data.id)) errors.push(`duplicate QA case id ${data.id}`);
    cases.set(data.id, { data, path: casePath });
    if (!Array.isArray(data.stages) || !data.stages.length) errors.push(`${data.id}: stages cannot be empty`);
    if (!Array.isArray(data.acceptance_refs) || !data.acceptance_refs.length) {
      errors.push(`${data.id}: acceptance_refs cannot be empty`);
    }
    if (!["required", "optional"].includes(data.priority)) errors.push(`${data.id}: invalid priority`);
    if (!body.includes("## Expected results")) errors.push(`${data.id}: missing expected results`);
    if (data.automation === "pending" || !(await exists(join(repoRoot, data.automation)))) {
      errors.push(`${data.id}: automation does not exist: ${data.automation}`);
    }
    if (
      data.command === "pending" ||
      !safeCommand.test(String(data.command)) ||
      !String(data.command).split(/\s+/).includes(String(data.automation))
    ) {
      errors.push(`${data.id}: command must invoke the declared automation`);
    }
  } catch (error) {
    errors.push(error.message);
  }
}

for (const stagePath of await walkFiles(join(repoRoot, "delivery", "features"), { extension: "stage.md" })) {
  const stage = parseFrontmatter(await readText(stagePath), repoPath(repoRoot, stagePath)).data;
  const parts = repoPath(repoRoot, stagePath).split("/");
  const featureFolder = parts[2];
  const manifestPath = join(qaRoot, featureFolder, "stages", `${stage.id}.json`);
  if (!(await exists(manifestPath))) {
    if (stage.status !== "proposed") {
      errors.push(`${stage.feature}/${stage.id}: missing QA stage manifest`);
    }
    continue;
  }
  try {
    const manifest = await readJson(manifestPath);
    if (manifest.feature !== stage.feature || manifest.stage !== stage.id) {
      errors.push(`${repoPath(repoRoot, manifestPath)}: feature/stage mismatch`);
    }
    if (!Array.isArray(manifest.checks) || !manifest.checks.length) {
      errors.push(`${repoPath(repoRoot, manifestPath)}: checks cannot be empty`);
    }
    const manifestCases = new Set();
    for (const check of manifest.checks ?? []) {
      const qaCase = cases.get(check.case);
      if (!qaCase) errors.push(`${repoPath(repoRoot, manifestPath)}: unknown case ${check.case}`);
      if (manifestCases.has(check.case)) {
        errors.push(`${repoPath(repoRoot, manifestPath)}: duplicate case ${check.case}`);
      }
      if (!check.command || typeof check.command !== "string") {
        errors.push(`${repoPath(repoRoot, manifestPath)}: ${check.case} has no command`);
      }
      if (qaCase && check.command !== qaCase.data.command) {
        errors.push(`${repoPath(repoRoot, manifestPath)}: ${check.case} command differs from its case`);
      }
      if ("required" in check) {
        errors.push(`${repoPath(repoRoot, manifestPath)}: ${check.case} requiredness must come from its QA case`);
      }
      if (qaCase?.data.priority === "required" && check.skip_reason) {
        errors.push(`${repoPath(repoRoot, manifestPath)}: required case ${check.case} cannot be skipped`);
      }
      manifestCases.add(check.case);
    }
    for (const [id, qaCase] of cases) {
      if (
        qaCase.data.feature === stage.feature &&
        qaCase.data.stages.includes(stage.id) &&
        !manifestCases.has(id)
      ) {
        errors.push(`${stage.feature}/${stage.id}: permanent case missing from manifest: ${id}`);
      }
    }
    for (const acceptanceRef of stage.acceptance_refs ?? []) {
      const requiredCoverage = [...cases.values()].some((qaCase) =>
        qaCase.data.feature === stage.feature &&
        qaCase.data.stages.includes(stage.id) &&
        qaCase.data.priority === "required" &&
        qaCase.data.acceptance_refs.includes(acceptanceRef)
      );
      if (!requiredCoverage) {
        errors.push(`${stage.feature}/${stage.id}: ${acceptanceRef} has no required QA case`);
      }
    }
  } catch (error) {
    errors.push(`${repoPath(repoRoot, manifestPath)}: invalid JSON: ${error.message}`);
  }
}

if (!cases.size) errors.push("no permanent QA cases found");
report(errors, `QA library valid: ${cases.size} permanent case(s).`);
