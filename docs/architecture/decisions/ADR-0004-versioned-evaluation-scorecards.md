---
id: ADR-0004
status: proposed
feature: F001
stage: S02
---

# ADR-0004 — Versioned Metrics, Pricing, and Aggregate Scorecards

## Context

Quality and cost comparisons are invalid without pinned rules, denominators,
prices, identities, and deterministic aggregation.

## Decision

Use versioned run specifications, integer count metrics, integer micro-USD
pricing, explicit missing judgments, stable percentile rules, deterministic
ordering, and content-free aggregate scorecards. Price snapshots are immutable
and distinguish estimates from invoices.

## Consequences

Every material evaluator, annotation, slice, price, provider/config, or report
change requires a new version and baseline comparison. No threshold is invented
before human review of representative results.

## Rollback

Pin the previous immutable evaluator/catalog and discard ignored local runs.
Never rewrite historical scorecards.
