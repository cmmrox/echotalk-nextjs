import { createHash } from "node:crypto";

import {
  COMPARISON_POLICY_VERSION,
  EVALUATION_CONTRACT_VERSION,
  SCORECARD_SCHEMA_VERSION,
  SYNTHETIC_FIXTURE_SCHEMA_VERSION,
  type AggregateMetrics,
  type AggregateScorecard,
  type EditCounts,
  type EvaluationRunSpec,
  type GitSafeManifestMetadata,
  type PriceCatalog,
  type ReasonCount,
  type SyntheticFixture,
  type SyntheticObservation,
} from "@/lib/evaluation/contracts";
import { measureEdits, nearestRank } from "@/lib/evaluation/metrics";
import { validateEvaluationRunSpec, validateGitSafeManifest } from "@/lib/evaluation/manifest";
import { estimateMicroUsd, findPrice, validatePriceCatalog } from "@/lib/evaluation/pricing";

const fixtureKeys = new Set([
  "schemaVersion",
  "fixtureVersion",
  "syntheticOnly",
  "minimumSliceCount",
  "observations",
  "skips",
]);
const observationKeys = new Set([
  "fixtureId",
  "slices",
  "reference",
  "hypothesis",
  "expectedEntities",
  "matchedEntities",
  "semanticJudgment",
  "clarificationEligible",
  "clarificationRequested",
  "latencyMs",
  "success",
  "failureCode",
  "provider",
  "model",
  "region",
  "billingUnits",
]);
const reasonCountKeys = new Set(["reason", "count"]);
const tokenPattern = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;

function assertKnownKeys(record: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${label} contains an unknown field`);
  }
}

function validateReasonCounts(value: unknown, label: string): ReasonCount[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const reasons = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Invalid ${label} entry`);
    }
    const record = raw as Record<string, unknown>;
    assertKnownKeys(record, reasonCountKeys, label);
    if (
      typeof record.reason !== "string" ||
      !tokenPattern.test(record.reason) ||
      !Number.isSafeInteger(record.count) ||
      Number(record.count) < 1
    ) {
      throw new Error(`Invalid ${label} entry`);
    }
    if (reasons.has(record.reason)) throw new Error(`Duplicate ${label} reason`);
    reasons.add(record.reason);
    return { reason: record.reason, count: Number(record.count) };
  });
}

function validateStringArray(value: unknown, label: string, allowEmpty: boolean) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || value.length > 100) {
    throw new Error(`Invalid ${label}`);
  }
  if (value.some((item) => typeof item !== "string" || item.length > 10_000)) {
    throw new Error(`Invalid ${label}`);
  }
  if (new Set(value).size !== value.length) throw new Error(`Duplicate ${label}`);
  return value as string[];
}

