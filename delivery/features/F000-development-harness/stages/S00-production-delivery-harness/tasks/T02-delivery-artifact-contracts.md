---
id: T02
feature: F000
stage: S00
slug: delivery-artifact-contracts
type: governance
status: done
owner_role: business-analyst
reviewer_role: solution-architect
owner: /root
reviewer: /root/harness_adversarial_review
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: b8e40cee2e193279b173e7aab3be320e48dee858
depends_on: [T01]
requirement_refs: [F000-R03, F000-R04]
acceptance_refs: [F000-AC03, F000-AC06]
writable_paths: ["docs/governance/**", "docs/features/F000-development-harness/**", "delivery/**"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run delivery:validate", "npm run traceability:validate"]
next_owner: full-stack-developer
---

# T02 — Define Feature, Stage, Task, and Gate Contracts

## Outcome

Create the durable hierarchy, IDs, lifecycle, templates, F000 feature, S00 stage,
separate tasks, and pending QA/UAT/release gates.

## Included scope and exclusions

- Included: artifact contracts, status vocabulary, Definition of Ready,
  dependency/path ownership, T90, and authority separation.
- Excluded: setting QA, client, or release decisions without evidence.

## Development

Create one task file per bounded output and make stage the only release
increment. Preserve human-only acceptance and production authority.

## Tests

- Tests added or updated: delivery schema, ID/dependency, final-T90, and
  traceability validation.
- Commands and expected outcomes: delivery and traceability validators pass.

## Acceptance criteria

`F000-AC03` and `F000-AC06`.

## Security, privacy, and data impact

Artifact metadata only. Gate records must not capture secrets or personal data.

## Observability, configuration, and migration

No runtime configuration. Status transitions become auditable repository state.

## Rollout and rollback

Adopt for F000 first; later product features start from the same templates.
Revert the artifact contract and F000 delivery files together if needed.

## Evidence and handoff

- Actual files changed: F000 feature, ADR-0001, delivery board, S00 stage,
  separate tasks, and gate records
- Commands run with pass/fail/blocked/skip: delivery and traceability validation passed
- Review: `/root/harness_adversarial_review` confirmed authority, evidence,
  lifecycle, and required-QA gates fail closed
- Evidence: frozen candidate `b8e40cee2e193279b173e7aab3be320e48dee858`
- Remaining risks: validators must prevent manually drifted status
- Handoff decision and receiver: Developer implements deterministic automation
