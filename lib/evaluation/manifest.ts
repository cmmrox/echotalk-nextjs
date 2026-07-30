import {
  COMPARISON_POLICY_VERSION,
  EVALUATION_CONTRACT_VERSION,
  RUN_SPEC_SCHEMA_VERSION,
  type EvaluationRunSpec,
  type GitSafeManifestMetadata,
} from "@/lib/evaluation/contracts";

const allowedKeys = new Set([
  "schemaVersion",
  "corpusVersion",
  "manifestDigest",
  "split",
  "sliceRegistryVersion",
  "annotationVersion",
  "consentPolicyVersion",
  "retentionPolicyVersion",
  "syntheticOnly",
]);

const forbiddenContentKey = /(audio|transcript|reference|hypothesis|sampleId|consentReference|storage|locator|speaker|person)/i;
const versionPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const runSpecKeys = new Set([
  "schemaVersion",
  "runVersion",
  "candidateVersion",
  "fixtureVersion",
  "fixtureDigest",
  "manifestDigest",
  "priceCatalogVersion",
  "priceCatalogDigest",
  "evaluatorVersion",
  "providerConfigVersion",
  "promptVersion",
  "policyVersion",
  "syntheticOnly",
]);

export function validateGitSafeManifest(value: unknown): GitSafeManifestMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Manifest must be an object");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (forbiddenContentKey.test(key)) {
      throw new Error("Manifest contains a forbidden content-bearing field");
    }
    if (!allowedKeys.has(key)) throw new Error("Manifest contains an unknown field");
  }
  const requiredVersions = [
    "corpusVersion",
    "sliceRegistryVersion",
    "annotationVersion",
    "consentPolicyVersion",
    "retentionPolicyVersion",
  ] as const;
  if (record.schemaVersion !== EVALUATION_CONTRACT_VERSION) {
    throw new Error("Unsupported manifest schema");
  }
  for (const key of requiredVersions) {
    if (typeof record[key] !== "string" || !versionPattern.test(record[key])) {
      throw new Error(`Invalid manifest version: ${key}`);
    }
  }
  if (typeof record.manifestDigest !== "string" || !digestPattern.test(record.manifestDigest)) {
    throw new Error("Invalid manifest digest");
  }
  if (!["train", "dev", "test"].includes(String(record.split))) {
    throw new Error("Invalid immutable split");
  }
  if (record.syntheticOnly !== true) {
    throw new Error("Only synthetic manifests are permitted before human approval");
  }
  return record as GitSafeManifestMetadata;
}

export function validateEvaluationRunSpec(value: unknown): EvaluationRunSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Evaluation run spec must be an object");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!runSpecKeys.has(key)) throw new Error("Evaluation run spec contains an unknown field");
  }
  if (
    record.schemaVersion !== RUN_SPEC_SCHEMA_VERSION ||
    record.evaluatorVersion !== COMPARISON_POLICY_VERSION ||
    record.syntheticOnly !== true
  ) {
    throw new Error("Unsupported evaluation run spec");
  }
  for (const key of [
    "runVersion",
    "candidateVersion",
    "fixtureVersion",
    "priceCatalogVersion",
    "providerConfigVersion",
    "promptVersion",
    "policyVersion",
  ] as const) {
    if (typeof record[key] !== "string" || !versionPattern.test(record[key])) {
      throw new Error(`Invalid evaluation run version: ${key}`);
    }
  }
  for (const key of ["fixtureDigest", "manifestDigest", "priceCatalogDigest"] as const) {
    if (typeof record[key] !== "string" || !digestPattern.test(record[key])) {
      throw new Error(`Invalid evaluation run digest: ${key}`);
    }
  }
  return record as EvaluationRunSpec;
}
