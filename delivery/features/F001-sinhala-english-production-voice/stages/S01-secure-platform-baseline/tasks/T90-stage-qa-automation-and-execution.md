---
id: T90
feature: F001
stage: S01
slug: stage-qa-automation-and-execution
type: stage-qa
status: done
owner_role: qa-engineer
reviewer_role: project-manager
owner: /root/s01_independent_qa
reviewer: /root
base_sha: e7ca7efbe51e06a393348553cb3084751b244b9d
result_sha: 146cdfb2fc4fc23b7f3f1ba8094feeba6c65c416
depends_on: [T01, T02, T03, T04, T80]
requirement_refs: [F001-R02, F001-R07, F001-R13, F001-R14, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC02, F001-AC03, F001-AC04, F001-AC09, F001-AC16, F001-AC20, F001-AC21]
writable_paths: ["qa-automation/features/F001-sinhala-english-production-voice/**", "qa-automation/runs/**", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/gates/qa-report.md", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/gates/qa-run.json"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run qa:stage -- F001 S01", "npm run ci:verify", "npm run test:f001:s01:dev", "npm run governance:validate"]
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

- Actual files changed: F001 permanent cases, S01 manifest, QA-only dynamic
  adapters/tests, `gates/qa-report.md`, and `gates/qa-run.json`.
- Commands run with pass/fail/blocked/skip: certifying `npm run qa:stage -- F001
  S01` passed 4/4 required cases and 31 assertions with zero failures/skips;
  `npm run ci:verify`, 23/23 developer S01 assertions, and final governance all
  passed. Lint reported zero errors and three pre-existing warnings.
- Evidence: source `e7ca7efbe51e06a393348553cb3084751b244b9d`,
  harness `7f6cb9400b06443d857e70c62b91f78172f4e847`, evidence
  `146cdfb2fc4fc23b7f3f1ba8094feeba6c65c416`, run SHA-256
  `1e94acdbb1cc5a35e03b1f9f1c6faf034cbf7b2f81253679f2dea013d4533274`.
- Remaining risks: live providers, production identity, human UAT, production
  permission, and release authorization remain unverified/ungranted.
- Handoff decision and receiver: independent QA PASS; S01 advances to
  `qa-passed` and the UAT coordinator receives the stage without any implied
  human acceptance or release permission.
