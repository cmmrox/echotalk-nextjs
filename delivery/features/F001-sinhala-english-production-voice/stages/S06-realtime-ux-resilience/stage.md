---
id: S06
feature: F001
slug: realtime-ux-resilience
status: proposed
acceptance_refs: []
depends_on: [S01, S02, S03, S04, S05]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S06 — Realtime UX Accessibility and Resilience

## Production-releasable outcome

The integrated conversation survives interruption, reconnect, provider failure,
restart, and load with accessible controls, authorized durable metadata,
bounded ephemeral state, complete cleanup, observability, and reversible
migrations.

## Included scope and exclusions

- Included: additive state foundation, metadata cutover, ephemeral queue/media
  cutover, session drain, cancellation/replay/barge-in, retry/circuit breakers,
  accessible realtime/reconnect states, Postgres/Redis ownership, consented
  object storage only, retention/deletion, health, alerts, load/chaos, backup/
  restore, and rollback.
- Excluded: migrating live media buffers, split-brain in-memory production
  fallback, new provider behavior, changing accepted speech meaning, UAT
  acceptance, and release.

## Requirements and acceptance criteria

Requirements: `F001-R13`–`R15` and `R17`–`R20`. Planned primary acceptance:
`F001-AC14`, `AC15`, `AC17`, `AC19`, and `AC22`, activated only with task and
permanent-QA coverage. AC12/AC16/AC20 remain integration regressions.

## Architecture and data

Control API owns authorization, consent/config, durable metadata/audit in
Postgres. Media gateway owns frames/backpressure. Orchestrator owns idempotent
turn/attempt state. Redis owns short-TTL active state, queues, locks, limits,
and media references. Object storage contains only consented, encrypted,
expiry-bound samples. Adapters own no domain state.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 state/realtime ADRs | solution-architect | — | assigned architecture files | planned |
| T02 schema/state foundation | full-stack-developer | T01 | sole schema/migration/bootstrap paths | planned |
| T03 media/session resilience | full-stack-developer | T01, T02 | assigned lifecycle/media files | planned |
| T04 accessible realtime UX | ui-ux-engineer | T03 | assigned UI files | planned |
| T05 resilience/observability | full-stack-developer | T01, T02 | assigned health/metrics files | planned |
| T06 privacy lifecycle | full-stack-developer | T01, T02 | assigned privacy/policy services | planned |
| T80 serialized cutover/integration | full-stack-developer | T03–T06 | shared pipeline/routes/config | planned |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

Internal cutovers must serialize: additive data foundation, metadata state,
ephemeral media/queue, then realtime UX/operations enablement.

## Security, privacy, and abuse

Enforce authorization, least privilege, encryption, retention/deletion,
redaction, bounded queues/media, and regional decisions. Redis failure rejects
new production voice work rather than falling back to process-local split
brain. Deletion remains active during rollback.

## Quality, latency, reliability, and cost budgets

Meet approved reconnect, interruption, cleanup, availability, latency, load,
recovery, and cost limits. Verify zero cross-session leakage/duplicate terminal
turns and complete keyboard/screen-reader operation on the supported matrix.

## Observability and operations

Expose content-free lifecycle, queue/backpressure, store health, retries,
circuit state, deletion lag, media expiry, provider degradation, cost, and SLO
signals with alerts/runbooks.

## Configuration, migration, deployment, and rollback

Take and restore-test a backup; use additive/versioned schema and approved
metadata-only dual-write; drain sessions before Redis/media cutover. Rollback
pauses new sessions, drains/cancels attempts, restores compatible binary/config,
retains additive schema/deletion jobs, and offers text-only.

## Independent QA

Final task: `T90`. QA covers concurrency, restart/reconnect, migration/restore,
cleanup/deletion, authorization/privacy, accessibility, provider outage,
backpressure/load/chaos, cost, and rollback.

## UAT scenarios

Feature UAT 13 and 17–20: interruption, assistive technology, reconnect/
retention, rate/spend boundaries, and content-free operator diagnosis.

## Risks and exit criteria

Risks are stage breadth, split brain, partial dual-write, stale media/timers,
cross-session leakage, overload, deletion gaps, reconnect ambiguity,
accessibility regression, and regional mismatch. Exit requires all four
cutovers independently flagged/reversible, restored backup evidence, passing
T90, and approved identity/store/region/retention/support decisions.
