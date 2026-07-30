---
id: T80
feature: F001
stage: S01
slug: serialized-integration
type: integration
status: in-progress
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: pending-solution-architecture-review
base_sha: ef369889ccf3144b51c94741e7aa4777edc89d18
result_sha: pending
depends_on: [T02, T03, T04]
requirement_refs: [F001-R02, F001-R07, F001-R13, F001-R14, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC02, F001-AC03, F001-AC04, F001-AC09, F001-AC16, F001-AC20, F001-AC21]
writable_paths: [".env.example", "app/**", "components/**", "lib/**", "media-service/**", "package.json", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/**", "qa-automation/features/F000-development-harness/governance/scaffolding.test.mjs"]
prohibited_paths: ["docs/product/authority-registry.json", "delivery/features/F001-sinhala-english-production-voice/stages/S02-*/**"]
test_commands: ["npm run governance:validate", "npm run test:governance", "npm run test:f001:s01:dev", "npm run lint", "npm run typecheck", "npm run build"]
next_owner: project-manager
---

# T80 — Integrate the Secure Platform Baseline

## Outcome

One backward-compatible, publicly disabled S01 candidate is ready for
independent review and T90 QA.
## Included scope and exclusions

- Included: serialized route/client/orchestration/config integration and CI.
- Excluded: self-certified QA, UAT, live-provider claims, production release.

## Development

Integrate on the feature branch and bind the handoff to an exact commit.
## Tests

- Tests added or updated: deterministic S01 suite plus full baseline.
- Commands and expected outcomes: all frontmatter commands must pass.

## Acceptance criteria

All S01 planned acceptance references, subject to independent T90.
## Security, privacy, and data impact

No secrets/private fixtures; public exposure and user identity remain blocked.
## Observability, configuration, and migration

Add config names only. No persistent migration.
## Rollout and rollback

Internal-only after review; text/route rollback preserves security fixes.
## Evidence and handoff

- Actual files changed: product/config paths from T02-T04, S01 delivery/QA
  indexes, and the provisional-ID scaffolding regression test.
- Commands run with pass/fail/blocked/skip: partial developer checks pass.
- Evidence: candidate SHA pending focused commits and full verification.
- Remaining risks: independent review and T90 are unclaimed.
- Handoff decision and receiver: complete CI, freeze, hand to QA.
