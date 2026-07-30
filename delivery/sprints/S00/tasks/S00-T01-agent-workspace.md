# S00-T01 — Shared Agent Workspace

- Status: in-review
- Owner: Project Manager / repository maintainer
- Branch: `charithm/s00-agent-workspace`
- Writable paths: `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.codex/`, `.claude/`,
  `delivery/`, `package.json`

## Acceptance criteria

- [x] Canonical project knowledge is under one shared skill.
- [x] Claude consumes root guidance and the shared skill without copied content.
- [x] Seven cross-tool role adapters are deterministically generated.
- [x] Role authority, independent QA, human UAT, and parallel-write rules exist.
- [x] Delivery evidence templates and S00 status are tracked.
- [x] Independent validator and forward-role tests pass before commit; rerun
      validation against the committed candidate during QA.

## Handoff

Record exact validation, review, commit, remaining risks, and next S00 task
before moving this task to `qa-passed`.
