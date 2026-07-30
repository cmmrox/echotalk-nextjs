---
id: T02
feature: F001
stage: S02
slug: corpus-evaluation-architecture
type: architecture
status: done
owner_role: solution-architect
reviewer_role: full-stack-developer
owner: /root
reviewer: /root/s01_architecture_review
base_sha: 5b0b9ddba2374b0eaa3a828094ddada12f46a1cd
result_sha: 96eeb1d50473315c19effb221551cb5e453e329e
depends_on: [T01]
requirement_refs: [F001-R16, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: ["docs/architecture/decisions/**", "docs/architecture/interfaces/evaluation-contracts.md", "docs/governance/id-registry.md", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/tasks/T02-corpus-evaluation-architecture.md"]
prohibited_paths: ["app/**", "components/**", "media-service/**", "evaluation/data/**", "qa-automation/**"]
test_commands: ["npm run governance:validate"]
next_owner: full-stack-developer
---

# T02 — Define Corpus and Evaluation Architecture

## Outcome

Provider-neutral contracts isolate restricted corpus material, sealed-set
access, aggregate evidence, price provenance, and shadow disclosure controls.

## Included scope and exclusions

- Included: metadata-only manifest schema, artifact references/digests,
  evaluator/report versions, price ledger, default-off shadow control.
- Excluded: storage provisioning, real corpus ingestion, provider disclosure,
  paid calls, sampling approval, and threshold selection.

## Development

Record ADR-0003 through ADR-0005 and an interface document. Product code may
implement only synthetic/offline and fail-closed control paths before the human
gate.

## Tests

- Tests added or updated: governance linkage and contract/schema tests in T03.
- Commands and expected outcomes: `npm run governance:validate` passes.

## Acceptance criteria

Architecture supports AC18 provenance without claiming a baseline.

## Security, privacy, and data impact

Git may hold schemas, fictional synthetic fixtures, hashes, and aggregates only.
Raw audio, personal transcripts, consent records, and sealed samples remain in
future approved restricted storage.

## Observability, configuration, and migration

Content-free telemetry includes route/config/evaluator versions and counters.
No database or object-store migration.

## Rollout and rollback

Shadow/capture are absent or default off. Disablement is the rollback.

## Evidence and handoff

- Actual files changed: ADR, interface, ID registry, task.
- Commands run with pass/fail/blocked/skip: governance passed; independent
  architecture review accepted ADR-0003 through ADR-0005 and the contracts.
- Evidence: explicit data ownership and human-gate boundaries.
- Remaining risks: external storage, legal/privacy, budget, and provider terms.
- Handoff decision and receiver: accepted; T03/T05 may implement only the
  synthetic/default-off scopes.