export function validateSyntheticFixture(value: unknown): SyntheticFixture {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Synthetic fixture must be an object");
  }
  const fixture = value as Record<string, unknown>;
  assertKnownKeys(fixture, fixtureKeys, "Synthetic fixture");
  if (
    fixture.schemaVersion !== SYNTHETIC_FIXTURE_SCHEMA_VERSION ||
    fixture.syntheticOnly !== true ||
    typeof fixture.fixtureVersion !== "string" ||
    !tokenPattern.test(fixture.fixtureVersion) ||
    !Number.isSafeInteger(fixture.minimumSliceCount) ||
    Number(fixture.minimumSliceCount) < 1 ||
    !Array.isArray(fixture.observations) ||
    !fixture.observations.length ||
    fixture.observations.length > 10_000
  ) {
    throw new Error("Invalid synthetic fixture");
  }
  const fixtureIds = new Set<string>();
  for (const rawObservation of fixture.observations) {
    if (!rawObservation || typeof rawObservation !== "object" || Array.isArray(rawObservation)) {
      throw new Error("Invalid synthetic observation");
    }
    const observation = rawObservation as Record<string, unknown>;
    assertKnownKeys(observation, observationKeys, "Synthetic observation");
    for (const field of ["fixtureId", "provider", "model", "region"] as const) {
      if (typeof observation[field] !== "string" || !tokenPattern.test(observation[field])) {
        throw new Error(`Invalid synthetic observation field: ${field}`);
      }
    }
    if (fixtureIds.has(String(observation.fixtureId))) {
      throw new Error("Duplicate synthetic fixture ID");
    }
    fixtureIds.add(String(observation.fixtureId));
    validateStringArray(observation.slices, "observation slices", false).forEach((slice) => {
      if (!tokenPattern.test(slice)) throw new Error("Invalid observation slice");
    });
    const expected = validateStringArray(observation.expectedEntities, "expected entities", true);
    const matched = validateStringArray(observation.matchedEntities, "matched entities", true);
    if (matched.some((entity) => !expected.includes(entity))) {
      throw new Error("Matched entities must be a unique subset of expected entities");
    }
    for (const field of ["reference", "hypothesis"] as const) {
      if (typeof observation[field] !== "string" || observation[field].length > 100_000) {
        throw new Error(`Invalid observation ${field}`);
      }
    }
    if (![true, false, null].includes(observation.semanticJudgment as boolean | null)) {
      throw new Error("Invalid semantic judgment");
    }
    if (![true, false, null].includes(observation.clarificationEligible as boolean | null)) {
      throw new Error("Invalid clarification eligibility");
    }
    if (typeof observation.clarificationRequested !== "boolean") {
      throw new Error("Invalid clarification request");
    }
    if (
      observation.clarificationRequested &&
      observation.clarificationEligible !== true
    ) {
      throw new Error("Clarification request requires explicit eligibility");
    }
    if (!Number.isSafeInteger(observation.latencyMs) || Number(observation.latencyMs) < 0) {
      throw new Error("Invalid observation latency");
    }
    if (!Number.isSafeInteger(observation.billingUnits) || Number(observation.billingUnits) < 0) {
      throw new Error("Invalid observation billing units");
    }
    if (typeof observation.success !== "boolean") throw new Error("Invalid success status");
    if (
      (observation.success && observation.failureCode !== null) ||
      (!observation.success &&
        (typeof observation.failureCode !== "string" ||
          !tokenPattern.test(observation.failureCode)))
    ) {
      throw new Error("Invalid failure code");
    }
  }
  validateReasonCounts(fixture.skips, "skip");
  return value as SyntheticFixture;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot hash non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  throw new Error("Cannot hash unsupported JSON");
}

export function digestCanonical(value: unknown) {
  return `sha256:${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
}

function sumEdits(values: EditCounts[]): EditCounts {
  const result = values.reduce(
    (sum, value) => ({
      substitutions: sum.substitutions + value.substitutions,
      deletions: sum.deletions + value.deletions,
      insertions: sum.insertions + value.insertions,
      referenceUnits: sum.referenceUnits + value.referenceUnits,
      edits: sum.edits + value.edits,
      rate: null,
    }),
    { substitutions: 0, deletions: 0, insertions: 0, referenceUnits: 0, edits: 0, rate: null } as EditCounts
  );
  result.rate = result.referenceUnits ? result.edits / result.referenceUnits : null;
  return result;
}

function checkedAdd(left: number, right: number, label: string) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} overflow`);
  return result;
}

function aggregateMetrics(
  observations: SyntheticObservation[],
  priceCatalog: PriceCatalog
): AggregateMetrics {
  const word = sumEdits(observations.map((item) =>
    measureEdits(item.reference, item.hypothesis, "word")));
  const character = sumEdits(observations.map((item) =>
    measureEdits(item.reference, item.hypothesis, "character")));
  const judged = observations.filter((item) => item.semanticJudgment !== null);
  const eligible = observations.filter((item) => item.clarificationEligible === true);
  const failureCounts = new Map<string, number>();
  let attemptedCost = 0;
  let successfulCost = 0;
  for (const item of observations) {
    const cost = estimateMicroUsd(item.billingUnits, findPrice(priceCatalog, item));
    attemptedCost = checkedAdd(attemptedCost, cost, "Attempted cost");
    if (item.success) {
      successfulCost = checkedAdd(successfulCost, cost, "Successful cost");
    } else {
      const reason = item.failureCode as string;
      failureCounts.set(reason, (failureCounts.get(reason) ?? 0) + 1);
    }
  }
  const expectedEntities = observations.reduce((sum, item) =>
    checkedAdd(sum, item.expectedEntities.length, "Expected entity count"), 0);
  const matchedEntities = observations.reduce((sum, item) =>
    checkedAdd(sum, item.matchedEntities.length, "Matched entity count"), 0);
  const ratio = (numerator: number, denominator: number) =>
    denominator ? numerator / denominator : null;
  return {
    word,
    character,
    semantic: {
      correct: judged.filter((item) => item.semanticJudgment === true).length,
      judged: judged.length,
      missing: observations.length - judged.length,
      accuracy: ratio(judged.filter((item) => item.semanticJudgment === true).length, judged.length),
    },
    entity: {
      matched: matchedEntities,
      expected: expectedEntities,
      accuracy: ratio(matchedEntities, expectedEntities),
    },
    clarification: {
      requested: eligible.filter((item) => item.clarificationRequested).length,
      eligible: eligible.length,
      missingEligibility: observations.filter(
        (item) => item.clarificationEligible === null
      ).length,
      rate: ratio(
        eligible.filter((item) => item.clarificationRequested).length,
        eligible.length
      ),
    },
    success: {
      successful: observations.filter((item) => item.success).length,
      attempted: observations.length,
      rate: ratio(observations.filter((item) => item.success).length, observations.length),
    },
    latencyMs: {
      p50: nearestRank(observations.map((item) => item.latencyMs), 0.5),
      p95: nearestRank(observations.map((item) => item.latencyMs), 0.95),
      p99: nearestRank(observations.map((item) => item.latencyMs), 0.99),
    },
    costMicroUsd: { attempted: attemptedCost, successful: successfulCost },
    failures: {
      count: observations.filter((item) => !item.success).length,
      reasons: [...failureCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([reason, count]) => ({ reason, count })),
    },
  };
}

