---
id: S01
feature: F001
slug: secure-platform-baseline
status: in-progress
acceptance_refs: [F001-AC02, F001-AC03, F001-AC04, F001-AC09, F001-AC16, F001-AC20, F001-AC21]
depends_on: []
final_qa_task: T90
candidate_sha: b5d02e377586c0fd7311d5589c5a5fb134a51e56
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S01 — Secure Platform Baseline

## Production-releasable outcome

A secure, provider-neutral, exact-once conversation baseline fixes current
turn-integrity defects while preserving the client contract behind a disabled
F001 flag. Internal deployment is possible; public exposure requires verified
authentication and authorization.

## Included scope and exclusions

- Included: all-result STT assembly, turn-scoped audio, exact history,
  empty-speech protection, immutable turn/attempt IDs, bounded cleanup,
  authorization, limits, secret/log hygiene, provider contracts, compatibility,
  telemetry, and rollback.
- Excluded: provider promotion, quality claims, corpus capture, correction UI,
  new TTS voices, durable-state cutover, UAT, and production release.

## Requirements and acceptance criteria

Requirements: `F001-R02`, `R07`, `R13`, `R14`, `R17`, `R18`, and `R20`.
Planned primary acceptance: `F001-AC02`, `AC03`, `AC04`, `AC09`, `AC16`,
`AC20`, and `AC21`. These move into frontmatter only with task and permanent-QA
coverage. Later stages extend rather than replace the provenance record.

## Architecture and data

Define project-owned recognizer, transcript-policy, conversation-model,
synthesizer, capability/error/usage, and immutable turn-event contracts. Keep
orchestration in-process. Content is transient by default; transcript forms and
turn IDs are additive and bounded. ADRs cover provider contracts, provenance,
audio binding, idempotency, authorization, and rollback.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 contracts/ADRs | solution-architect | — | assigned architecture files | in-review |
| T02 turn correctness | full-stack-developer | T01 | assigned STT/media/state files | in-review |
| T03 auth/secrets/limits | full-stack-developer | T01 | assigned auth/middleware/API files | in-review |
| T04 provider interfaces/tests | full-stack-developer | T01 | new contracts and tests | in-review |
| T80 serialized integration | full-stack-developer | T02–T04 | shared pipeline/routes/config | in-review |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

Tasks need exact owners/reviewers, base commit, paths, commands, and artifacts
before the stage can become `ready`.

## Security, privacy, and abuse

Restricted content stays transient and out of normal logs. Reject cross-session
access, oversized media, arbitrary client events, and unbounded work. Rollback
may disable F001 but cannot restore known authorization, redaction, input-bound,
or cleanup defects.

## Quality, latency, reliability, and cost budgets

The defined test matrix permits zero missing/duplicated final segments, zero
cross-turn audio association, zero LLM calls for empty speech, and zero
duplicate terminal turns. Record overhead and usage; do not add normal
dual-provider traffic.

## Observability and operations

Correlate trace/session/turn/attempt/idempotency IDs and record lifecycle,
bounded failure, config version, timing, usage, and cleanup without content.

## Configuration, migration, deployment, and rollback

Wrap existing providers with compatibility mappers and additive types. Deploy
F001 off, then internal-only. Roll back orchestration/config to text mode while
retaining security fixes and backward-compatible data.

## Independent QA

Final task: `T90`. It covers ordering, concurrency isolation, history,
idempotency, auth/limits, secret/log scans, cleanup, compatibility, regression,
and rollback.

## UAT scenarios

Feature UAT 10–12: silence/noise, ordered multi-segment speech, and rapid-turn
isolation. Human UAT remains pending.

## Risks and exit criteria

Risks are provider-shaped contracts, confidence ambiguity, divergent fallback
paths, turn/audio races, absent production identity, and dependencies. Exit
requires accepted ADRs, integrated tasks, frozen candidate, passing T90,
rehearsed rollback, and no unresolved high/critical issue.
