# EchoTalk Repository Instructions

For every planning, architecture, implementation, review, QA, release, or UAT
task, read and follow:

`./.agents/skills/echotalk-development/SKILL.md`

The skill is a router. Canonical project knowledge lives under `docs/`; current
execution state lives under `delivery/`; permanent QA lives under
`qa-automation/`.

## Always

- Preserve unrelated and uncommitted work.
- Obey the assigned task's scope, dependencies, and writable/prohibited paths.
- Keep secrets and private data out of commands, logs, fixtures, evidence, and
  Git.
- Use separate branches/worktrees for parallel writes and do not self-approve.
- Record exact commands, outcomes, commit/artifact identity, risks, rollback,
  and handoff in the task artifact.
- Leave human UAT, production permission, and operational release decisions to
  the named human authorities.

Run `npm run governance:validate` before handing a harness or delivery change to
QA. A nearer `AGENTS.md` may refine these rules but cannot weaken security,
privacy, independent QA, or human-approval gates.
