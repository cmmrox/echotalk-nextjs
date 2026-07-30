---
id: ADR-0005
status: proposed
date: 2026-07-30
owners: [/root]
feature_refs: [F001]
stage_refs: [S02]
---

# ADR-0005 — Sampled Shadow Disclosure and Kill Switch

## Context

Shadow comparison is a second provider disclosure and extra cost even when it
does not affect the user-visible response.

## Decision

Shadow eligibility fails closed unless feature, disclosure approval,
purpose-specific consent, cohort, deterministic sampling, and operation/cost
caps all pass. Shadow failure never changes the primary response. Telemetry is
bounded and content-free. S02 implements policy/tests only; live pipeline wiring
requires T04 and a later reviewed integration.

## Options considered

| Option | Quality | Latency | Cost | Privacy/security | Operations |
|---|---|---|---|---|---|
| Always-on dual provider | Fast evidence | Higher | Unbounded | Unapproved disclosure | Simple but unsafe |
| Random client sampling | Biased/unverifiable | Low | Variable | Client bypass risk | Weak control |
| Server fail-closed deterministic gate | Reproducible | Low | Capped | Explicit consent/approval | Auditable |

## Consequences

- Benefits: non-interference, deterministic cohorts, bounded disclosure/cost.
- Tradeoffs and residual risks: no quality evidence until humans authorize real traffic.
- Migration/compatibility: no pipeline wiring in S02 synthetic preparation.
- Observability: decision reasons and aggregate counters only, never content.

## Validation and rollback

- Evidence required: default-off, consent denial, stable sampling, cap, failure
  isolation, kill switch, drain, redaction, and deletion tests.
- Rollout: policy and fakes only before T04.
- Rollback or migration path: disable capture/shadow and clear ephemeral aggregates.
- Rollback/reversal trigger: leakage, cap breach, provider fan-out after disable, or primary-response mutation.
