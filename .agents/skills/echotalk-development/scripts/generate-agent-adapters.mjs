#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const repoRoot = resolve(skillDir, "../../..");
const manifestPath = join(skillDir, "references", "agent-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const codexDir = join(repoRoot, ".codex", "agents");
const claudeDir = join(repoRoot, ".claude", "agents");

await mkdir(codexDir, { recursive: true });
await mkdir(claudeDir, { recursive: true });

function instruction(role) {
  const refs = role.references
    .map((name) => `.agents/skills/echotalk-development/references/${name}`)
    .join(", ");
  return [
    "Use the repository echotalk-development skill.",
    `Act only as the "${role.title}" role defined under "## Role: ${role.title}" in .agents/skills/echotalk-development/references/team-role-contracts.md.`,
    `Read the canonical role contract and these task references before acting: ${refs}.`,
    "Inspect current repository evidence, obey the assigned scope and writable paths, and return a durable handoff.",
    "Do not approve your own work. Only the human client may accept UAT or authorize production."
  ].join(" ");
}

for (const role of manifest.roles) {
  const body = instruction(role);
  const codex = [
    `name = ${JSON.stringify(role.title)}`,
    `description = ${JSON.stringify(role.description)}`,
    `developer_instructions = ${JSON.stringify(body)}`,
    ""
  ].join("\n");
  const claude = [
    "---",
    `name: ${role.slug}`,
    `description: ${role.description}`,
    "---",
    "",
    body,
    ""
  ].join("\n");
  await writeFile(join(codexDir, `${role.slug}.toml`), codex);
  await writeFile(join(claudeDir, `${role.slug}.md`), claude);
}

console.log(`Generated ${manifest.roles.length} Codex and Claude role adapters.`);
