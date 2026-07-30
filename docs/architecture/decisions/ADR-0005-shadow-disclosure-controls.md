---
id: ADR-0005
status: proposed
feature: F001
stage: S02
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
requires the human gate and a later reviewed integration.

## Consequences

An environment flag alone cannot authorize disclosure. Sampling rates, caps,
providers, regions, and retention are human-owned configuration.

## Rollback

Disable capture/shadow, reject new work, drain bounded in-flight work, verify
fan-out reaches zero, clear ephemeral comparisons, and execute approved deletion.
