---
id: S00
feature: F000
slug: production-delivery-harness
status: qa-passed
acceptance_refs: [F000-AC01, F000-AC02, F000-AC03, F000-AC04, F000-AC05, F000-AC06]
depends_on: []
final_qa_task: T90
candidate_sha: b8e40cee2e193279b173e7aab3be320e48dee858
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F000 / S00 — Production Delivery Harness

## Production-releasable outcome

A clean, deterministic repository harness supports the complete
feature-to-release lifecycle in Codex and Claude without changing runtime voice
behavior.

## Included scope and exclusions

- Included: canonical documentation, artifact contracts, generated role
  adapters, scaffolding, validators, F000 QA, CI, clean quickstart, and legacy
  migration.
- Excluded: voice runtime changes, provider promotion, production deployment,
  human UAT decision, and production authorization.

## Requirements and acceptance criteria

All `F000-R01` through `F000-R06` and `F000-AC01` through `F000-AC06`.

## Architecture and data

Implements [ADR-0001](../../../../../docs/architecture/decisions/ADR-0001-shared-delivery-harness.md).
No production/user data is introduced.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| [T01](tasks/T01-canonical-project-knowledge.md) | solution-architect | — | `docs/**` | done |
| [T02](tasks/T02-delivery-artifact-contracts.md) | business-analyst | T01 | `docs/governance/**`, `delivery/**` | done |
| [T03](tasks/T03-cross-tool-role-adapters.md) | full-stack-developer | T01, T02 | agent/tool adapters | done |
| [T04](tasks/T04-governance-automation-and-ci.md) | full-stack-developer | T02, T03 | scripts, QA automation, CI, package scripts | done |
| [T05](tasks/T05-legacy-migration-and-entrypoints.md) | project-manager | T01, T02 | archive and entrypoints | done |
| [T06](tasks/T06-ci-baseline-remediation.md) | full-stack-developer | T04 | lint baseline only | done |
| [T90](tasks/T90-stage-qa-automation-and-execution.md) | qa-engineer | T01–T06 | permanent QA and gate evidence only | done |

## Security, privacy, and abuse

No external calls or credentials are needed. Validators prevent secret/private
fixture locations from being treated as durable evidence. Local QA output is
ignored.

## Quality, latency, reliability, and cost budgets

Governance and F000 QA must be deterministic, offline, and complete within a
normal local/CI commit check.

## Observability and operations

Commands report file-level errors and return non-zero on failure. CI runs the
same aggregate governance command as local development.

## Configuration, migration, deployment, and rollback

No application migration or deployment. Legacy Markdown is moved without
content loss. Rollback is a Git revert of the harness commit.

## Independent QA

Final task: `T90`. QA freezes and verifies the exact candidate, runs the F000
permanent matrix, and does not modify product or harness implementation while
certifying it.

## UAT scenarios

Use the four scenarios in the approved F000 feature. The human client decision
must remain pending until explicitly supplied.

## Risks and exit criteria

The harness may reach `qa-passed` after independent verification. It cannot
reach `accepted`, `release-authorized`, or `released` without the corresponding
human decisions and evidence.
