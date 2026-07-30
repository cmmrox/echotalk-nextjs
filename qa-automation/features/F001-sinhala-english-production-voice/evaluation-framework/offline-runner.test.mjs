import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateGitSafeManifest } from "../../../../lib/evaluation/manifest.ts";
import { measureEdits, normalizeComparisonV1 } from "../../../../lib/evaluation/metrics.ts";
import { estimateMicroUsd, validatePriceCatalog } from "../../../../lib/evaluation/pricing.ts";
import { buildAggregateScorecard } from "../../../../lib/evaluation/scorecard.ts";

const fixture = JSON.parse(await readFile(
  new URL("../../../../evaluation/fixtures/synthetic/dev.v1.json", import.meta.url),
  "utf8"
));
const catalog = JSON.parse(await readFile(
  new URL("../../../../config/evaluation/price-catalog.example.v1.json", import.meta.url),
  "utf8"
));
const manifest = JSON.parse(await readFile(
  new URL("../../../../evaluation/manifests/template.json", import.meta.url),
  "utf8"
));

test("comparison-v1 is explicit and meaning-preserving", () => {
  assert.equal(normalizeComparisonV1("  ABC\tසිංහල!  "), "abc සිංහල!");
  assert.equal(measureEdits("hello world", "hello there", "word").substitutions, 1);
  assert.equal(measureEdits("", "word", "word").rate, null);
});

test("Git-safe manifest rejects content and non-synthetic approval claims", () => {
  assert.equal(validateGitSafeManifest(manifest).syntheticOnly, true);
  assert.throws(() => validateGitSafeManifest({ ...manifest, transcript: "private" }));
  assert.throws(() => validateGitSafeManifest({ ...manifest, syntheticOnly: false }));
});

test("price arithmetic uses exact integer micro-USD", () => {
  validatePriceCatalog(catalog);
  assert.equal(estimateMicroUsd(3, catalog.entries[0]), 300);
  assert.throws(() => estimateMicroUsd(-1, catalog.entries[0]));
});

test("aggregate scorecard is deterministic, content-free, and tracks clarification", () => {
  const first = buildAggregateScorecard({
    runVersion: fixture.runVersion,
    fixtureVersion: fixture.fixtureVersion,
    minimumSliceCount: fixture.minimumSliceCount,
    observations: fixture.observations,
    priceCatalog: catalog,
  });
  const second = buildAggregateScorecard({
    runVersion: fixture.runVersion,
    fixtureVersion: fixture.fixtureVersion,
    minimumSliceCount: fixture.minimumSliceCount,
    observations: fixture.observations,
    priceCatalog: catalog,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.clarification, {
    requested: 1,
    eligible: 2,
    missingEligibility: 1,
    rate: 0.5,
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
  assert.equal(first.slices.find((slice) => slice.slice === "code-switch").suppressed, true);
});
