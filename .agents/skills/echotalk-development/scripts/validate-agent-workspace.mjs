#!/usr/bin/env node

import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, "..");
const repoRoot = resolve(skillDir, "../../..");
const errors = [];

async function text(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    errors.push(`Missing or unreadable: ${path.slice(repoRoot.length + 1)}`);
    return "";
  }
}

const required = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/echotalk-development/SKILL.md",
  ".agents/skills/echotalk-development/agents/openai.yaml",
  ".agents/skills/echotalk-development/references/agent-manifest.json",
  "delivery/roadmap.md",
  "delivery/sprints/S00/sprint-charter.md"
];
await Promise.all(required.map((path) => text(join(repoRoot, path))));

const agents = await text(join(repoRoot, "AGENTS.md"));
const claude = await text(join(repoRoot, "CLAUDE.md"));
const skill = await text(join(skillDir, "SKILL.md"));
if (!claude.startsWith("@AGENTS.md")) errors.push("CLAUDE.md must import @AGENTS.md.");
if (!agents.includes(".agents/skills/echotalk-development/SKILL.md")) {
  errors.push("AGENTS.md must route to the canonical skill.");
}
if (skill.includes("TODO") || skill.includes("[TODO")) {
  errors.push("SKILL.md contains unfinished placeholders.");
}
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
const frontmatterKeys = frontmatter?.[1]
  .split("\n")
  .map((line) => line.split(":", 1)[0]);
if (
  !frontmatter ||
  JSON.stringify(frontmatterKeys) !== JSON.stringify(["name", "description"]) ||
  !frontmatter[1].startsWith("name: echotalk-development\n")
) {
  errors.push("SKILL.md frontmatter must contain only the expected name and description.");
}

for (const match of skill.matchAll(/`(references|assets)\/([^`]+)`/g)) {
  await text(join(skillDir, match[1], match[2]));
}

const manifest = JSON.parse(
  await text(join(skillDir, "references", "agent-manifest.json")) || '{"roles":[]}'
);
for (const role of manifest.roles ?? []) {
  const marker = `## Role: ${role.title}`;
  for (const path of [
    join(repoRoot, ".codex", "agents", `${role.slug}.toml`),
    join(repoRoot, ".claude", "agents", `${role.slug}.md`)
  ]) {
    const adapter = await text(path);
    if (!adapter.includes(marker) || !adapter.includes("team-role-contracts.md")) {
      errors.push(`${path.slice(repoRoot.length + 1)} is not a canonical thin adapter.`);
    }
  }
  for (const reference of role.references) {
    await text(join(skillDir, "references", reference));
  }
}

const linkPath = join(repoRoot, ".claude", "skills", "echotalk-development");
try {
  const stats = await lstat(linkPath);
  if (!stats.isSymbolicLink()) errors.push(".claude skill exposure must be a symlink.");
  const target = await realpath(linkPath);
  if (target !== skillDir) errors.push(".claude skill symlink does not resolve to the canonical skill.");
} catch {
  errors.push("Missing .claude skill symlink.");
}

if (errors.length) {
  console.error(`Agent workspace validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Agent workspace valid: ${manifest.roles.length} shared role adapters.`);
