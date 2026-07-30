---
id: T01
feature: F001
stage: S01
slug: contracts-and-adrs
type: architecture
status: in-review
owner_role: solution-architect
reviewer_role: full-stack-developer
owner: /root
reviewer: pending-solution-architecture-review
base_sha: ef369889ccf3144b51c94741e7aa4777edc89d18
result_sha: 9b2eb15263a06c10e41aa66fc293073437f80663
depends_on: []
requirement_refs: [F001-R07, F001-R13, F001-R14, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC04, F001-AC09, F001-AC16, F001-AC20, F001-AC21]
writable_paths: ["docs/architecture/**", "docs/governance/id-registry.md", "delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/tasks/T01-contracts-and-adrs.md"]
prohibited_paths: ["app/**", "components/**", "media-service/**", "qa-automation/**"]
test_commands: ["npm run governance:validate"]
next_owner: project-manager
---

# T01 — Define Secure Conversation Contracts and ADRs

## Outcome

A secure in-process contract defines provider, turn, audio, authorization,
limit, cleanup, telemetry, compatibility, and rollback boundaries.

## Included scope and exclusions

- Included: ADR-0002, capability semantics, transient ownership, migration, and rollback.
- Excluded: provider promotion, durable stores, extracted services, UAT, and release.

## Development

Keep S01 additive and preserve S06 ownership of durable state and extraction.
## Tests

- Tests added or updated: governance linkage and stable ID validation.
- Commands and expected outcomes: `npm run governance:validate` passes.

## Acceptance criteria

Architecture coverage for AC04, AC09, AC16, AC20, and AC21.
## Security, privacy, and data impact

Capability authorization is not user identity; restricted content is transient.
## Observability, configuration, and migration

Add stable IDs and contract/config versions. No migration.
## Rollout and rollback

Keep public F001 exposure disabled; retain all security fixes on rollback.
## Evidence and handoff

- Actual files changed: ADR-0002, decision index, provider boundary, ID registry.
- Commands run with pass/fail/blocked/skip: pending final branch verification.
- Evidence: accepted architecture bound to F001/S01.
- Remaining risks: independent architecture review remains pending.
- Handoff decision and receiver: PM obtains review before `done`.
