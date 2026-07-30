---
id: ADR-0002
status: accepted
date: 2026-07-30
owners: [/root]
feature_refs: [F001]
stage_refs: [S01]
---

# ADR-0002 — Secure In-Process Conversation Baseline

## Context

The prototype combines media, turn orchestration, provider access, and
memory-resident session state. It reads only the first Google recognition
result, lets queued turns read the latest session audio, exposes session
resources by identifier alone, and has no stable provider or turn contract.
S01 must correct those defects without prematurely introducing the durable
stores and extracted services assigned to S06.

## Decision

- Keep S01 orchestration in-process and transient.
- Use versioned project-owned recognizer, conversation-model, synthesizer,
  capability, normalized-failure, usage, and immutable turn-record contracts.
- Key audio and processing by server-issued session and exact monotonic turn
  number. A FIFO queue owns each turn once and ignores duplicate scheduling.
- Give every attempt server-issued trace, session, turn, attempt, and
  idempotency identifiers. Store raw/verbatim/corrected/normalized transcript
  fields separately even when the latter two are initially null.
- Protect every media-session resource with a 256-bit bearer capability whose
  hash alone is stored server-side. Capability authorization prevents
  cross-session access but does not replace user authentication; public
  exposure remains blocked until the production identity decision.
- Fail closed on legacy provider routes unless a server-to-server token is
  configured. Bound media, JSON, SDP, ICE, request-rate, and per-session
  provider-operation budgets.
- Keep content out of routine diagnostics. Session close revokes authorization
  and removes governed media, queue, metrics, result, TTS, and turn state.

## Options considered

| Option | Quality | Latency | Cost | Privacy/security | Operations |
|---|---|---|---|---|---|
| Patch only the visible STT defect | Leaves turn races and IDOR | Neutral | Low | Unacceptable | Simple but unsafe |
| Extract services and add Postgres/Redis now | Strong eventual boundary | Migration risk | Higher | Strong after full design | Duplicates S06 |
| Secure additive in-process baseline | Fixes known integrity defects | Minimal overhead | Bounded | Capability-isolated, transient | Reversible and stage-aligned |

## Consequences

- Benefits: exact audio ownership, complete recognition assembly, current-turn
  correctness, provider replaceability, bounded abuse, deterministic cleanup.
- Tradeoffs and residual risks: capability tokens are bearer credentials;
  process restart drops sessions; no durable audit store or user identity yet.
- Migration/compatibility: contracts and metadata are additive. Existing
  provider SDK calls remain behind adapters, and public promotion stays off.
- Observability: emit stable identifiers, state, timing, route/config identity,
  sizes, usage, and error class without audio or transcript content.

## Validation and rollback

- Evidence required: multi-result, audio-isolation, exact-current-turn,
  capability isolation, input-limit, cleanup, provider-fake, regression, and
  independent T90 results.
- Rollout: deploy secure fixes with F001 disabled for public cohorts; exercise
  internal deterministic tests before any provider smoke test.
- Rollback: revert provider routing and UI enablement or use text-only mode.
  Do not roll back authorization, input bounds, redaction, or cleanup fixes.
- Rollback/reversal trigger: cross-session access, duplicate terminal turn,
  missing recognition segment, unbounded provider work, or sensitive logging.
