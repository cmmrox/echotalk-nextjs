# S00 Sprint Charter — Delivery and Environment Foundation

- Status: in-progress
- Owner: Project Manager
- Production behavior change: none for the workspace-bootstrap task
- Human UAT: required before S00 is accepted

## Objective

Make EchoTalk development reproducible, controlled, testable, and compatible
with both Codex and Claude Code before production feature work expands.

## Sprint scope

- Shared repository instructions and canonical project skill.
- Role contracts and generated adapters for the seven-person virtual team.
- Architecture, Sinhala AI, engineering, privacy, QA, Git, and stage references.
- Durable task, ADR, QA, UAT, and release evidence templates.
- Automated workspace validation.
- Reproducible local setup, CI gates, environment inventory, baseline security
  checks, and a deployable non-production environment in subsequent S00 tasks.

## Out of scope

- Replacing current STT, LLM, TTS, or WebRTC behavior.
- Claiming production Sinhala accuracy before S02 evaluation.
- Production deployment, retention of user audio, or client acceptance by an
  agent.

## Acceptance criteria

- [x] One canonical skill serves Codex and Claude without duplicated knowledge.
- [x] PM, BA, Architect, Developer, UI/UX, QA, and UAT adapters are generated
      from one manifest and point to canonical contracts.
- [x] Human-only UAT acceptance and production authorization are explicit.
- [x] Workspace validation detects missing adapters, broken skill linkage, and
      unfinished skill placeholders.
- [ ] Clean-machine local setup is documented and independently reproduced.
- [ ] CI runs lint, typecheck, tests, build, governance, and security checks.
- [ ] Non-production deployment, observability, rollback, and secret inventory
      are independently verified.
- [ ] QA recommends S00 and the human client completes UAT.

## Risks

- Tool adapter schemas may evolve; adapters are generated and intentionally thin.
- Documentation can drift; validation covers structure, while reviews must
  verify content.
- Production readiness remains blocked until all unchecked criteria are met.

## Exit

S00 exits only with a QA-passed candidate, human UAT decision, and completed
release evidence for the agreed non-production/production exposure.
