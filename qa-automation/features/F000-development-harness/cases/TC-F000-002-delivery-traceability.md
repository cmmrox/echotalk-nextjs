---
id: TC-F000-002
feature: F000
stages: [S00]
acceptance_refs: [F000-AC02, F000-AC06]
risk: traceability
priority: required
automation: qa-automation/features/F000-development-harness/governance/delivery-traceability.test.mjs
command: node --test qa-automation/features/F000-development-harness/governance/delivery-traceability.test.mjs
---

# TC-F000-002 — Delivery and Traceability Enforcement

## Purpose and preconditions

Verify stable IDs, valid task DAGs, final T90 dependency closure, acceptance
coverage, permanent QA coverage, and separate human gates.

## Test data and privacy

Current F000 artifacts and a synthetic corrupted temporary copy.

## Steps

Run delivery and traceability tests, remove one required T90 dependency in the
copy, and rerun the validator.

## Expected results

Current artifacts pass. The broken final QA dependency fails.

## Language, device, and environment slices

Not language/device dependent.

## Evidence and failure handling

Any missing dependency, case, or gate blocks S00.
