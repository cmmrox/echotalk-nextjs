import {
  COMPARISON_POLICY_VERSION,
  EVALUATION_CONTRACT_VERSION,
  SCORECARD_SCHEMA_VERSION,
  type AggregateScorecard,
  type EditCounts,
  type PriceCatalog,
  type SyntheticObservation,
} from "@/lib/evaluation/contracts";
import { measureEdits, nearestRank } from "@/lib/evaluation/metrics";
import { estimateMicroUsd, findPrice, validatePriceCatalog } from "@/lib/evaluation/pricing";

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

export function buildAggregateScorecard(params: {
  runVersion: string;
  fixtureVersion: string;
  minimumSliceCount: number;
  observations: SyntheticObservation[];
  priceCatalog: PriceCatalog;
}): AggregateScorecard {
  validatePriceCatalog(params.priceCatalog);
  if (!params.observations.length) throw new Error("At least one observation is required");
  if (!Number.isSafeInteger(params.minimumSliceCount) || params.minimumSliceCount < 1) {
    throw new Error("Invalid suppression threshold");
  }
  const word = sumEdits(params.observations.map((item) =>
    measureEdits(item.reference, item.hypothesis, "word")));
  const character = sumEdits(params.observations.map((item) =>
    measureEdits(item.reference, item.hypothesis, "character")));
  const judged = params.observations.filter((item) => item.semanticJudgment !== null);
  const eligible = params.observations.filter((item) => item.clarificationEligible === true);
  const missingEligibility = params.observations.filter(
    (item) => item.clarificationEligible === null
  ).length;
  let attemptedCost = 0;
  let successfulCost = 0;
  for (const item of params.observations) {
    const cost = estimateMicroUsd(item.billingUnits, findPrice(params.priceCatalog, item));
    attemptedCost += cost;
    if (item.success) successfulCost += cost;
  }
  const sliceCounts = new Map<string, number>();
  for (const item of params.observations) {
    for (const slice of new Set(item.slices)) {
      sliceCounts.set(slice, (sliceCounts.get(slice) ?? 0) + 1);
    }
  }
  const ratio = (numerator: number, denominator: number) =>
    denominator ? numerator / denominator : null;
  return {
    schemaVersion: SCORECARD_SCHEMA_VERSION,
    contractVersion: EVALUATION_CONTRACT_VERSION,
    comparisonPolicyVersion: COMPARISON_POLICY_VERSION,
    runVersion: params.runVersion,
    fixtureVersion: params.fixtureVersion,
    priceCatalogVersion: params.priceCatalog.catalogVersion,
    observationCount: params.observations.length,
    word,
    character,
    semantic: {
      correct: judged.filter((item) => item.semanticJudgment === true).length,
      judged: judged.length,
      missing: params.observations.length - judged.length,
      accuracy: ratio(judged.filter((item) => item.semanticJudgment === true).length, judged.length),
    },
    entity: {
      matched: params.observations.reduce((sum, item) => sum + item.matchedEntities.length, 0),
      expected: params.observations.reduce((sum, item) => sum + item.expectedEntities.length, 0),
      accuracy: ratio(
        params.observations.reduce((sum, item) => sum + item.matchedEntities.length, 0),
        params.observations.reduce((sum, item) => sum + item.expectedEntities.length, 0)
      ),
    },
    clarification: {
      requested: eligible.filter((item) => item.clarificationRequested).length,
      eligible: eligible.length,
      missingEligibility,
      rate: ratio(
        eligible.filter((item) => item.clarificationRequested).length,
        eligible.length
      ),
    },
    success: {
      successful: params.observations.filter((item) => item.success).length,
      attempted: params.observations.length,
      rate: ratio(params.observations.filter((item) => item.success).length, params.observations.length),
    },
    latencyMs: {
      p50: nearestRank(params.observations.map((item) => item.latencyMs), 0.5),
      p95: nearestRank(params.observations.map((item) => item.latencyMs), 0.95),
      p99: nearestRank(params.observations.map((item) => item.latencyMs), 0.99),
    },
    costMicroUsd: { attempted: attemptedCost, successful: successfulCost },
    slices: [...sliceCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slice, observations]) => ({
        slice,
        observations,
        suppressed: observations < params.minimumSliceCount,
      })),
    limitations: [
      "Synthetic fixtures do not establish real-language quality.",
      "Prices marked synthetic-example are not provider quotes or invoices.",
      "No route promotion or threshold decision is represented.",
    ],
  };
}
