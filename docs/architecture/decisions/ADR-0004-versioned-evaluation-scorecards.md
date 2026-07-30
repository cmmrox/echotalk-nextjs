---
id: ADR-0004
status: accepted
date: 2026-07-30
owners: [/root]
feature_refs: [F001]
stage_refs: [S02]
---

# ADR-0004 — Versioned Metrics, Pricing, and Aggregate Scorecards

## Context

Quality and cost comparisons are invalid without pinned rules, denominators,
prices, identities, and deterministic aggregation.

## Decision

Use versioned run specifications, integer edit/count metrics, `comparison-v1`,
integer micro-USD pricing, explicit missing judgments, nearest-rank
percentiles, deterministic ordering, and content-free aggregate scorecards.
Price snapshots are immutable and distinguish estimates from invoices.

## Options considered

| Option | Quality | Latency | Cost | Privacy/security | Operations |
|---|---|---|---|---|---|
| Spreadsheet/manual scoring | Inconsistent | Slow | Low | Copy risk | Poor reproducibility |
| Floating-point ad hoc runner | Repeatable-ish | Fast | Low | Controllable | Rounding drift |
| Versioned integer contracts | Deterministic | Fast | Low | Aggregate-only | Explicit provenance |

## Consequences

- Benefits: reproducible comparisons and exact cost arithmetic.
- Tradeoffs and residual risks: metric versions cannot compensate for biased data.
- Migration/compatibility: changes create new evaluator/catalog versions.
- Observability: scorecards bind all versions, denominators, limitations, failures, and skips.

## Validation and rollback

- Evidence required: deterministic metric/pricing fixtures, report hashing,
  redaction, and independent reproduction.
- Rollout: synthetic fake outputs before any enclave run.
- Rollback or migration path: pin the previous immutable evaluator/catalog.
- Rollback/reversal trigger: nondeterminism, missing price, content leakage, or denominator drift.
