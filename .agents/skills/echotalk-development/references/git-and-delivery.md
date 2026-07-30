# Git and Delivery

## Branch and review policy

- Keep `main` protected and releasable; use pull requests for changes.
- Create one scoped branch/worktree per task. Default branch form:
  `charithm/<stage>-<short-purpose>`.
- Do not force-push shared branches or rewrite others' commits.
- Assign exclusive writable path patterns before parallel work.
- Fetch and inspect status/divergence before integration. Preserve unrelated
  tracked, untracked, and ignored files.
- Integrate through reviewed commits with required CI and independent QA.

## Commits

Use focused Conventional Commit messages:

```text
<type>(<scope>): <imperative summary>
```

Types include `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `build`, `ci`,
and `chore`. Explain why, behavior/risk, migrations, and verification in the
body when material. Never include secrets or private content.

## Task readiness

A task is `ready` only when it has an owner, requirement/decision references,
scope and exclusions, acceptance criteria, dependencies, writable paths,
test/evidence plan, security/privacy classification, and next handoff.

## Task completion

A task is complete only when implementation/artifacts are reviewed; relevant
checks pass; documentation, migrations, telemetry, runbook, and rollback are
updated; exact commit is identified; remaining risks are explicit; and the next
gate has accepted ownership.

## Handoff protocol

The sender records:

- task/stage, role, base and result commit;
- scope, exclusions, writable paths, and acceptance criteria;
- files/decisions changed;
- commands run with pass/fail/skip;
- privacy/security and migration impact;
- rollout/rollback;
- blockers, known risks, and requested next action.

Use `assets/task-handoff-template.md`. Do not rely on chat history as the only
handoff record.

## Release identity

Release evidence binds the accepted source commit to immutable build artifact,
configuration schema, migrations, environment, deployment time/operator, and
post-deploy results. Roll back by known artifact identity, not “latest”.
