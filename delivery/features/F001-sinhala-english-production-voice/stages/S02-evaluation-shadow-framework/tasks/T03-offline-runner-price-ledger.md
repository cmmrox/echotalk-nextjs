---
id: T03
feature: F001
stage: S02
slug: offline-runner-price-ledger
type: implementation
status: ready
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: /root/s01_architecture_review
base_sha: 5b0b9ddba2374b0eaa3a828094ddada12f46a1cd
result_sha: pending
depends_on: [T02]
requirement_refs: [F001-R16, F001-R18]
acceptance_refs: [F001-AC18]
writable_paths: ["lib/evaluation/contracts.ts", "lib/evaluation/manifest.ts", "lib/evaluation/metrics.ts", "lib/evaluation/pricing.ts", "lib/evaluation/scorecard.ts", "scripts/evaluation/**", "evaluation/fixtures/synthetic/**", "evaluation/manifests/template.json", "config/evaluation/price-catalog.example.v1.json", "package.json", "qa-automation/features/F001-sinhala-english-production-voice/evaluation-framework/offline-runner.test.mjs", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/tasks/T03-offline-runner-price-ledger.md"]
prohibited_paths: ["app/**", "components/**", "media-service/**", "lib/evaluation/shadowPolicy.ts", "lib/evaluation/shadowTelemetry.ts", "evaluation/data/**", "evaluation/manifests/approved/**", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/gates/**"]
test_commands: ["npm run test:f001:s02:dev", "npm run typecheck", "npm run lint"]
next_owner: full-stack-developer
---

# T03 — Implement Offline Runner and Price Ledger

## Outcome

A deterministic synthetic-only runner validates metadata, calculates versioned
metrics, attributes catalog-based cost, and emits content-free aggregate JSON.

## Included scope and exclusions

- Included: manifest validation, WER/CER, semantic/entity accuracy inputs,
  clarification eligibility/requested/missing denominators, latency/success
  aggregation, price catalog, safe scorecard.
- Excluded: native-speaker baseline, live provider calls, real samples,
  invoices, approved thresholds, or route promotion.

## Development

Reject content-bearing manifest fields and non-synthetic fixtures. Keep local
run outputs ignored and accept provider outputs only through test adapters.

## Tests

- Tests added or updated: metric, clarification denominators/missing
  eligibility, manifest, pricing, redaction, and determinism.
- Commands and expected outcomes: all listed commands pass.

## Acceptance criteria

Provides developer evidence for AC18 report mechanics only.

## Security, privacy, and data impact

Fixtures are fictional. Reports contain aggregates and opaque IDs, never audio,
reference/hypothesis text, credentials, or person-linked metadata.

## Observability, configuration, and migration

Record schema, evaluator, fixture, catalog, provider/config, and run versions.
No migration.

## Rollout and rollback

Offline command only; remove command/config to roll back.

## Evidence and handoff

- Actual files changed: pending implementation.
- Commands run with pass/fail/blocked/skip: pending.
- Evidence: pending exact result commit.
- Remaining risks: real corpus and prices require human/provider verification.
- Handoff decision and receiver: T80 after architecture review.
