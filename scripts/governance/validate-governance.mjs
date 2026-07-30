#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  defaultRepoRoot,
  rootFromArgs
} from "./lib.mjs";

const repoRoot = rootFromArgs(defaultRepoRoot(import.meta.url));
const validators = [
  "validate-agent-workspace.mjs",
  "validate-docs.mjs",
  "validate-delivery.mjs",
  "validate-traceability.mjs",
  "validate-qa.mjs",
  "validate-release.mjs"
];
let failed = false;

for (const validator of validators) {
  const path = join(repoRoot, "scripts", "governance", validator);
  const result = spawnSync(process.execPath, [path, "--root", repoRoot], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
console.log(`Governance valid: ${validators.length} validators passed.`);
