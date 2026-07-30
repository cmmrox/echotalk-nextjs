import { createHash } from "node:crypto";

export type ShadowReason =
  | "eligible"
  | "disabled"
  | "disclosure_unapproved"
  | "consent_ineligible"
  | "budget_unapproved"
  | "invalid_configuration"
  | "operation_cap"
  | "cost_cap"
  | "not_sampled";

export type ShadowDecision = {
  eligible: boolean;
  reason: ShadowReason;
  policyVersion: "shadow-policy-v1";
  sampledBucket: number | null;
};

export function decideShadowEligibility(params: {
  enabled: boolean;
  disclosureApproved: boolean;
  consentEligible: boolean;
  budgetApproved: boolean;
  stableKey: string;
  samplingSaltVersion: string;
  samplePartsPerMillion: number;
  operationsUsed: number;
  maxOperations: number;
  costUsedMicroUsd: number;
  nextCostMicroUsd: number;
  maxCostMicroUsd: number;
}): ShadowDecision {
  const decision = (eligible: boolean, reason: ShadowReason, sampledBucket: number | null = null) => ({
    eligible,
    reason,
    policyVersion: "shadow-policy-v1" as const,
    sampledBucket,
  });
  if (!params.enabled) return decision(false, "disabled");
  if (!params.disclosureApproved) return decision(false, "disclosure_unapproved");
  if (!params.consentEligible) return decision(false, "consent_ineligible");
  if (!params.budgetApproved) return decision(false, "budget_unapproved");
  if (
    !params.stableKey ||
    !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(params.samplingSaltVersion) ||
    !Number.isSafeInteger(params.samplePartsPerMillion) ||
    params.samplePartsPerMillion < 0 ||
    params.samplePartsPerMillion > 1_000_000 ||
    ![params.operationsUsed, params.maxOperations, params.costUsedMicroUsd,
      params.nextCostMicroUsd, params.maxCostMicroUsd].every(
      (value) => Number.isSafeInteger(value) && value >= 0
    )
  ) {
    return decision(false, "invalid_configuration");
  }
  if (params.operationsUsed >= params.maxOperations) {
    return decision(false, "operation_cap");
  }
  if (params.nextCostMicroUsd > params.maxCostMicroUsd - params.costUsedMicroUsd) {
    return decision(false, "cost_cap");
  }
  const digest = createHash("sha256")
    .update(`${params.samplingSaltVersion}\0${params.stableKey}`)
    .digest();
  const sampledBucket = digest.readUInt32BE(0) % 1_000_000;
  return sampledBucket < params.samplePartsPerMillion
    ? decision(true, "eligible", sampledBucket)
    : decision(false, "not_sampled", sampledBucket);
}
