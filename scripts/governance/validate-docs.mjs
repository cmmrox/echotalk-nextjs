#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import {
  defaultRepoRoot,
  exists,
  markdownLinks,
  readText,
  repoPath,
  report,
  rootFromArgs,
  walkFiles
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const errors = [];
const required = [
  "docs/index.md",
  "docs/product/vision.md",
  "docs/product/product-and-domain.md",
  "docs/product/roadmap.md",
  "docs/product/stakeholders-and-authority.md",
  "docs/product/authority-registry.json",
  "docs/architecture/current-system.md",
  "docs/architecture/target-system.md",
  "docs/standards/engineering.md",
  "docs/standards/bilingual-ai-quality.md",
  "docs/standards/security-and-privacy.md",
  "docs/standards/testing.md",
  "docs/governance/feature-stage-task-lifecycle.md",
  "docs/governance/artifact-contracts.md",
  "docs/governance/id-registry.md",
  "docs/governance/team-role-contracts.md",
  "docs/governance/qa-uat-and-release-gates.md"
];
for (const path of required) {
  if (!(await exists(join(repoRoot, path)))) errors.push(`missing canonical document ${path}`);
}

for (const legacy of ["PRD.md", "PROGRESS.md", "impl-plans", "impl-logs"]) {
  if (await exists(join(repoRoot, legacy))) {
    errors.push(`legacy artifact remains active instead of archived: ${legacy}`);
  }
}

const roots = [
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docs",
  "delivery",
  "qa-automation"
];
const markdown = [];
for (const root of roots) {
  const path = join(repoRoot, root);
  if (!(await exists(path))) continue;
  if (root.endsWith(".md")) {
    markdown.push(path);
  } else {
    markdown.push(
      ...(await walkFiles(path, {
        extension: ".md",
        skip: root === "docs" ? ["archive"] : root === "qa-automation" ? ["runs"] : []
      }))
    );
  }
}

for (const file of markdown) {
  const text = await readText(file);
  for (const rawTarget of markdownLinks(text)) {
    let target;
    try {
      target = decodeURIComponent(rawTarget);
    } catch {
      errors.push(`${repoPath(repoRoot, file)}: invalid encoded link ${rawTarget}`);
      continue;
    }
    const resolved = target.startsWith("/")
      ? resolve(repoRoot, `.${target}`)
      : resolve(dirname(file), target);
    if (!(await exists(resolved))) {
      errors.push(`${repoPath(repoRoot, file)}: broken link ${rawTarget}`);
    }
  }
}

report(errors, `Documentation valid: ${markdown.length} active Markdown files checked.`);
