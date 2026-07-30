#!/usr/bin/env node

import { lstat, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  defaultRepoRoot,
  exists,
  parseFrontmatter,
  readJson,
  readText,
  repoPath,
  report,
  rootFromArgs,
  walkFiles
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const skillDir = join(repoRoot, ".agents", "skills", "echotalk-development");
const skillPath = join(skillDir, "SKILL.md");
const manifestPath = join(repoRoot, ".agents", "roles", "manifest.json");
const expectedRoles = {
  "project-manager": {
    title: "Project Manager",
    description: "Coordinates bounded delivery, dependencies, evidence, and gates.",
    contract_heading: "Role: Project Manager",
    codex_sandbox: "read-only",
    claude_tools: "Read, Grep, Glob, Bash",
    worktree: false
  },
  "business-analyst": {
    title: "Business Analyst",
    description: "Defines traceable requirements, scenarios, and acceptance criteria.",
    contract_heading: "Role: Business Analyst",
    codex_sandbox: "read-only",
    claude_tools: "Read, Grep, Glob",
    worktree: false
  },
  "solution-architect": {
    title: "Solution Architect",
    description: "Designs boundaries, quality attributes, security, and migration.",
    contract_heading: "Role: Solution Architect",
    codex_sandbox: "read-only",
    claude_tools: "Read, Grep, Glob, Bash",
    worktree: false
  },
  "full-stack-developer": {
    title: "Full-stack Developer",
    description: "Implements a bounded slice with tests, telemetry, and rollback.",
    contract_heading: "Role: Full-stack Developer",
    codex_sandbox: "workspace-write",
    claude_tools: "Read, Grep, Glob, Bash, Edit, Write",
    worktree: true
  },
  "ui-ux-engineer": {
    title: "UI/UX Engineer",
    description: "Designs and implements accessible product interaction journeys.",
    contract_heading: "Role: UI/UX Engineer",
    codex_sandbox: "workspace-write",
    claude_tools: "Read, Grep, Glob, Bash, Edit, Write",
    worktree: true
  },
  "qa-engineer": {
    title: "QA Engineer",
    description: "Independently verifies quality, regression, and release evidence.",
    contract_heading: "Role: QA Engineer",
    codex_sandbox: "workspace-write",
    claude_tools: "Read, Grep, Glob, Bash, Edit, Write",
    worktree: true
  },
  "uat-coordinator": {
    title: "UAT Coordinator",
    description: "Prepares UAT and records explicit human client decisions.",
    contract_heading: "Role: UAT Coordinator",
    codex_sandbox: "read-only",
    claude_tools: "Read, Grep, Glob",
    worktree: false
  }
};

for (const required of [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/echotalk-development/SKILL.md",
  ".agents/skills/echotalk-development/agents/openai.yaml",
  ".agents/roles/manifest.json",
  "docs/index.md",
  "docs/governance/team-role-contracts.md"
]) {
  if (!(await exists(join(repoRoot, required)))) errors.push(`missing ${required}`);
}

let skill = "";
try {
  skill = await readText(skillPath);
  const parsed = parseFrontmatter(skill, repoPath(repoRoot, skillPath));
  const keys = Object.keys(parsed.data);
  if (keys.join(",") !== "name,description") {
    errors.push("SKILL.md frontmatter must contain only name and description");
  }
  if (parsed.data.name !== "echotalk-development") {
    errors.push("SKILL.md name must be echotalk-development");
  }
  if (parsed.body.split(/\r?\n/).length > 100) {
    errors.push("SKILL.md must remain a concise router under 100 body lines");
  }
} catch (error) {
  errors.push(error.message);
}

const allowedSkillFiles = new Set(["SKILL.md", "agents/openai.yaml"]);
for (const path of await walkFiles(skillDir)) {
  const rel = repoPath(skillDir, path);
  if (!allowedSkillFiles.has(rel)) {
    errors.push(`project resource must not live in the router skill: ${rel}`);
  }
}

const bannedKnowledge = /\b(Google|OpenAI|Redis|PostgreSQL|WebRTC|WER|CER|STT|TTS|Sinhala|Tamil)\b/i;
if (bannedKnowledge.test(skill)) {
  errors.push("SKILL.md contains project/provider knowledge instead of routing");
}

const agentsText = await readText(join(repoRoot, "AGENTS.md")).catch(() => "");
const claudeText = await readText(join(repoRoot, "CLAUDE.md")).catch(() => "");
if (!agentsText.includes(".agents/skills/echotalk-development/SKILL.md")) {
  errors.push("AGENTS.md must route to the shared skill");
}
if (!claudeText.startsWith("@AGENTS.md")) {
  errors.push("CLAUDE.md must import @AGENTS.md");
}

let manifest = { roles: [], human_authorities: [] };
try {
  manifest = await readJson(manifestPath);
} catch (error) {
  errors.push(`invalid role manifest: ${error.message}`);
}
if (manifest.schema_version !== 1) errors.push("role manifest schema_version must be 1");
if (manifest.roles?.length !== 7) errors.push("role manifest must define exactly seven agent roles");
if (!manifest.human_authorities?.includes("human-client")) {
  errors.push("role manifest must keep human-client as a non-agent authority");
}

const roleContract = await readText(join(repoRoot, manifest.role_contract ?? "")).catch(() => "");
const slugs = new Set();
for (const role of manifest.roles ?? []) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role.slug ?? "")) {
    errors.push(`invalid or unsafe role slug ${role.slug}`);
  }
  if (slugs.has(role.slug)) errors.push(`duplicate role slug ${role.slug}`);
  slugs.add(role.slug);
  const expected = expectedRoles[role.slug];
  if (!expected) {
    errors.push(`unexpected role slug ${role.slug}`);
  } else {
    for (const [field, value] of Object.entries(expected)) {
      if (role[field] !== value) errors.push(`${role.slug}: ${field} must match the locked role schema`);
    }
  }
  if (!roleContract.includes(`## ${role.contract_heading}`)) {
    errors.push(`role contract heading not found for ${role.slug}`);
  }
  if (!["read-only", "workspace-write"].includes(role.codex_sandbox)) {
    errors.push(`invalid codex_sandbox for ${role.slug}`);
  }
  for (const route of role.routes ?? []) {
    if (!(await exists(join(repoRoot, route)))) errors.push(`missing route for ${role.slug}: ${route}`);
  }
}
for (const slug of Object.keys(expectedRoles)) {
  if (!slugs.has(slug)) errors.push(`missing required role ${slug}`);
}
for (const authority of manifest.human_authorities ?? []) {
  if (slugs.has(authority)) errors.push(`human authority cannot also be an agent role: ${authority}`);
}

