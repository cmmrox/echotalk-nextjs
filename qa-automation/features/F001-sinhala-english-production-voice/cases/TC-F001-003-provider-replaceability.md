---
id: TC-F001-003
feature: F001
stages: [S01]
acceptance_refs: [F001-AC04, F001-AC09]
risk: compatibility
priority: required
automation: qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/provider-contract.test.mjs
command: node --import ./qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/alias-register.mjs --test qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/provider-contract.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/provider-orchestration.test.mjs
---

# TC-F001-003 — Provider Replaceability

## Purpose and preconditions

Verify a fake satisfies the project contract without vendor SDK objects.

## Test data and privacy

Synthetic provider output.

## Steps

Execute contract, normalized-failure, and actual pipeline injection cases.

## Expected results

The real orchestration uses only the injected bundle, and the resulting turn
record preserves provider-neutral identity, provenance, timing, quality, usage,
and cost attribution.

## Language, device, and environment slices

Not device dependent.

## Evidence and failure handling

Contract drift blocks S01 T90.
