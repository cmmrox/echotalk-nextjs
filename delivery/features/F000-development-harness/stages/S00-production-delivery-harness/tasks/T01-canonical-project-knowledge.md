---
id: T01
feature: F000
stage: S00
slug: canonical-project-knowledge
type: architecture
status: in-review
owner_role: solution-architect
reviewer_role: business-analyst
owner: /root
reviewer: /root/migration_integrity_review
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: pending
depends_on: []
requirement_refs: [F000-R01, F000-R06]
acceptance_refs: [F000-AC01, F000-AC05]
writable_paths: ["docs/**"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run docs:validate"]
next_owner: business-analyst
---

# T01 — Establish Canonical Project Knowledge

## Outcome

Move product, architecture, engineering, bilingual quality, privacy, QA, Git,
operations, and team contracts out of the tool skill into a navigable `docs/`
source of truth.

## Included scope and exclusions

- Included: docs indexes, product/architecture/standards/governance structure,
  current-system truth, target-system direction, ADR-0001, and legacy labeling.
- Excluded: runtime code and new provider/product decisions.

## Development

Relocate existing knowledge without copying it, reconcile stale provider/Tamil
claims, document current limitations, and link each topic from `docs/index.md`.

## Tests

- Tests added or updated: link and canonical-location validation.
- Commands and expected outcomes: `npm run docs:validate` passes with no broken
  local links or project-knowledge files inside the skill.

## Acceptance criteria

`F000-AC01` and the documentation portion of `F000-AC05`.

## Security, privacy, and data impact

Public/internal documentation only. Do not copy secrets, raw audio, transcripts,
or local environment values.

## Observability, configuration, and migration

No runtime effect. Git history plus the legacy archive preserves provenance.

## Rollout and rollback

Roll out as one documentation move. Revert the task commit if consumers cannot
resolve the new canonical paths.

## Evidence and handoff

- Actual files changed: canonical `docs/product/`, `docs/architecture/`,
  `docs/standards/`, `docs/governance/`, and `docs/index.md`
- Commands run with pass/fail/blocked/skip: `npm run docs:validate` passed
- Review: `/root/migration_integrity_review` confirmed canonical links,
  archive title/body preservation, and no migration blocker
- Evidence: result commit pending candidate freeze
- Remaining risks: old external links may continue to reference root legacy files
- Handoff decision and receiver: BA verifies artifact language and traceability
