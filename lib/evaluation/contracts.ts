export const EVALUATION_CONTRACT_VERSION = "f001-s02-v1" as const;
export const COMPARISON_POLICY_VERSION = "comparison-v1" as const;
export const SCORECARD_SCHEMA_VERSION = "scorecard-v1" as const;

export type EvaluationSplit = "train" | "dev" | "test";

export type GitSafeManifestMetadata = {
  schemaVersion: typeof EVALUATION_CONTRACT_VERSION;
  corpusVersion: string;
  manifestDigest: string;
  split: EvaluationSplit;
  sliceRegistryVersion: string;
  annotationVersion: string;
  consentPolicyVersion: string;
  retentionPolicyVersion: string;
  syntheticOnly: boolean;
};

export type SyntheticObservation = {
  fixtureId: string;
  slices: string[];
  reference: string;
  hypothesis: string;
  expectedEntities: string[];
  matchedEntities: string[];
  semanticJudgment: boolean | null;
  clarificationEligible: boolean | null;
  clarificationRequested: boolean;
  latencyMs: number;
  success: boolean;
  provider: string;
  model: string;
  region: string;
  billingUnits: number;
};

export type PriceCatalogEntry = {
  provider: string;
  model: string;
  region: string;
  billingUnit: "observation";
  microUsdPerUnit: number;
  effectiveAt: string;
  retrievedAt: string;
  source: string;
  classification: "synthetic-example" | "estimate" | "invoice";
};

export type PriceCatalog = {
  schemaVersion: "price-catalog-v1";
  catalogVersion: string;
  entries: PriceCatalogEntry[];
};

export type EditCounts = {
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceUnits: number;
  edits: number;
  rate: number | null;
};

export type AggregateScorecard = {
  schemaVersion: typeof SCORECARD_SCHEMA_VERSION;
  contractVersion: typeof EVALUATION_CONTRACT_VERSION;
  comparisonPolicyVersion: typeof COMPARISON_POLICY_VERSION;
  runVersion: string;
  fixtureVersion: string;
  priceCatalogVersion: string;
  observationCount: number;
  word: EditCounts;
  character: EditCounts;
  semantic: { correct: number; judged: number; missing: number; accuracy: number | null };
  entity: { matched: number; expected: number; accuracy: number | null };
  clarification: {
    requested: number;
    eligible: number;
    missingEligibility: number;
    rate: number | null;
  };
  success: { successful: number; attempted: number; rate: number | null };
  latencyMs: { p50: number | null; p95: number | null; p99: number | null };
  costMicroUsd: { attempted: number; successful: number };
  slices: Array<{ slice: string; observations: number; suppressed: boolean }>;
  limitations: string[];
};
