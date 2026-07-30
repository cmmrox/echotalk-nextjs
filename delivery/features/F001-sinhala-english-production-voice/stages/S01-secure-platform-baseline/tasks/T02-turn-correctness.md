---
id: T02
feature: F001
stage: S01
slug: turn-correctness
type: implementation
status: in-review
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: pending-solution-architecture-review
base_sha: ef369889ccf3144b51c94741e7aa4777edc89d18
result_sha: pending
depends_on: [T01]
requirement_refs: [F001-R02, F001-R13, F001-R14]
acceptance_refs: [F001-AC02, F001-AC03, F001-AC04, F001-AC16]
writable_paths: ["lib/contracts/recognitionAssembly.ts", "lib/contracts/agentInput.ts", "lib/services/stt.ts", "media-service/processingQueue.ts", "media-service/pipeline.ts", "media-service/turnAudioStore.ts", "media-service/turnRecords.ts", "media-service/turnState.ts", "media-service/store.ts", "media-service/sessionManager.ts", "qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/*.test.mjs"]
prohibited_paths: ["docs/product/**", "docs/features/**", "app/api/tts/**"]
test_commands: ["npm run test:f001:s01:dev", "npm run typecheck"]
next_owner: project-manager
---

# T02 — Implement Exact Turn Correctness

## Outcome

Recognition preserves all final segments once; FIFO processing reads exact turn
audio; the current model turn occurs once; terminal work is de-duplicated.
## Included scope and exclusions

- Included: assembly, audio isolation, lifecycle IDs, chronology, empty speech.
- Excluded: correction policy, durable persistence, live-provider QA.

## Development

Use server-issued turn ownership and remove processed audio promptly.
## Tests

- Tests added or updated: order, isolation, and exact-current-turn tests.
- Commands and expected outcomes: developer tests and typecheck pass.

## Acceptance criteria

Developer evidence for AC02, AC03, AC04, and AC16; T90 is authoritative.
## Security, privacy, and data impact

Turn records are transient restricted data and stay out of ordinary logs.
## Observability, configuration, and migration

Add trace/turn/attempt/idempotency and provider identities. No migration.
## Rollout and rollback

Additive compatibility; rollback routing, never correctness protections.
## Evidence and handoff

- Actual files changed: listed correctness and deterministic test paths.
- Commands run with pass/fail/blocked/skip: five assertions and typecheck pass.
- Evidence: synthetic Sinhala/English fixtures only.
- Remaining risks: independent concurrency stress remains pending.
- Handoff decision and receiver: architecture review, then T80.
