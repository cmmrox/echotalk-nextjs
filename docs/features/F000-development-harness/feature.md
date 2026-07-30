---
id: F000
slug: development-harness
status: approved
kind: delivery-enabler
product_owner: user-client
---

# F000 — Cross-tool Production Delivery Harness

## Problem and user value

EchoTalk needs one clean, enforceable way for Codex, Claude Code, specialist
agents, QA, and the human client to collaborate without duplicating project
truth or confusing implementation with production acceptance.

## Users and scenarios

- The human client records a feature and reviews UAT evidence.
- PM, BA, Architect, Developer, UI/UX, QA, and UAT roles work from bounded,
  durable artifacts.
- Codex and Claude consume the same project knowledge and generated role model.
- CI rejects broken traceability, self-approval, missing final QA, and stale
  generated adapters.

## Included behavior

- Canonical project knowledge under `docs/`.
- Feature → Stage → Task delivery artifacts with one file per task.
- Thin, generated cross-tool role adapters and one shared router skill.
- Independent permanent QA definitions and a stage QA runner.
- Deterministic scaffolding and validation commands.
- Non-destructive migration of legacy plans and logs.

## Excluded behavior

- Changing the voice application runtime.
- Claiming production Sinhala quality, deploying production, or retaining user
  audio.
- Simulating human UAT or production approval.

## Requirements

- `F000-R01`: Project/domain/architecture/standards/governance knowledge has
  exactly one canonical location under `docs/`.
- `F000-R02`: Codex and Claude role adapters are generated from one neutral
  manifest and contain only role identity, routes, and authority boundaries.
- `F000-R03`: Every production change begins with an approved feature and is
  delivered through a releasable stage containing separately assignable tasks.
- `F000-R04`: Every stage ends in a final independent `T90` QA automation and
  execution task for an exact candidate.
- `F000-R05`: Deterministic validators enforce agent, delivery, traceability,
  QA, and release invariants.
- `F000-R06`: Historical project plans and logs remain accessible as provenance
  but cannot be mistaken for current delivery evidence.

## Acceptance criteria

- `F000-AC01`: The shared skill and generated adapters contain no copied
  EchoTalk product, architecture, engineering, Sinhala-quality, or QA rules.
- `F000-AC02`: `npm run governance:validate` passes and fails when a generated
  adapter or required stage QA dependency is intentionally corrupted in an
  isolated test fixture.
- `F000-AC03`: Feature, stage, and task scaffolds generated in an isolated
  workspace satisfy the same validation contracts as hand-authored artifacts.
- `F000-AC04`: `npm run qa:stage -- F000 S00` executes the permanent F000 QA
  matrix and records an ignored local result without storing secrets or private
  data.
- `F000-AC05`: Legacy PRD, progress, plan, and log material is under
  `docs/archive/legacy/`; active indexes identify it as provenance only.
- `F000-AC06`: Independent QA, human client UAT, client production permission,
  and release-owner go/no-go remain distinct, machine-checkable gates.

## Language, accessibility, and UX slices

Harness documentation uses clear English and preserves explicit Sinhala-English
quality routes. UAT preparation must support bilingual client instructions when
product behavior is tested.

## Security, privacy, and data handling

The harness stores only repository metadata and redacted evidence. `.env*`,
private audio, personal transcripts, credentials, and raw sensitive QA runs are
excluded from Git.

## Failure and fallback behavior

Validation fails closed with actionable file-level errors. Scaffolding refuses
invalid IDs, slugs, collisions, or missing parents. A required QA skip blocks
the stage gate.

## Quality, latency, reliability, and cost budgets

All governance and F000 QA commands must run locally without external provider
credentials or network calls. Runtime should be practical for every commit.

## Telemetry and operations

CI stores only standard build/test logs and non-sensitive artifacts. Local QA
results are ignored unless a reviewed redacted summary is deliberately promoted.

## UAT scenarios

1. Record a sample feature, stage, and task from templates.
2. Assign a bounded role and verify both tool adapters route to the same docs.
3. Run validation and stage QA.
4. Review that agents cannot mark client acceptance or production permission.

## Decisions, assumptions, and dependencies

- [ADR-0001](../../architecture/decisions/ADR-0001-shared-delivery-harness.md)
- Node.js and npm are the only harness runtime dependencies.

## Approval

- Human product owner: user/client
- Decision/date: approved through the explicit request to implement, 2026-07-30
- Scope: harness implementation only; UAT acceptance and release remain pending
