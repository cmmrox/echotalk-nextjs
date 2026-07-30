---
id: TC-F000-004
feature: F000
stages: [S00]
acceptance_refs: [F000-AC04, F000-AC05, F000-AC06]
risk: release-control
priority: required
automation: qa-automation/features/F000-development-harness/governance/structure-and-runner.test.mjs
command: node --test qa-automation/features/F000-development-harness/governance/structure-and-runner.test.mjs
---

# TC-F000-004 — Canonical Structure and Stage Runner

## Purpose and preconditions

Verify active docs link correctly, legacy files are archived, gate decisions
remain pending, and the stage manifest is complete.

## Test data and privacy

Repository metadata only.

## Steps

Run the documentation, QA-library, and release-gate validators; inspect the S00
manifest and ignored-run policy.

## Expected results

All active links resolve, no active legacy tree remains, every F000 case is in
the matrix, `qa-automation/runs/` is ignored, and no human gate is fabricated.

## Language, device, and environment slices

Not language/device dependent.

## Evidence and failure handling

Any failure blocks S00 and returns the candidate to the responsible task.
