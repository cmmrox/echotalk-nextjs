#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  collectIds,
  defaultRepoRoot,
  exists,
  parseFrontmatter,
  readText,
  repoPath,
  report,
  rootFromArgs,
  walkFiles
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const featureRoot = join(repoRoot, "docs", "features");
const features = new Map();

for (const entry of await readdir(featureRoot, { withFileTypes: true }).catch(() => [])) {
  if (!entry.isDirectory()) continue;
  const path = join(featureRoot, entry.name, "feature.md");
  if (!(await exists(path))) continue;
  const text = await readText(path);
  const { data, body } = parseFrontmatter(text, repoPath(repoRoot, path));
  features.set(data.id, {
    requirements: new Set(collectIds(body, new RegExp(`${data.id}-R\\d{2}`, "g"))),
    acceptance: new Set(collectIds(body, new RegExp(`${data.id}-AC\\d{2}`, "g")))
  });
}

const taskCoverage = new Map();
const stageAcceptance = new Map();
for (const stagePath of await walkFiles(join(repoRoot, "delivery", "features"), { extension: "stage.md" })) {
  const stage = parseFrontmatter(await readText(stagePath), repoPath(repoRoot, stagePath)).data;
  stageAcceptance.set(`${stage.feature}/${stage.id}`, new Set(stage.acceptance_refs ?? []));
}
for (const taskPath of await walkFiles(join(repoRoot, "delivery", "features"), { extension: ".md" })) {
  if (!taskPath.includes("/tasks/")) continue;
  const task = parseFrontmatter(await readText(taskPath), repoPath(repoRoot, taskPath)).data;
  const key = `${task.feature}/${task.stage}`;
  if (!taskCoverage.has(key)) taskCoverage.set(key, new Set());
  for (const ref of task.acceptance_refs ?? []) taskCoverage.get(key).add(ref);
}

const qaCoverage = new Map();
for (const casePath of await walkFiles(join(repoRoot, "qa-automation", "features"), { extension: ".md" })) {
  if (!casePath.includes("/cases/")) continue;
  const qaCase = parseFrontmatter(await readText(casePath), repoPath(repoRoot, casePath)).data;
  if (qaCase.priority !== "required") continue;
  for (const stage of qaCase.stages ?? []) {
    const key = `${qaCase.feature}/${stage}`;
    if (!qaCoverage.has(key)) qaCoverage.set(key, new Set());
    for (const ref of qaCase.acceptance_refs ?? []) qaCoverage.get(key).add(ref);
  }
}

for (const [key, acceptance] of stageAcceptance) {
  const featureId = key.split("/", 1)[0];
  const feature = features.get(featureId);
  for (const ref of acceptance) {
    if (!feature?.acceptance.has(ref)) errors.push(`${key}: acceptance ref does not exist: ${ref}`);
    if (!taskCoverage.get(key)?.has(ref)) errors.push(`${key}: acceptance ref has no task coverage: ${ref}`);
    if (!qaCoverage.get(key)?.has(ref)) errors.push(`${key}: acceptance ref has no required permanent QA coverage: ${ref}`);
  }
}

report(errors, `Traceability valid: ${stageAcceptance.size} stage(s) mapped to tasks and QA.`);
