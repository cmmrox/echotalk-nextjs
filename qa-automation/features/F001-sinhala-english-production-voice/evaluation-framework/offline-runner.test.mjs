import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  validateEvaluationRunSpec,
  validateGitSafeManifest,
} from "../../../../lib/evaluation/manifest.ts";
import { measureEdits, normalizeComparisonV1 } from "../../../../lib/evaluation/metrics.ts";
import { estimateMicroUsd, validatePriceCatalog } from "../../../../lib/evaluation/pricing.ts";
import {
  buildAggregateScorecard,
  digestCanonical,
  validateSyntheticFixture,
} from "../../../../lib/evaluation/scorecard.ts";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const fixture = await readJson("../../../../evaluation/fixtures/synthetic/dev.v1.json");
const runSpec = await readJson("../../../../evaluation/fixtures/synthetic/run-spec.v1.json");
const catalog = await readJson("../../../../config/evaluation/price-catalog.example.v1.json");
const manifest = await readJson("../../../../evaluation/manifests/template.json");

test("comparison-v1 is explicit and meaning-preserving", () => {
  assert.equal(normalizeComparisonV1("  ABC\tසිංහල!  "), "abc සිංහල!");
  assert.equal(measureEdits("hello world", "hello there", "word").substitutions, 1);
  assert.equal(measureEdits("", "word", "word").rate, null);
});

test("Git-safe manifest and run spec reject content and non-synthetic claims", () => {
  assert.equal(validateGitSafeManifest(manifest).syntheticOnly, true);
  assert.equal(validateEvaluationRunSpec(runSpec).syntheticOnly, true);
  assert.throws(() => validateGitSafeManifest({ ...manifest, transcript: "private" }));
  assert.throws(() => validateGitSafeManifest({ ...manifest, syntheticOnly: false }));
  assert.throws(() => validateEvaluationRunSpec({ ...runSpec, providerPayload: "private" }));
  assert.throws(() => validateEvaluationRunSpec({ ...runSpec, syntheticOnly: false }));
});

test("price arithmetic is exact and synthetic catalogs are strict", () => {
  validatePriceCatalog(catalog, { syntheticOnly: true });
  assert.equal(estimateMicroUsd(3, catalog.entries[0]), 300);
  assert.throws(() => estimateMicroUsd(-1, catalog.entries[0]));
  assert.throws(() => validatePriceCatalog({
    ...catalog,
    entries: [{ ...catalog.entries[0], classification: "invoice" }],
  }, { syntheticOnly: true }), /synthetic-example/);
  assert.throws(() => validatePriceCatalog({
    ...catalog,
    entries: [{ ...catalog.entries[0], transcript: "forbidden" }],
  }, { syntheticOnly: true }), /unknown field/);
  assert.throws(() => validatePriceCatalog({
    ...catalog,
    entries: [{ ...catalog.entries[0], effectiveAt: "not-a-date" }],
  }, { syntheticOnly: true }), /timestamp/);
});

test("synthetic observations reject unknown fields and invalid entity matches", () => {
  assert.equal(validateSyntheticFixture(fixture).syntheticOnly, true);
  const duplicateMatch = structuredClone(fixture);
  duplicateMatch.observations[0].matchedEntities = [
    duplicateMatch.observations[0].expectedEntities[0],
    duplicateMatch.observations[0].expectedEntities[0],
  ];
  assert.throws(() => validateSyntheticFixture(duplicateMatch), /Duplicate matched entities/);
  const excessMatch = structuredClone(fixture);
  excessMatch.observations[0].matchedEntities = ["not-expected"];
  assert.throws(() => validateSyntheticFixture(excessMatch), /subset/);
  const contentField = structuredClone(fixture);
  contentField.observations[0].speaker = "private";
  assert.throws(() => validateSyntheticFixture(contentField), /unknown field/);
});

test("aggregate scorecard binds artifacts, hashes canonically, and tracks all metrics", () => {
  const first = buildAggregateScorecard({ runSpec, manifest, fixture, priceCatalog: catalog });
  const second = buildAggregateScorecard({ runSpec, manifest, fixture, priceCatalog: catalog });
  assert.deepEqual(first, second);
  assert.deepEqual(first.overall.clarification, {
    requested: 1,
    eligible: 2,
    missingEligibility: 1,
    rate: 0.5,
  });
  assert.equal(first.overall.failures.count, 1);
  assert.deepEqual(first.skips, { count: 0, reasons: [] });
  assert.equal(first.provenance.fixtureDigest, digestCanonical(fixture));
  assert.equal(first.provenance.manifestDigest, digestCanonical(manifest));
  assert.equal(first.provenance.priceCatalogDigest, digestCanonical(catalog));
  const { reportDigest, ...withoutDigest } = first;
  assert.equal(reportDigest, digestCanonical(withoutDigest));

  const sinhalaSlice = first.slices.find((slice) => slice.slice === "sinhala-unicode");
  assert.equal(sinhalaSlice.suppressed, false);
  assert.equal(sinhalaSlice.observations, 2);
  assert.equal(sinhalaSlice.metrics.success.attempted, 2);
  assert.equal(typeof sinhalaSlice.metrics.word.referenceUnits, "number");
  const suppressed = first.slices.find((slice) => slice.slice === "code-switch");
  assert.deepEqual(suppressed, {
    slice: "code-switch",
    suppressed: true,
    observations: null,
    metrics: null,
  });

  const serialized = JSON.stringify(first);
  for (const content of fixture.observations.flatMap((item) => [
    item.fixtureId,
    item.reference,
    item.hypothesis,
    ...item.expectedEntities,
  ])) {
    assert.equal(serialized.includes(content), false);
  }
});

test("artifact changes fail their cryptographic run binding", () => {
  const changedFixture = structuredClone(fixture);
  changedFixture.observations[0].latencyMs += 1;
  assert.throws(
    () => buildAggregateScorecard({
      runSpec,
      manifest,
      fixture: changedFixture,
      priceCatalog: catalog,
    }),
    /binding mismatch/
  );
});

test("pre-T04 CLI rejects path overrides", () => {
  const result = spawnSync(process.execPath, [
    "--import",
    join(
      repoRoot,
      "qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/alias-register.mjs"
    ),
    join(repoRoot, "scripts/evaluation/run-offline.mjs"),
    "forbidden-external-fixture.json",
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not accept path overrides/);
});

test("pre-T04 CLI resolves only repository-owned synthetic artifacts", () => {
  const result = spawnSync(process.execPath, [
    "--import",
    join(
      repoRoot,
      "qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/alias-register.mjs"
    ),
    join(repoRoot, "scripts/evaluation/run-offline.mjs"),
  ], { cwd: "/tmp", encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).provenance.fixtureDigest, runSpec.fixtureDigest);
});
