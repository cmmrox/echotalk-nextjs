#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateGitSafeManifest } from "../../lib/evaluation/manifest.ts";
import { buildAggregateScorecard } from "../../lib/evaluation/scorecard.ts";

const root = process.cwd();
const fixturePath = resolve(root, process.argv[2] ?? "evaluation/fixtures/synthetic/dev.v1.json");
const catalogPath = resolve(root, process.argv[3] ?? "config/evaluation/price-catalog.example.v1.json");
const manifestPath = resolve(root, process.argv[4] ?? "evaluation/manifests/template.json");

const [fixture, priceCatalog, manifest] = await Promise.all(
  [fixturePath, catalogPath, manifestPath].map(async (path) =>
    JSON.parse(await readFile(path, "utf8")))
);
validateGitSafeManifest(manifest);
const scorecard = buildAggregateScorecard({
  runVersion: fixture.runVersion,
  fixtureVersion: fixture.fixtureVersion,
  minimumSliceCount: fixture.minimumSliceCount,
  observations: fixture.observations,
  priceCatalog,
});
process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