const generator = join(repoRoot, "scripts", "governance", "generate-agent-adapters.mjs");
if (await exists(generator)) {
  const result = spawnSync(
    process.execPath,
    [generator, "--check", "--root", repoRoot],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    errors.push(`generated adapters are stale: ${(result.stderr || result.stdout).trim()}`);
  }
}

for (const role of manifest.roles ?? []) {
  for (const path of [
    join(repoRoot, ".codex", "agents", `${role.slug}.toml`),
    join(repoRoot, ".claude", "agents", `${role.slug}.md`)
  ]) {
    const content = await readText(path).catch(() => "");
    if (bannedKnowledge.test(content)) {
      errors.push(`generated adapter contains project/provider knowledge: ${repoPath(repoRoot, path)}`);
    }
  }
}
for (const forbidden of [
  ".codex/agents/client.toml",
  ".claude/agents/client.md",
  ".codex/agents/human-client.toml",
  ".claude/agents/human-client.md"
]) {
  if (await exists(join(repoRoot, forbidden))) errors.push(`human client cannot be an agent: ${forbidden}`);
}

const linkPath = join(repoRoot, ".claude", "skills", "echotalk-development");
try {
  if (!(await lstat(linkPath)).isSymbolicLink()) {
    errors.push(".claude skill exposure must be a symlink");
  } else if ((await realpath(linkPath)) !== (await realpath(resolve(skillDir)))) {
    errors.push(".claude skill symlink must resolve to the shared skill");
  }
} catch {
  errors.push("missing .claude skill symlink");
}

report(errors, `Agent workspace valid: ${manifest.roles?.length ?? 0} generated roles.`);
