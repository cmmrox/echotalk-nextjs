---
id: ADR-0001
status: accepted
date: 2026-07-30
owners: [solution-architect]
feature_refs: [F000]
stage_refs: [S00]
---

# ADR-0001 — Shared Feature-Stage-Task Delivery Harness

## Context

The repository had useful project rules embedded in a shared skill, flat S00
files, and historical “stage done” claims without production QA/UAT semantics.
Codex and Claude adapters existed, but delivery and traceability were not
machine-enforced.

## Decision

Use one hierarchy: Feature → Stage → Task. A stage is the sole release increment and must be a
production-releasable vertical increment. Store project truth under `docs/`,
live work under `delivery/`, permanent QA under `qa-automation/`, and local runs
under ignored `qa-automation/runs/`.

Keep `.agents/skills/echotalk-development/SKILL.md` as a thin router. Generate
Codex and Claude role adapters from `.agents/roles/manifest.json`. Every stage
ends with a final `T90` independent QA task. Human UAT, client production
permission, and operational release approval remain separate.

## Options considered

| Option | Result |
|---|---|
| Copy GenOne literally | Rejected: no task layer, drifted statuses, and browser-centric QA gaps. |
| Keep all project rules in the skill | Rejected: duplicates canonical project knowledge and increases cross-tool drift. |
| Add a second iteration layer below stage | Rejected: stage is already the release increment. |
| Shared manifest plus generated adapters | Accepted: portable and deterministic across Codex and Claude. |

## Consequences

- Agent prompts remain small and durable knowledge is reviewable as project code.
- More artifact fields are required before work can be marked ready.
- Validators and CI become part of the release control surface.
- Historical plans stay available but no longer represent active status.

## Validation and rollback

- Validation: F000 permanent QA cases and `npm run governance:validate`.
- Rollback: revert the F000 harness commits; legacy material remains preserved
  in Git history and the archive.
