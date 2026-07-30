---
id: T90
feature: F001
stage: S01
slug: stage-qa-automation-and-execution
type: stage-qa
status: draft
owner_role: qa-engineer
reviewer_role: project-manager
owner: pending-independent-qa
reviewer: pending-project-manager
base_sha: d8ee76529d2369592054ade3a1be04fea2a2addc
result_sha: pending
depends_on: [T01, T02, T03, T04, T80]
requirement_refs: [F001-R02, F001-R07, F001-R13, F001-R14, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC02, F001-AC03, F001-AC04, F001-AC09, F001-AC16, F001-AC20, F001-AC21]
writable_paths: ["qa-automation/features/F001-sinhala-english-production-voice/**", "qa-automation/runs/**", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/gates/qa-report.md", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/gates/qa-run.json"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run qa:stage -- F001 S01"]
next_owner: project-manager
---

# T90 — Stage QA Automation and Execution

## Outcome

Independently certify or reject the exact integrated S01 candidate.
## Included scope and exclusions

- Included: permanent-case review, candidate freeze, deterministic and
  integration execution, security/log/secret scan, regression, rollback.
- Excluded: product-code edits, self-certification, UAT, production permission.

## Development

QA may add or correct test-only automation within writable paths, then bind the
result to the final source and harness commits.
## Tests

- Tests added or updated: review the four required permanent cases and add any
  missing concurrency, route, cleanup, or rollback coverage.
- Commands and expected outcomes: `npm run qa:stage -- F001 S01` produces an
  exact, redacted verdict only from a clean candidate.

## Acceptance criteria

AC02, AC03, AC04, AC09, AC16, AC20, and AC21.
## Security, privacy, and data impact

Use synthetic/redacted data; never persist raw audio, real transcripts, or keys.
## Observability, configuration, and migration

Bind evidence to source/harness commits and configuration names. No migration.
## Rollout and rollback

QA recommends only; failure leaves S01 in-progress and returns defects to owners.
## Evidence and handoff

- Actual files changed: pending independent QA.
- Commands run with pass/fail/blocked/skip: not run by independent QA.
- Evidence: none yet.
- Remaining risks: task is unclaimed; live-provider/auth integration and
  concurrency stress are not certified.
- Handoff decision and receiver: pending independent QA owner.
