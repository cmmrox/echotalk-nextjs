---
id: T01
feature: F001
stage: S02
slug: evaluation-specification
type: analysis
status: in-review
owner_role: business-analyst
reviewer_role: project-manager
owner: /root
reviewer: /root/s01_architecture_review
base_sha: 5b0b9ddba2374b0eaa3a828094ddada12f46a1cd
result_sha: pending
depends_on: []
requirement_refs: [F001-R16, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: ["docs/features/F001-sinhala-english-production-voice/evaluation-specification.md", "docs/standards/evaluation-annotation-guide.md", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/tasks/T01-evaluation-specification.md"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**", "evaluation/data/**", "qa-automation/**"]
test_commands: ["npm run governance:validate"]
next_owner: solution-architect
---

# T01 — Define Evaluation Specification

## Outcome

A traceable metric, slice, provenance, privacy, and reporting specification
defines what the S02 framework may measure without inventing quality thresholds.

## Included scope and exclusions

- Included: WER/CER, semantic/entity, latency, success and cost definitions;
  required slices; annotation rules; version and aggregate-report fields.
- Excluded: real samples, approved thresholds, live providers, consent or legal
  approval, and production route promotion.

## Development

Specify synthetic development fixtures separately from human/sealed evaluation
sets. Mark every human-data and commercial decision as externally owned.

## Tests

- Tests added or updated: governance and documentation traceability.
- Commands and expected outcomes: `npm run governance:validate` passes.

## Acceptance criteria

Defines the reproducible method needed for AC18; it does not satisfy AC18
without an approved corpus, baseline, and independent T90.

## Security, privacy, and data impact

No restricted content is created. Synthetic examples must be fictional and
must not resemble a real speaker or conversation.

## Observability, configuration, and migration

Version evaluator, annotation policy, slices, price catalog, provider route, and
report schema. No migration.

## Rollout and rollback

Documentation only. Rollback removes the draft method without changing runtime.

## Evidence and handoff

- Actual files changed: evaluation specification, annotation guide, task.
- Commands run with pass/fail/blocked/skip: pending final planning verification.
- Evidence: S02 method bound to F001-R16–R18/R20 and AC18.
- Remaining risks: human corpus, privacy, budget, thresholds, and QA pending.
- Handoff decision and receiver: solution architect reviews before T02 closes.
