---
id: T80
feature: F001
stage: S02
slug: serialized-integration
type: integration
status: blocked
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: /root/s01_architecture_review
base_sha: 5b0b9ddba2374b0eaa3a828094ddada12f46a1cd
result_sha: pending
depends_on: [T03, T04, T05]
requirement_refs: [F001-R16, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: [".env.example", "package.json", "docs/**", "lib/evaluation/**", "scripts/evaluation/**", "evaluation/**", "config/evaluation/**", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/**", "qa-automation/features/F001-sinhala-english-production-voice/evaluation-framework/**"]
prohibited_paths: ["app/**", "components/**", "media-service/**", "lib/services/**", "delivery/features/F001-sinhala-english-production-voice/stages/S03-*/**"]
test_commands: ["npm run governance:validate", "npm run test:f001:s02:dev", "npm run ci:verify"]
next_owner: project-manager
---

# T80 — Integrate Evaluation and Shadow Framework

## Outcome

The reviewed S02 framework is integrated only after the mandatory human corpus,
privacy, disclosure, sampling, and budget gate is satisfied.

## Included scope and exclusions

- Included: reviewed offline modules, approved external-manifest digest,
  controls, documentation, CI, and rollback evidence.
- Excluded: provider promotion, public traffic, UAT, or release.

## Development

Blocked by T04. Synthetic developer work may be prepared but cannot be called
an integrated S02 candidate.

## Tests

- Tests added or updated: full S02 developer and repository regression.
- Commands and expected outcomes: all listed commands pass after unblock.

## Acceptance criteria

AC18 is eligible for T90 only after approved corpus and baseline evidence.

## Security, privacy, and data impact

No restricted content enters Git or gate evidence.

## Observability, configuration, and migration

Bind all versions and approved digests. No persistent migration in this slice.

## Rollout and rollback

Default-off; disable shadow/capture and execute approved deletion policy.

## Evidence and handoff

- Actual files changed: pending integration.
- Commands run with pass/fail/blocked/skip: blocked by T04.
- Evidence: synthetic developer evidence is non-certifying.
- Remaining risks: named human and independent QA decisions.
- Handoff decision and receiver: T90 only after T04 and architecture approval.