export function buildAggregateScorecard(params: {
  runSpec: EvaluationRunSpec;
  manifest: GitSafeManifestMetadata;
  fixture: SyntheticFixture;
  priceCatalog: PriceCatalog;
}): AggregateScorecard {
  const runSpec = validateEvaluationRunSpec(params.runSpec);
  const manifest = validateGitSafeManifest(params.manifest);
  const fixture = validateSyntheticFixture(params.fixture);
  const priceCatalog = validatePriceCatalog(params.priceCatalog, { syntheticOnly: true });
  const fixtureDigest = digestCanonical(fixture);
  const manifestDigest = digestCanonical(manifest);
  const priceCatalogDigest = digestCanonical(priceCatalog);
  if (
    runSpec.fixtureVersion !== fixture.fixtureVersion ||
    runSpec.fixtureDigest !== fixtureDigest ||
    manifest.manifestDigest !== fixtureDigest ||
    runSpec.manifestDigest !== manifestDigest ||
    runSpec.priceCatalogVersion !== priceCatalog.catalogVersion ||
    runSpec.priceCatalogDigest !== priceCatalogDigest
  ) {
    throw new Error("Evaluation artifact binding mismatch");
  }
  const slices = [...new Set(fixture.observations.flatMap((item) => item.slices))]
    .sort((left, right) => left.localeCompare(right))
    .map((slice) => {
      const observations = fixture.observations.filter((item) => item.slices.includes(slice));
      const suppressed = observations.length < fixture.minimumSliceCount;
      return {
        slice,
        suppressed,
        observations: suppressed ? null : observations.length,
        metrics: suppressed ? null : aggregateMetrics(observations, priceCatalog),
      };
    });
  const skipReasons = [...fixture.skips].sort((left, right) =>
    left.reason.localeCompare(right.reason));
  const skipCount = skipReasons.reduce((sum, item) =>
    checkedAdd(sum, item.count, "Skip count"), 0);
  const withoutDigest = {
    schemaVersion: SCORECARD_SCHEMA_VERSION,
    contractVersion: EVALUATION_CONTRACT_VERSION,
    comparisonPolicyVersion: COMPARISON_POLICY_VERSION,
    provenance: {
      runVersion: runSpec.runVersion,
      runSpecDigest: digestCanonical(runSpec),
      candidateVersion: runSpec.candidateVersion,
      corpusVersion: manifest.corpusVersion,
      split: manifest.split,
      manifestDigest,
      fixtureVersion: fixture.fixtureVersion,
      fixtureDigest,
      evaluatorVersion: runSpec.evaluatorVersion,
      annotationVersion: manifest.annotationVersion,
      sliceRegistryVersion: manifest.sliceRegistryVersion,
      consentPolicyVersion: manifest.consentPolicyVersion,
      retentionPolicyVersion: manifest.retentionPolicyVersion,
      providerConfigVersion: runSpec.providerConfigVersion,
      promptVersion: runSpec.promptVersion,
      policyVersion: runSpec.policyVersion,
      priceCatalogVersion: priceCatalog.catalogVersion,
      priceCatalogDigest,
    },
    observationCount: fixture.observations.length,
    overall: aggregateMetrics(fixture.observations, priceCatalog),
    skips: { count: skipCount, reasons: skipReasons },
    slices,
    limitations: [
      "Synthetic fixtures do not establish real-language quality.",
      "Prices marked synthetic-example are not provider quotes or invoices.",
      "No route promotion or threshold decision is represented.",
    ],
  };
  return {
    ...withoutDigest,
    reportDigest: digestCanonical(withoutDigest),
  };
}
