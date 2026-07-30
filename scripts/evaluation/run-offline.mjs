#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 2) {
  throw new Error(
    "The pre-T04 synthetic runner does not accept path overrides or external artifacts"
  );
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const { buildAggregateScorecard } = await import("../../lib/evaluation/scorecard.ts");
const paths = {
  fixture: resolve(root, "evaluation/fixtures/synthetic/dev.v1.json"),
  catalog: resolve(root, "config/evaluation/price-catalog.example.v1.json"),
  manifest: resolve(root, "evaluation/manifests/template.json"),
  runSpec: resolve(root, "evaluation/fixtures/synthetic/run-spec.v1.json"),
};
const [fixture, priceCatalog, manifest, runSpec] = await Promise.all(
  Object.values(paths).map(async (path) => JSON.parse(await readFile(path, "utf8")))
);
const scorecard = buildAggregateScorecard({ runSpec, manifest, fixture, priceCatalog });
process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
