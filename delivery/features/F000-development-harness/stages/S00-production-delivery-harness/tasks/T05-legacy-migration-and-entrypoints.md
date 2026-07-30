---
id: T05
feature: F000
stage: S00
slug: legacy-migration-and-entrypoints
type: documentation
status: done
owner_role: project-manager
reviewer_role: business-analyst
owner: /root
reviewer: /root/migration_integrity_review
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: b8e40cee2e193279b173e7aab3be320e48dee858
depends_on: [T01, T02]
requirement_refs: [F000-R01, F000-R06]
acceptance_refs: [F000-AC05]
writable_paths: ["README.md", ".env.example", ".gitignore", "media-service/README.md", "docs/archive/**", "impl-plans/**", "impl-logs/**", "PRD.md", "PROGRESS.md"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/*.ts"]
test_commands: ["npm run docs:validate", "npm run governance:validate"]
next_owner: qa-engineer
---

# T05 — Clean Entrypoints and Preserve Legacy Provenance

## Outcome

The repository quickstart is accurate, configuration names are documented, and
old PRD/progress/plans/logs live in a clearly non-canonical archive.

## Included scope and exclusions

- Included: root README, `.env.example`, media-service pointer, archive index,
  and non-destructive Markdown moves.
- Excluded: rewriting historical claims or deleting their Git provenance.

## Development

Replace stale Google/OpenAI/Tamil product claims in active entrypoints with
current implementation facts and canonical documentation links. Label legacy
checkpoints as unverified production evidence.

## Tests

- Tests added or updated: active-link and legacy-location checks.
- Commands and expected outcomes: docs and aggregate governance validation pass.

## Acceptance criteria

`F000-AC05`.

## Security, privacy, and data impact

`.env.example` includes names and safe example values only. No credential value
or local path is copied.

## Observability, configuration, and migration

No runtime migration. Existing developers receive a current configuration map.

## Rollout and rollback

Moves retain history and can be reverted. Do not delete content during the
migration.

## Evidence and handoff

- Actual files changed: root README, `.env.example`, media-service pointer, and
  non-destructively moved legacy PRD/progress/plans/logs/S00 artifacts
- Commands run with pass/fail/blocked/skip: docs and aggregate governance validation passed
- Review: `/root/migration_integrity_review` confirmed every migrated title,
  archived body, and active entrypoint retained its intended information
- Evidence: frozen candidate `b8e40cee2e193279b173e7aab3be320e48dee858`
- Remaining risks: external links may reference previous file paths
- Handoff decision and receiver: QA freezes and validates the integrated candidate
