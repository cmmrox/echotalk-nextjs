---
id: T04
feature: F001
stage: S01
slug: provider-interfaces-and-tests
type: implementation
status: in-review
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: pending-solution-architecture-review
base_sha: ef369889ccf3144b51c94741e7aa4777edc89d18
result_sha: d8ee76529d2369592054ade3a1be04fea2a2addc
depends_on: [T01]
requirement_refs: [F001-R07, F001-R13, F001-R18]
acceptance_refs: [F001-AC04, F001-AC09]
writable_paths: ["lib/contracts/**", "lib/services/agent.ts", "lib/services/stt.ts", "lib/services/tts.ts", "qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/**", "package.json"]
prohibited_paths: ["app/**", "components/**", "docs/product/**", "package-lock.json"]
test_commands: ["npm run test:f001:s01:dev", "npm run typecheck"]
next_owner: project-manager
---

# T04 — Implement Provider Interfaces and Contract Tests

## Outcome

Versioned provider-neutral interfaces expose capabilities, identity, usage, and
normalized failure without leaking vendor SDK shapes.
## Included scope and exclusions

- Included: recognizer/model/synthesizer, turn, usage, identity, and tests.
- Excluded: provider promotion and live-provider certification.

## Development

Map current Google/OpenAI results additively and preserve callers.
## Tests

- Tests added or updated: synthetic contract and correctness tests.
- Commands and expected outcomes: developer tests and typecheck pass.

## Acceptance criteria

Developer evidence for AC04 and AC09; fake-adapter QA remains T90.
## Security, privacy, and data impact

Tests contain synthetic text only; provider credentials stay server-side.
## Observability, configuration, and migration

Record contract/model/region/config identity and usage. No migration.
## Rollout and rollback

Do not promote any adapter or capability without evaluation evidence.
## Evidence and handoff

- Actual files changed: contracts, adapter mappings, tests, package command.
- Commands run with pass/fail/blocked/skip: developer tests/typecheck pass.
- Evidence: contract version `f001-s01-v1`.
- Remaining risks: live provider behavior is unverified.
- Handoff decision and receiver: architecture review, then T80.
