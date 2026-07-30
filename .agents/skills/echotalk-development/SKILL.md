---
name: echotalk-development
description: Govern production planning, architecture, implementation, UI/UX, QA, release, and UAT preparation for the EchoTalk Sinhala-English voice agent. Use for every repository task that changes or evaluates product behavior, infrastructure, provider integrations, privacy, security, cost, bilingual quality, delivery stages, or team handoffs.
---

# EchoTalk Development

Use this skill to deliver EchoTalk through evidence-based, independently
testable increments. Keep durable knowledge in the referenced files; keep
Codex and Claude adapters thin.

## Start every task

1. Inspect repository status, current implementation, and applicable local
   instructions before proposing changes.
2. Identify the task role and read its contract in
   `references/team-role-contracts.md`.
3. Read `references/product-and-domain.md` and only the additional references
   selected below.
4. Establish a task ID, scope, exclusions, acceptance criteria, writable file
   patterns, tests, and intended handoff. Use
   `assets/task-handoff-template.md` for multi-agent work.
5. Preserve unrelated changes and secrets. Stop if the requested action needs
   authority that the user has not granted.

## Route to the minimum references

- Requirements, user value, languages, or acceptance criteria:
  `references/product-and-domain.md`
- System boundaries, interfaces, data flow, scaling, or ADRs:
  `references/target-architecture.md`
- Sinhala/English STT, LLM, TTS, evaluation, or language policy:
  `references/sinhala-ai-standards.md`
- Code, APIs, data, observability, cost, reliability, or operations:
  `references/engineering-standards.md`
- Threats, consent, retention, secrets, abuse, or compliance:
  `references/security-and-privacy.md`
- Test strategy, quality gates, release evidence, or UAT:
  `references/qa-and-release-gates.md`
- Branches, commits, reviews, handoffs, and delivery state:
  `references/git-and-delivery.md`
- Role authority, collaboration, delegation, or conflict resolution:
  `references/team-role-contracts.md`
- Sprint sequencing, dependencies, parallel tracks, or exit criteria:
  `references/stage-roadmap.md`

## Delivery workflow

1. Move work through `proposed -> ready -> in-progress -> in-review ->
   qa-passed -> uat-ready -> accepted -> released`.
2. The PM coordinates status through `uat-ready`. Only the human client may
   set `accepted`; release requires recorded production authorization and
   post-deployment verification.
3. Use isolated branches or worktrees for parallel implementation. Assign
   exclusive writable paths and avoid concurrent edits to shared files.
4. A builder may not certify the same change. QA independently verifies the
   integrated commit. The UAT coordinator prepares evidence but never signs
   for the client.
5. Record completed commands, results, commit SHA, risks, rollback, and next
   owner. Never report skipped checks as passes.

## Artifact rules

- Copy templates from `assets/` into the relevant `delivery/` location; do not
  edit templates to represent one sprint.
- Store ADRs in `delivery/decisions/` and sprint evidence under
  `delivery/sprints/<stage>/`.
- Update stable knowledge in one canonical reference, then regenerate adapters
  with `node .agents/skills/echotalk-development/scripts/generate-agent-adapters.mjs`.
- Validate the environment with
  `node .agents/skills/echotalk-development/scripts/validate-agent-workspace.mjs`.

## Completion

Finish only when acceptance criteria are evidenced, relevant automated and
manual checks are recorded, security/privacy impact is assessed, documentation
is current, and the next gate has an explicit owner. A sprint is not production
ready merely because its code builds.
