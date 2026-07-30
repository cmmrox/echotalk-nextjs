# Delivery Artifact Contracts

## Stable identifiers

- Feature: `FNNN`, for example `F001`.
- Requirement: `FNNN-RNN`.
- Acceptance criterion: `FNNN-ACNN`.
- Stage: repository-wide `SNN`; stage IDs are never reused across features.
- Task: `TNN` within a stage; reserve `T90` for final stage QA.
- QA case: `TC-FNNN-NNN`.
- Architecture decision: `ADR-NNNN`.

Folder names use `<ID>-<lowercase-hyphen-slug>`. IDs, frontmatter, filenames,
titles, parent references, and indexes must agree.

Allocate IDs through [`id-registry.md`](id-registry.md). A feature can be
drafted before approval; it is the durable intake artifact. No stage or task may
become ready until the named human product owner approves that feature.

## Canonical locations

| Artifact | Location |
|---|---|
| Product/domain/architecture/standards | `docs/` |
| Approved feature | `docs/features/FNNN-slug/feature.md` |
| Feature-specific UX/design specifications | `docs/features/FNNN-slug/ux/` |
| Live feature delivery board | `delivery/features/FNNN-slug/README.md` |
| Stage | `delivery/features/FNNN-slug/stages/SNN-slug/stage.md` |
| Task | `delivery/features/FNNN-slug/stages/SNN-slug/tasks/TNN-slug.md` |
| Stage gates | `delivery/features/FNNN-slug/stages/SNN-slug/gates/` |
| Permanent QA | `qa-automation/features/FNNN-slug/` |
| Local QA execution | `qa-automation/runs/` (ignored) |
| Durable redacted certifying run | stage gate `gates/qa-run.json` |

## Feature contract

Create the feature before planning a stage. Record the problem, users, value,
included/excluded behavior, stable requirements and acceptance criteria,
language slices, accessibility, data classification, privacy/retention,
failure/fallback behavior, NFR budgets, telemetry, UAT scenarios, open
decisions, human product owner, and approval state.

## Stage contract

Define one vertical outcome safe to deploy independently. Record the exact
feature/acceptance subset, dependency and task DAG, feature controls, migration,
security/privacy, observability and budgets, deployment, rollback, mandatory
T90, UAT scenarios, risks, and exit criteria.

## Task contract

Use the frontmatter and sections in
[`templates/task.md`](templates/task.md). The task file is the durable handoff:
chat history alone is not evidence. Completion records exact result commit,
actual files, commands and outcomes, evidence, limitations, residual risks, and
receiving owner. `owner` and `reviewer` identify actual agents or people, not
only roles, and must differ before a task is done.

## QA case and gate contracts

Each acceptance criterion has at least one required permanent QA case and
executable automation, or an evidence-backed non-applicability decision
approved before the stage is ready. Optional cases do not satisfy acceptance
coverage. Requiredness belongs only to the case; stage manifests select cases
and commands without duplicating it. Stage QA records the candidate source and
artifact plus the QA-harness/final-source commit when test-only evidence is
added after the candidate freeze.

The initial stage scaffold may remain `proposed` without a QA matrix while the
acceptance subset is drafted. Before `ready`, permanent cases, automation, and
`qa-automation/features/FNNN-slug/stages/SNN.json` are mandatory.

The clean runner may promote its redacted result to `gates/qa-run.json`; gate
validation recomputes its hash, candidate, manifest-at-commit hash, exact case
set, and result statuses. UAT and release records may remain pending, but must
never contain simulated human approvals. Accepted or later states require
Ed25519-signed JSON decisions verified against
`docs/product/authority-registry.json`.
