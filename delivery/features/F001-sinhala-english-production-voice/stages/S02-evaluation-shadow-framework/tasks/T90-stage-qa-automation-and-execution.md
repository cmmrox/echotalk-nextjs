---
id: T90
feature: F001
stage: S02
slug: stage-qa-automation-and-execution
type: stage-qa
status: draft
owner_role: qa-engineer
reviewer_role: project-manager
owner: pending-independent-qa
reviewer: pending
base_sha: pending
result_sha: pending
depends_on: [T01, T02, T03, T04, T05, T80]
requirement_refs: [F001-R16, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: ["qa-automation/features/F001-sinhala-english-production-voice/**", "qa-automation/runs/**", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/gates/qa-report.md", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/gates/qa-run.json"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run qa:stage -- F001 S02"]
next_owner: project-manager
---

# T90 — Stage QA Automation and Execution

## Outcome

Independently certify or reject the exact S02 candidate and approved external
corpus/baseline provenance without accessing or persisting restricted content.

## Included scope and exclusions

- Included: metric reproduction, schema/privacy controls, pricing, redaction,
  disable/delete, shadow caps, sealed-set separation, and regression.
- Excluded: product-code fixes, human consent/privacy/budget decisions, UAT,
  provider promotion, production permission, and release.

## Development

QA may change only QA-owned paths. Product defects return to their owners.

## Tests

- Tests added or updated: permanent S02 acceptance and abuse cases.
- Commands and expected outcomes: clean exact-candidate run; any required skip
  or missing human decision blocks `qa-passed`.

## Acceptance criteria

AC18 and the S02 contributions to later AC05/AC11.

## Security, privacy, and data impact

Synthetic/redacted evidence only; verify no real content crosses into Git.

## Observability, configuration, and migration

Bind evaluator, manifest digest, annotations, slices, catalog, route/config, and
report versions. No migration.

## Rollout and rollback

Verify flags, caps, deletion controls, and absence of live provider fan-out.

## Evidence and handoff

- Actual files changed: pending independent QA.
- Commands run with pass/fail/blocked/skip: blocked by T04/T80.
- Evidence: none.
- Remaining risks: named authorities, approved corpus/baseline, QA, UAT/release.
- Handoff decision and receiver: QA cannot start until all dependencies close.
