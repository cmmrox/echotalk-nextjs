---
id: T03
feature: F001
stage: S02
slug: offline-runner-price-ledger
type: implementation
status: done
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: /root/s01_architecture_review
base_sha: bec55e5dc75b475a7ea62fcfb9d529a7b74d8f58
result_sha: 8de0d3691238ae6c954e642c053e519fab6fb182
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

- Actual files changed: the assigned contracts, manifest, metrics, pricing,
  scorecard, runner, synthetic fixture/template, example catalog, package
  scripts, and developer test paths.
- Commands run with pass/fail/blocked/skip:
  - `npm run typecheck` — pass.
  - `npm run test:f001:s02:dev` — pass, 12/12 tests across T03 and T05.
  - `npm run lint` — pass with zero errors and three pre-existing warnings in
    `app/page.tsx` and `media-service/audioPackaging.ts`.
  - `git diff --check` — pass.
- Evidence: initial implementation
  `e1637658a366ca01af5874209ecacc8e81a6f47e`; review hardening and current
  result `8de0d3691238ae6c954e642c053e519fab6fb182`.
- Independent review: PASS at handoff commit
  `acda63a11122e2f11cff42690ff0381bc93f7db9`; synthetic-only boundary,
  strict schemas, artifact bindings, complete aggregates, canonical digest,
  and small-cell suppression verified.
- Remaining risks: real corpus and prices require human/provider verification.
- Handoff decision and receiver: T80/full-stack developer after T04; T80
  remains blocked on the human-owned corpus, privacy, and budget approvals.
