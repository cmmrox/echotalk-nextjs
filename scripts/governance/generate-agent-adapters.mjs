#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultRepoRoot,
  exists,
  readJson,
  repoPath,
  rootFromArgs,
  withoutRootArgs
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const args = withoutRootArgs();
const check = args.includes("--check");
const manifest = await readJson(join(repoRoot, ".agents", "roles", "manifest.json"));
const codexDir = join(repoRoot, ".codex", "agents");
const claudeDir = join(repoRoot, ".claude", "agents");
const expected = new Map();

function instructions(role) {
  const routes = role.routes.map((path) => `\`${path}\``).join(", ");
  return [
    "Use $echotalk-development.",
    `Act only as the ${role.title} role under "${role.contract_heading}" in \`${manifest.role_contract}\`.`,
    `Load only the assigned task and relevant routed documents: ${routes}.`,
    "Obey the task's dependencies and writable/prohibited paths; do not expand scope or self-approve.",
    "Return evidence in the durable task artifact and leave human authority decisions pending."
  ].join(" ");
}

for (const role of manifest.roles) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role.slug ?? "")) {
    throw new Error(`Unsafe role slug: ${role.slug}`);
  }
  if (manifest.human_authorities?.includes(role.slug) || /^human client$/i.test(role.title ?? "")) {
    throw new Error(`Human authority cannot be generated as an agent: ${role.slug}`);
  }
  const body = instructions(role);
  const codex = [
    `name = ${JSON.stringify(role.title)}`,
    `description = ${JSON.stringify(role.description)}`,
    `sandbox_mode = ${JSON.stringify(role.codex_sandbox)}`,
    `developer_instructions = ${JSON.stringify(body)}`,
    ""
  ].join("\n");
  const claudeLines = [
    "---",
    `name: ${role.slug}`,
    `description: ${role.description}`,
    `tools: ${role.claude_tools}`
  ];
  if (role.worktree) claudeLines.push("isolation: worktree");
  claudeLines.push("---", "", body, "");
  expected.set(join(codexDir, `${role.slug}.toml`), codex);
  expected.set(join(claudeDir, `${role.slug}.md`), claudeLines.join("\n"));
}

const errors = [];
if (!check) {
  await mkdir(codexDir, { recursive: true });
  await mkdir(claudeDir, { recursive: true });
}

for (const [path, content] of expected) {
  if (check) {
    if (!(await exists(path))) {
      errors.push(`missing generated adapter ${repoPath(repoRoot, path)}`);
    } else if ((await readFile(path, "utf8")) !== content) {
      errors.push(`stale generated adapter ${repoPath(repoRoot, path)}`);
    }
  } else {
    await writeFile(path, content);
  }
}

for (const directory of [codexDir, claudeDir]) {
  if (!(await exists(directory))) continue;
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    if (!expected.has(path)) errors.push(`unexpected adapter ${repoPath(repoRoot, path)}`);
  }
}

if (errors.length) {
  console.error(`Agent adapter generation check failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  check
    ? `Generated adapters are current for ${manifest.roles.length} roles.`
    : `Generated ${manifest.roles.length} Codex and Claude role adapters.`
);
