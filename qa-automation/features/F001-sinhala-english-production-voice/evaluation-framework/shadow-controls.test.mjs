import assert from "node:assert/strict";
import test from "node:test";

import { decideShadowEligibility } from "../../../../lib/evaluation/shadowPolicy.ts";
import { ShadowTelemetry } from "../../../../lib/evaluation/shadowTelemetry.ts";

const eligibleInput = {
  enabled: true,
  disclosureApproved: true,
  consentEligible: true,
  budgetApproved: true,
  stableKey: "synthetic-session-1",
  samplingSaltVersion: "salt-v1",
  samplePartsPerMillion: 1_000_000,
  operationsUsed: 0,
  maxOperations: 2,
  costUsedMicroUsd: 0,
  nextCostMicroUsd: 100,
  maxCostMicroUsd: 200,
};

test("shadowing fails closed at every human and feature gate", () => {
  assert.equal(decideShadowEligibility({ ...eligibleInput, enabled: false }).reason, "disabled");
  assert.equal(
    decideShadowEligibility({ ...eligibleInput, disclosureApproved: false }).reason,
    "disclosure_unapproved"
  );
  assert.equal(
    decideShadowEligibility({ ...eligibleInput, consentEligible: false }).reason,
    "consent_ineligible"
  );
  assert.equal(
    decideShadowEligibility({ ...eligibleInput, budgetApproved: false }).reason,
    "budget_unapproved"
  );
});

test("sampling is deterministic and caps reject before work", () => {
  const first = decideShadowEligibility(eligibleInput);
  const second = decideShadowEligibility(eligibleInput);
  assert.deepEqual(first, second);
  assert.equal(first.eligible, true);
  assert.equal(
    decideShadowEligibility({ ...eligibleInput, operationsUsed: 2 }).reason,
    "operation_cap"
  );
  assert.equal(
    decideShadowEligibility({
      ...eligibleInput,
      costUsedMicroUsd: 150,
      nextCostMicroUsd: 100,
    }).reason,
    "cost_cap"
  );
});

test("telemetry accepts bounded dimensions only and clears deterministically", () => {
  const telemetry = new ShadowTelemetry();
  telemetry.record({
    routeVersion: "fake-route-v1",
    outcome: "completed",
    latencyMs: 420,
    costMicroUsd: 100,
  });
  telemetry.record({
    routeVersion: "fake-route-v1",
    outcome: "completed",
    latencyMs: 450,
    costMicroUsd: 100,
  });
  assert.deepEqual(telemetry.snapshot(), [{
    routeVersion: "fake-route-v1",
    outcome: "completed",
    latencyBucket: "lt_500ms",
    observations: 2,
    costMicroUsd: 200,
  }]);
  assert.throws(() => telemetry.record({
    routeVersion: "fake-route-v1",
    outcome: "completed",
    latencyMs: 10,
    costMicroUsd: 0,
    transcript: "forbidden",
  }));
  telemetry.clear();
  assert.deepEqual(telemetry.snapshot(), []);
});

test("telemetry overflow rejection is atomic", () => {
  const telemetry = new ShadowTelemetry();
  const base = {
    routeVersion: "shadow-v1",
    outcome: "completed",
    latencyMs: 200,
  };
  telemetry.record({ ...base, costMicroUsd: Number.MAX_SAFE_INTEGER });

  assert.throws(
    () => telemetry.record({ ...base, costMicroUsd: 1 }),
    /overflow/
  );
  assert.deepEqual(telemetry.snapshot(), [
    {
      routeVersion: "shadow-v1",
      outcome: "completed",
      latencyBucket: "lt_500ms",
      observations: 1,
      costMicroUsd: Number.MAX_SAFE_INTEGER,
    },
  ]);
});
