---
id: TC-F000-003
feature: F000
stages: [S00]
acceptance_refs: [F000-AC03]
risk: operability
priority: required
automation: qa-automation/features/F000-development-harness/governance/scaffolding.test.mjs
command: node --test qa-automation/features/F000-development-harness/governance/scaffolding.test.mjs
---

# TC-F000-003 — Artifact Scaffolding

## Purpose and preconditions

Verify feature, stage, and task commands create collision-safe artifacts that
satisfy draft/proposed delivery contracts.

## Test data and privacy

Synthetic IDs in a temporary directory only.

## Steps

Create F901, S91, and T01 with the repository scripts, validate the delivery
tree, and verify T90 automatically depends on T01.

## Expected results

All files are created once, validate successfully, and a repeat scaffold is
rejected without overwrite.

## Language, device, and environment slices

Not language/device dependent.

## Evidence and failure handling

Any overwrite, invalid artifact, or missing T90 dependency blocks S00.
