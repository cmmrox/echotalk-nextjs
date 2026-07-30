#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  defaultRepoRoot,
  exists,
  readJson,
  rootFromArgs,
  withoutRootArgs
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const [kind, ...args] = withoutRootArgs();
const templates = join(repoRoot, "docs", "governance", "templates");
const idRegistryPath = join(repoRoot, "docs", "governance", "id-registry.md");
const roleManifest = await readJson(join(repoRoot, ".agents", "roles", "manifest.json")).catch(() => ({ roles: [] }));
const roleSlugs = new Set(roleManifest.roles.map((role) => role.slug));

function fail(message) {
  console.error(message);
  process.exit(2);
}

function validId(value, pattern, label) {
  if (!pattern.test(value ?? "")) fail(`Invalid ${label}: ${value ?? "<missing>"}`);
}

function validSlug(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "")) {
    fail(`Invalid slug: ${value ?? "<missing>"}`);
  }
}

async function uniqueWrite(path, content) {
  if (await exists(path)) fail(`Refusing to overwrite ${path}`);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
}

async function findFolder(root, id) {
  const matches = (await readdir(root, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${id}-`))
    .map((entry) => entry.name);
  if (matches.length !== 1) fail(`Expected one ${id}-* folder under ${root}; found ${matches.length}`);
  return matches[0];
}

async function idExists(root, id) {
  return (await readdir(root, { withFileTypes: true }).catch(() => []))
    .some((entry) => entry.isDirectory() && entry.name.startsWith(`${id}-`));
}

async function stageIdExists(stageId) {
  const deliveryRoot = join(repoRoot, "delivery", "features");
  for (const feature of await readdir(deliveryRoot, { withFileTypes: true }).catch(() => [])) {
    if (!feature.isDirectory()) continue;
    if (await idExists(join(deliveryRoot, feature.name, "stages"), stageId)) return true;
  }
  return false;
}

async function template(name) {
  return readFile(join(templates, name), "utf8");
}

async function assertProvisional(type, id) {
  const registry = await readFile(idRegistryPath, "utf8");
  const row = registry.match(new RegExp(`^\\| ${type} \\| ([^|]+) \\| ([^|]+) \\|$`, "m"));
  const provisional = row?.[2].match(/`([^`]+)`/)?.[1];
  if (!row || provisional !== id) {
    fail(`${id} is not the next provisional ${type} ID (${provisional ?? "missing registry row"})`);
  }
  return { registry, row };
}

async function commitAllocation(type, id, prefix, width, allocation) {
  const allocated = [...allocation.row[1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  allocated.push(id);
  const next = `${prefix}${String(Number(id.slice(prefix.length)) + 1).padStart(width, "0")}`;
  const replacement = `| ${type} | ${allocated.map((value) => `\`${value}\``).join(", ")} | \`${next}\` |`;
  await writeFile(idRegistryPath, allocation.registry.replace(allocation.row[0], replacement));
}

if (kind === "feature") {
  const [featureId, slug, ...titleParts] = args;
  validId(featureId, /^F\d{3}$/, "feature ID");
  validSlug(slug);
  if (await idExists(join(repoRoot, "docs", "features"), featureId)) {
    fail(`Feature ID already allocated: ${featureId}`);
  }
  const allocation = await assertProvisional("Feature", featureId);
  const title = titleParts.join(" ") || slug.replaceAll("-", " ");
  const folder = `${featureId}-${slug}`;
  const feature = (await template("feature.md"))
    .replaceAll("FNNN", featureId)
    .replaceAll("short-name", slug)
    .replace("Feature title", title);
  await uniqueWrite(join(repoRoot, "docs", "features", folder, "feature.md"), feature);
  await uniqueWrite(
    join(repoRoot, "delivery", "features", folder, "README.md"),
    [
      "---",
      `id: ${featureId}`,
      "status: proposed",
      `feature_doc: docs/features/${folder}/feature.md`,
      "---",
      "",
      `# ${featureId} — ${title} Delivery`,
      "",
      "| Stage | Outcome | Status | Candidate |",
      "|---|---|---|---|",
      ""
    ].join("\n")
  );
  await uniqueWrite(
    join(repoRoot, "qa-automation", "features", folder, "README.md"),
    `# ${featureId} — ${title} QA\n\nPermanent cases and stage matrices for ${featureId}.\n`
  );
  await commitAllocation("Feature", featureId, "F", 3, allocation);
  console.log(`Scaffolded feature ${featureId} at ${folder}.`);
} else if (kind === "stage") {
  const [featureId, stageId, slug, ...titleParts] = args;
  validId(featureId, /^F\d{3}$/, "feature ID");
  validId(stageId, /^S\d{2}$/, "stage ID");
  validSlug(slug);
  if (await stageIdExists(stageId)) fail(`Stage ID already allocated: ${stageId}`);
  const allocation = await assertProvisional("Stage", stageId);
  const title = titleParts.join(" ") || slug.replaceAll("-", " ");
  const featureFolder = await findFolder(join(repoRoot, "docs", "features"), featureId);
  const deliveryFeature = join(repoRoot, "delivery", "features", featureFolder);
  if (!(await exists(deliveryFeature))) fail(`Missing delivery board for ${featureId}`);
  const stageFolder = `${stageId}-${slug}`;
  const stageRoot = join(deliveryFeature, "stages", stageFolder);
  const stage = (await template("stage.md"))
    .replaceAll("FNNN", featureId)
    .replaceAll("SNN", stageId)
    .replaceAll("short-name", slug)
    .replace("Stage title", title);
  await uniqueWrite(join(stageRoot, "stage.md"), stage);
  const qaTask = (await template("task.md"))
    .replaceAll("TNN", "T90")
    .replaceAll("FNNN", featureId)
    .replaceAll("SNN", stageId)
    .replaceAll("short-name", "stage-qa-automation-and-execution")
    .replace("type: implementation", "type: stage-qa")
    .replace("owner_role: full-stack-developer", "owner_role: qa-engineer")
    .replace("reviewer_role: solution-architect", "reviewer_role: project-manager")
    .replace("owner: pending", "owner: pending-independent-qa")
    .replace("writable_paths: []", `writable_paths: ["qa-automation/features/${featureFolder}/**", "qa-automation/runs/**", "delivery/features/${featureFolder}/stages/${stageFolder}/gates/qa-report.md", "delivery/features/${featureFolder}/stages/${stageFolder}/gates/qa-run.json"]`)
    .replace("prohibited_paths: []", 'prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]')
    .replace("test_commands: []", `test_commands: ["npm run qa:stage -- ${featureId} ${stageId}"]`)
    .replace("Task title", "Stage QA Automation and Execution");
  await uniqueWrite(join(stageRoot, "tasks", "T90-stage-qa-automation-and-execution.md"), qaTask);
  for (const [source, target] of [
    ["qa-report.md", "qa-report.md"],
    ["uat-record.md", "uat-record.md"],
    ["release-evidence.md", "release-evidence.md"]
  ]) {
    const content = (await template(source))
      .replaceAll("FNNN", featureId)
      .replaceAll("SNN", stageId);
    await uniqueWrite(join(stageRoot, "gates", target), content);
  }
  await commitAllocation("Stage", stageId, "S", 2, allocation);
  console.log(`Scaffolded stage ${featureId}/${stageId} at ${basename(stageRoot)}.`);
} else if (kind === "task") {
  const [featureId, stageId, taskId, slug, type, owner, reviewer, ...titleParts] = args;
  validId(featureId, /^F\d{3}$/, "feature ID");
  validId(stageId, /^S\d{2}$/, "stage ID");
  validId(taskId, /^T(?:0[1-9]|[1-8]\d|9[1-9])$/, "task ID (T90 is reserved)");
  validSlug(slug);
  if (!type || !owner || !reviewer) {
    fail("Task type, owner role, and reviewer role are required");
  }
  if (!roleSlugs.has(owner) || !roleSlugs.has(reviewer) || owner === reviewer) {
    fail("Task owner/reviewer roles must be distinct roles from the shared manifest");
  }
  const title = titleParts.join(" ") || slug.replaceAll("-", " ");
  const featureFolder = await findFolder(join(repoRoot, "delivery", "features"), featureId);
  const stagesRoot = join(repoRoot, "delivery", "features", featureFolder, "stages");
  const stageFolder = await findFolder(stagesRoot, stageId);
  const taskRoot = join(stagesRoot, stageFolder, "tasks");
  const task = (await template("task.md"))
    .replaceAll("TNN", taskId)
    .replaceAll("FNNN", featureId)
    .replaceAll("SNN", stageId)
    .replaceAll("short-name", slug)
    .replace("type: implementation", `type: ${type}`)
    .replace("owner_role: full-stack-developer", `owner_role: ${owner}`)
    .replace("reviewer_role: solution-architect", `reviewer_role: ${reviewer}`)
    .replace("writable_paths: []", 'writable_paths: ["SET-BEFORE-READY"]')
    .replace("prohibited_paths: []", 'prohibited_paths: ["SET-BEFORE-READY"]')
    .replace("test_commands: []", 'test_commands: ["SET-BEFORE-READY"]')
    .replace("Task title", title);
  await uniqueWrite(join(taskRoot, `${taskId}-${slug}.md`), task);

  const qaPath = join(taskRoot, "T90-stage-qa-automation-and-execution.md");
  const qaText = await readFile(qaPath, "utf8");
  const match = qaText.match(/^depends_on:\s*\[(.*)]$/m);
  if (!match) fail(`Cannot update T90 dependencies at ${qaPath}`);
  const dependencies = match[1].trim()
    ? match[1].split(",").map((value) => value.trim())
    : [];
  if (!dependencies.includes(taskId)) dependencies.push(taskId);
  await writeFile(qaPath, qaText.replace(match[0], `depends_on: [${dependencies.join(", ")}]`));
  console.log(`Scaffolded task ${featureId}/${stageId}/${taskId}.`);
} else {
  fail(
    "Usage:\n" +
    "  scaffold.mjs feature FNNN slug [title]\n" +
    "  scaffold.mjs stage FNNN SNN slug [title]\n" +
    "  scaffold.mjs task FNNN SNN TNN slug type owner-role reviewer-role [title]"
  );
}
