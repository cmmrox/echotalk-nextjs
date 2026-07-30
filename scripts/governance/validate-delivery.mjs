#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  collectIds,
  defaultRepoRoot,
  exists,
  gitCommitExists,
  isCommit,
  parseFrontmatter,
  readJson,
  readText,
  repoPath,
  report,
  requireFields,
  rootFromArgs
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const featureStatuses = new Set(["draft", "approved", "superseded", "retired"]);
const taskStatuses = new Set([
  "draft", "ready", "in-progress", "in-review", "done", "blocked",
  "deferred", "superseded"
]);
const stageStatuses = new Set([
  "proposed", "ready", "in-progress", "candidate-frozen", "qa-passed",
  "uat-ready", "accepted", "release-authorized", "released"
]);
const taskFields = [
  "id", "feature", "stage", "slug", "type", "status", "owner_role",
  "reviewer_role", "owner", "reviewer", "base_sha", "result_sha", "depends_on", "requirement_refs",
  "acceptance_refs", "writable_paths", "prohibited_paths", "test_commands",
  "next_owner"
];
const taskSections = [
  "## Outcome",
  "## Included scope and exclusions",
  "## Development",
  "## Tests",
  "## Acceptance criteria",
  "## Security, privacy, and data impact",
  "## Observability, configuration, and migration",
  "## Rollout and rollback",
  "## Evidence and handoff"
];
const stageRecords = [];
const roleManifest = await readJson(join(repoRoot, ".agents", "roles", "manifest.json")).catch(() => ({ roles: [] }));
const roleSlugs = new Set(roleManifest.roles.map((role) => role.slug));
const authorityRegistry = await readJson(
  join(repoRoot, "docs", "product", "authority-registry.json")
).catch(() => null);
const authorities = authorityRegistry?.authorities ?? {};

