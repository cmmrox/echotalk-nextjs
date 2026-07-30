---
name: echotalk-development
description: Route EchoTalk repository planning, architecture, implementation, UI/UX, QA, release, and UAT preparation through the canonical feature-stage-task harness. Use for every repository task that evaluates or changes product behavior, infrastructure, provider integrations, project documentation, quality, security, privacy, cost, delivery artifacts, or release evidence.
---

# EchoTalk Development Router

Keep this skill procedural and small. Project knowledge belongs in `docs/`.

## Start

1. Read `AGENTS.md` and `docs/index.md`. Read the assigned task file, or the
   draft feature when performing pre-approval intake.
2. Read the assigned role contract in
   `docs/governance/team-role-contracts.md`.
3. Follow the artifact and lifecycle contracts linked from
   `docs/governance/`.
4. Load only the product, architecture, or standards documents routed by
   `docs/index.md` and needed for the task.
5. Confirm scope, exclusions, dependencies, writable/prohibited paths, tests,
   evidence, and next owner before writing.

## Route work

- New or changed behavior: BA/PM first drafts the feature under `docs/features/`.
  After human approval, use its stage and task under `delivery/features/`.
- Architecture or cross-boundary decisions: use `docs/architecture/` and an
  ADR when required.
- Implementation and review: use `docs/standards/`.
- Independent QA: use `qa-automation/` and the stage's final `T90` task.
- UAT or release preparation: use the stage gate records; leave human decisions
  pending until the named humans supply them.

## Commands

- Generate adapters: `npm run agents:generate`
- Check generated adapters: `npm run agents:generate:check`
- Validate the harness: `npm run governance:validate`
- Scaffold artifacts: `npm run scaffold:feature`, `npm run scaffold:stage`,
  and `npm run scaffold:task`
- Run a stage matrix: `npm run qa:stage -- FNNN SNN`

Return a durable task handoff. Do not use chat history as the source of truth.