async function directories(path) {
  if (!(await exists(path))) return [];
  return (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const featureDocsRoot = join(repoRoot, "docs", "features");
const deliveryRoot = join(repoRoot, "delivery", "features");
const features = new Map();
const featureIds = new Set();
for (const folder of await directories(featureDocsRoot)) {
  const path = join(featureDocsRoot, folder, "feature.md");
  if (!(await exists(path))) {
    errors.push(`${repoPath(repoRoot, join(featureDocsRoot, folder))}: missing feature.md`);
    continue;
  }
  try {
    const text = await readText(path);
    const { data, body } = parseFrontmatter(text, repoPath(repoRoot, path));
    requireFields(data, ["id", "slug", "status", "kind", "product_owner"], repoPath(repoRoot, path), errors);
    if (featureIds.has(data.id)) errors.push(`duplicate feature id ${data.id}`);
    featureIds.add(data.id);
    if (!/^F\d{3}$/.test(data.id)) errors.push(`${repoPath(repoRoot, path)}: invalid feature id`);
    if (folder !== `${data.id}-${data.slug}`) {
      errors.push(`${repoPath(repoRoot, path)}: folder must be ${data.id}-${data.slug}`);
    }
    if (!featureStatuses.has(data.status)) errors.push(`${data.id}: invalid feature status ${data.status}`);
    if (
      data.status === "approved" &&
      (
        authorities.product_owner?.status !== "assigned" ||
        data.product_owner !== authorities.product_owner?.principal_id
      )
    ) {
      errors.push(`${data.id}: approved feature product_owner must match the assigned authority registry`);
    }
    const requirements = new Set(collectIds(body, new RegExp(`${data.id}-R\\d{2}`, "g")));
    const acceptance = new Set(collectIds(body, new RegExp(`${data.id}-AC\\d{2}`, "g")));
    if (!requirements.size) errors.push(`${data.id}: feature has no stable requirements`);
    if (!acceptance.size) errors.push(`${data.id}: feature has no stable acceptance criteria`);
    features.set(data.id, { data, path, requirements, acceptance, folder });
  } catch (error) {
    errors.push(error.message);
  }
}

const stageIds = new Set();
for (const featureFolder of await directories(deliveryRoot)) {
  const boardPath = join(deliveryRoot, featureFolder, "README.md");
  if (!(await exists(boardPath))) {
    errors.push(`${featureFolder}: missing delivery README.md`);
    continue;
  }
  let board;
  try {
    board = parseFrontmatter(await readText(boardPath), repoPath(repoRoot, boardPath)).data;
  } catch (error) {
    errors.push(error.message);
    continue;
  }
  requireFields(board, ["id", "status", "feature_doc"], repoPath(repoRoot, boardPath), errors);
  const feature = features.get(board.id);
  if (!feature) {
    errors.push(`${featureFolder}: delivery board references missing feature ${board.id}`);
    continue;
  }
  if (featureFolder !== feature.folder) {
    errors.push(`${featureFolder}: delivery folder must match ${feature.folder}`);
  }
  if (!(await exists(join(repoRoot, board.feature_doc)))) {
    errors.push(`${featureFolder}: feature_doc does not exist`);
  }

  const stagesRoot = join(deliveryRoot, featureFolder, "stages");
  for (const stageFolder of await directories(stagesRoot)) {
    const stagePath = join(stagesRoot, stageFolder, "stage.md");
    if (!(await exists(stagePath))) {
      errors.push(`${stageFolder}: missing stage.md`);
      continue;
    }
    let stage;
    try {
      stage = parseFrontmatter(await readText(stagePath), repoPath(repoRoot, stagePath)).data;
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    requireFields(
      stage,
      [
        "id", "feature", "slug", "status", "acceptance_refs", "depends_on",
        "final_qa_task", "candidate_sha", "product_owner", "human_client",
        "release_owner"
      ],
      repoPath(repoRoot, stagePath),
      errors
    );
    if (!/^S\d{2}$/.test(stage.id)) errors.push(`${stageFolder}: invalid stage id`);
    if (stageIds.has(stage.id)) errors.push(`duplicate stage id ${stage.id}`);
    stageIds.add(stage.id);
    if (stage.feature !== board.id) errors.push(`${stage.id}: feature mismatch`);
    if (stageFolder !== `${stage.id}-${stage.slug}`) {
      errors.push(`${stage.id}: folder must be ${stage.id}-${stage.slug}`);
    }
    if (!stageStatuses.has(stage.status)) errors.push(`${stage.id}: invalid status ${stage.status}`);
    if (!Array.isArray(stage.acceptance_refs)) errors.push(`${stage.id}: acceptance_refs must be an inline array`);
    if (!Array.isArray(stage.depends_on)) errors.push(`${stage.id}: depends_on must be an inline array`);
    if (stage.status !== "proposed" && !stage.acceptance_refs?.length) {
      errors.push(`${stage.id}: active stage requires a non-empty acceptance subset`);
    }
    if (
      stage.status !== "proposed" &&
      feature.data.status !== "approved"
    ) {
      errors.push(`${stage.id}: non-proposed stage requires an approved feature`);
    }
    if (stage.status !== "proposed") {
      for (const [stageField, authorityName] of [
        ["product_owner", "product_owner"],
        ["human_client", "human_client"]
      ]) {
        if (
          authorities[authorityName]?.status !== "assigned" ||
          stage[stageField] !== authorities[authorityName]?.principal_id
        ) {
          errors.push(`${stage.id}: ${stageField} must match an assigned authority registry principal`);
        }
      }
    }
    if (stage.release_owner !== authorities.release_owner?.principal_id) {
      errors.push(`${stage.id}: release_owner must match the authority registry`);
    }
    if (
      ["candidate-frozen", "qa-passed", "uat-ready", "accepted", "release-authorized", "released"].includes(stage.status) &&
      !isCommit(stage.candidate_sha)
    ) {
      errors.push(`${stage.id}: frozen or later stage requires an exact candidate_sha`);
    }
    if (
      ["candidate-frozen", "qa-passed", "uat-ready", "accepted", "release-authorized", "released"].includes(stage.status) &&
      !gitCommitExists(repoRoot, stage.candidate_sha)
    ) {
      errors.push(`${stage.id}: candidate_sha is not an existing Git commit`);
    }
    stageRecords.push({ id: stage.id, data: stage, path: stagePath });
    for (const ref of stage.acceptance_refs ?? []) {
      if (!feature.acceptance.has(ref)) errors.push(`${stage.id}: unknown acceptance ref ${ref}`);
    }

    const tasksRoot = join(stagesRoot, stageFolder, "tasks");
    const taskFiles = (await readdir(tasksRoot, { withFileTypes: true }).catch(() => []))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
    const tasks = new Map();
    for (const file of taskFiles) {
      const taskPath = join(tasksRoot, file);
      const text = await readText(taskPath);
      try {
        const { data, body } = parseFrontmatter(text, repoPath(repoRoot, taskPath));
        requireFields(data, taskFields, repoPath(repoRoot, taskPath), errors);
        if (tasks.has(data.id)) errors.push(`${stage.id}: duplicate task id ${data.id}`);
        tasks.set(data.id, { data, body, path: taskPath });
        if (!/^T\d{2}$/.test(data.id)) errors.push(`${repoPath(repoRoot, taskPath)}: invalid task id`);
        if (file !== `${data.id}-${data.slug}.md`) {
          errors.push(`${repoPath(repoRoot, taskPath)}: filename must be ${data.id}-${data.slug}.md`);
        }
        if (data.feature !== stage.feature || data.stage !== stage.id) {
          errors.push(`${data.id}: feature/stage parent mismatch`);
        }
        if (!taskStatuses.has(data.status)) errors.push(`${stage.id}/${data.id}: invalid status ${data.status}`);
        if (!roleSlugs.has(data.owner_role)) {
          errors.push(`${stage.id}/${data.id}: unknown owner_role ${data.owner_role}`);
        }
        if (!roleSlugs.has(data.reviewer_role)) {
          errors.push(`${stage.id}/${data.id}: unknown reviewer_role ${data.reviewer_role}`);
        }
        if (data.owner_role === data.reviewer_role) {
          errors.push(`${stage.id}/${data.id}: owner and reviewer roles must differ`);
        }
        if (data.owner === data.reviewer && !/pending/i.test(String(data.owner))) {
          errors.push(`${stage.id}/${data.id}: actual owner and reviewer must differ`);
        }
        if (
          data.status === "done" &&
          (/pending/i.test(String(data.owner)) || /pending/i.test(String(data.reviewer)))
        ) {
          errors.push(`${stage.id}/${data.id}: done task requires named owner and reviewer`);
        }
        if (
          ["ready", "in-progress", "in-review", "done"].includes(data.status) &&
          !isCommit(data.base_sha)
        ) {
          errors.push(`${stage.id}/${data.id}: active task requires exact base_sha`);
        }
        if (data.status === "done" && !isCommit(data.result_sha)) {
          errors.push(`${stage.id}/${data.id}: done task requires exact result_sha`);
        }
        if (data.status === "done" && !gitCommitExists(repoRoot, data.result_sha)) {
          errors.push(`${stage.id}/${data.id}: result_sha is not an existing Git commit`);
        }
        for (const ref of data.requirement_refs ?? []) {
          if (!feature.requirements.has(ref)) errors.push(`${stage.id}/${data.id}: unknown requirement ${ref}`);
        }
        for (const ref of data.acceptance_refs ?? []) {
          if (!feature.acceptance.has(ref)) errors.push(`${stage.id}/${data.id}: unknown acceptance ${ref}`);
        }
        for (const field of ["depends_on", "requirement_refs", "acceptance_refs", "writable_paths", "prohibited_paths", "test_commands"]) {
          if (!Array.isArray(data[field])) errors.push(`${stage.id}/${data.id}: ${field} must be an inline array`);
        }
        if (!data.writable_paths?.length) errors.push(`${stage.id}/${data.id}: writable_paths cannot be empty`);
        if (!data.prohibited_paths?.length) errors.push(`${stage.id}/${data.id}: prohibited_paths cannot be empty`);
        if (!data.test_commands?.length) errors.push(`${stage.id}/${data.id}: test_commands cannot be empty`);
        for (const section of taskSections) {
          if (!body.includes(section)) errors.push(`${stage.id}/${data.id}: missing section ${section}`);
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (!tasks.size) errors.push(`${stage.id}: stage has no tasks`);
    for (const [id, task] of tasks) {
      for (const dependency of task.data.depends_on ?? []) {
        if (!tasks.has(dependency)) errors.push(`${stage.id}/${id}: missing dependency ${dependency}`);
        if (dependency === id) errors.push(`${stage.id}/${id}: task cannot depend on itself`);
      }
    }

    const visiting = new Set();
    const visited = new Set();
    function visit(id) {
      if (visiting.has(id)) {
        errors.push(`${stage.id}: cyclic task dependency at ${id}`);
        return;
      }
      if (visited.has(id) || !tasks.has(id)) return;
      visiting.add(id);
      for (const dependency of tasks.get(id).data.depends_on ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    }
    for (const id of tasks.keys()) visit(id);

    const qaTasks = [...tasks.values()].filter((task) => task.data.type === "stage-qa");
    if (qaTasks.length !== 1) errors.push(`${stage.id}: exactly one stage-qa task is required`);
    const qaTask = qaTasks[0];
    if (qaTask) {
      if (qaTask.data.id !== stage.final_qa_task || qaTask.data.id !== "T90") {
        errors.push(`${stage.id}: final stage QA task must be T90`);
      }
      if (qaTask.data.owner_role !== "qa-engineer") {
        errors.push(`${stage.id}/T90: owner_role must be qa-engineer`);
      }
      const closure = new Set();
      function collect(id) {
        for (const dependency of tasks.get(id)?.data.depends_on ?? []) {
          if (!closure.has(dependency)) {
            closure.add(dependency);
            collect(dependency);
          }
        }
      }
      collect(qaTask.data.id);
      for (const id of tasks.keys()) {
        if (id !== qaTask.data.id && !closure.has(id)) {
          errors.push(`${stage.id}/T90: must depend transitively on ${id}`);
        }
      }
      for (const [id, task] of tasks) {
        if (id !== qaTask.data.id && task.data.depends_on?.includes(qaTask.data.id)) {
          errors.push(`${stage.id}/T90: must be the final dependency sink; ${id} depends on it`);
        }
      }
      if (
        ["qa-passed", "uat-ready", "accepted", "release-authorized", "released"].includes(stage.status) &&
        qaTask.data.status !== "done"
      ) {
        errors.push(`${stage.id}: ${stage.status} requires T90 status done`);
      }
      if (qaTask.data.status === "done") {
        if (!/^\/root\/[a-z0-9][a-z0-9_/-]*$/.test(qaTask.data.owner)) {
          errors.push(`${stage.id}/T90: done QA owner must be a canonical /root/<agent> identity`);
        }
        if (qaTask.data.base_sha !== stage.candidate_sha) {
          errors.push(`${stage.id}/T90: base_sha must equal the stage candidate`);
        }
        for (const [id, task] of tasks) {
          if (id !== qaTask.data.id && task.data.owner === qaTask.data.owner) {
            errors.push(`${stage.id}/T90: independent QA owner also owns ${id}`);
          }
        }
      }
    }
    if (
      ["candidate-frozen", "qa-passed", "uat-ready", "accepted", "release-authorized", "released"].includes(stage.status)
    ) {
      for (const [id, task] of tasks) {
        if (id !== "T90" && task.data.status !== "done") {
          errors.push(`${stage.id}: ${stage.status} requires ${id} status done`);
        }
      }
    }

    const active = [...tasks.values()].filter((task) => task.data.status === "in-progress");
    for (let left = 0; left < active.length; left += 1) {
      for (let right = left + 1; right < active.length; right += 1) {
        const leftPaths = active[left].data.writable_paths ?? [];
        const rightPaths = active[right].data.writable_paths ?? [];
        for (const a of leftPaths) {
          for (const b of rightPaths) {
            const aBase = String(a).replace(/\/\*\*$/, "");
            const bBase = String(b).replace(/\/\*\*$/, "");
            if (aBase === bBase || aBase.startsWith(`${bBase}/`) || bBase.startsWith(`${aBase}/`)) {
              errors.push(`${stage.id}: active tasks ${active[left].data.id} and ${active[right].data.id} overlap at ${a} / ${b}`);
            }
          }
        }
      }
    }

    for (const gate of ["qa-report.md", "uat-record.md", "release-evidence.md"]) {
      if (!(await exists(join(stagesRoot, stageFolder, "gates", gate)))) {
        errors.push(`${stage.id}: missing gate ${gate}`);
      }
    }
  }
}

if (!authorityRegistry) errors.push("missing or invalid docs/product/authority-registry.json");
if (!features.size) errors.push("no feature documents found");
const stageMap = new Map(stageRecords.map((stage) => [stage.id, stage]));
for (const stage of stageRecords) {
  for (const dependency of stage.data.depends_on ?? []) {
    if (!stageMap.has(dependency)) errors.push(`${stage.id}: missing stage dependency ${dependency}`);
    if (dependency === stage.id) errors.push(`${stage.id}: stage cannot depend on itself`);
  }
}
const stageVisiting = new Set();
const stageVisited = new Set();
function visitStage(id) {
  if (stageVisiting.has(id)) {
    errors.push(`cyclic stage dependency at ${id}`);
    return;
  }
  if (stageVisited.has(id) || !stageMap.has(id)) return;
  stageVisiting.add(id);
  for (const dependency of stageMap.get(id).data.depends_on ?? []) visitStage(dependency);
  stageVisiting.delete(id);
  stageVisited.add(id);
}
for (const id of stageMap.keys()) visitStage(id);
const idRegistryPath = join(repoRoot, "docs", "governance", "id-registry.md");
if (await exists(idRegistryPath)) {
  const registry = await readText(idRegistryPath);
  const architectureIds = new Set(
    (await readdir(join(repoRoot, "docs", "architecture", "decisions"), {
      withFileTypes: true
    }).catch(() => []))
      .filter((entry) => entry.isFile() && /^ADR-\d{4}-.+\.md$/.test(entry.name))
      .map((entry) => entry.name.match(/^ADR-\d{4}/)[0])
  );
  for (const [type, ids, prefix, width] of [
    ["Feature", featureIds, "F", 3],
    ["Stage", stageIds, "S", 2],
    ["Architecture decision", architectureIds, "ADR-", 4]
  ]) {
    const row = registry.match(new RegExp(`^\\| ${type} \\| ([^|]+) \\| ([^|]+) \\|$`, "m"));
    if (!row) {
      errors.push(`stable ID registry lacks a structured ${type} row`);
      continue;
    }
    const allocated = new Set([...row[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]));
    const provisional = row[2].match(/`([^`]+)`/)?.[1];
    for (const id of ids) {
      if (!allocated.has(id)) errors.push(`stable ID registry does not allocate ${id} in the Allocated column`);
    }
    for (const id of allocated) {
      if (!ids.has(id)) errors.push(`stable ID registry allocates nonexistent ${id}`);
    }
    const numbers = [...ids].map((id) => Number(id.slice(prefix.length)));
    const expected = `${prefix}${String((numbers.length ? Math.max(...numbers) : -1) + 1).padStart(width, "0")}`;
    if (provisional !== expected) {
      errors.push(`stable ID registry next ${type} must be ${expected}`);
    }
  }
}
report(errors, `Delivery valid: ${features.size} feature(s), ${stageIds.size} stage(s).`);
