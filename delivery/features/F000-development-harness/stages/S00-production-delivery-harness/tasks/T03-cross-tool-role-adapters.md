---
id: T03
feature: F000
stage: S00
slug: cross-tool-role-adapters
type: implementation
status: done
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: /root/router_forward_test
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: b8e40cee2e193279b173e7aab3be320e48dee858
depends_on: [T01, T02]
requirement_refs: [F000-R01, F000-R02]
acceptance_refs: [F000-AC01, F000-AC06]
writable_paths: ["AGENTS.md", "CLAUDE.md", ".agents/**", ".codex/**", ".claude/**", "scripts/governance/generate-agent-adapters.mjs"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run agents:generate:check", "npm run agents:validate"]
next_owner: full-stack-developer
---

# T03 — Generate Thin Cross-tool Role Adapters

## Outcome

Codex and Claude use one concise skill plus one neutral role manifest; generated
adapters contain role routes and boundaries but no copied project knowledge.

## Included scope and exclusions

- Included: PM, BA, Architect, Developer, UI/UX, QA, and UAT Coordinator.
- Excluded: a simulated client agent, model pinning, or experimental tool-only
  orchestration as a required dependency.

## Development

Move the manifest and generator outside the skill, route roles to canonical
docs, preserve the Claude skill symlink, and generate deterministic adapters.

## Tests

- Tests added or updated: generation check, symlink validation, adapter
  allowlist/content check, and skill format validation.
- Commands and expected outcomes: both declared commands pass without changes.

## Acceptance criteria

`F000-AC01` and the role separation portion of `F000-AC06`.

## Security, privacy, and data impact

Default modes minimize write authority; every write task still requires an
isolated branch/worktree and declared paths.

## Observability, configuration, and migration

Adapter drift becomes a deterministic validation failure.

## Rollout and rollback

Generate both tool formats in one change. Revert manifest, generator, and
generated outputs together.

## Evidence and handoff

- Actual files changed: thin skill, neutral role manifest, generator, seven
  Codex adapters, seven Claude adapters, and root tool entrypoints
- Commands run with pass/fail/blocked/skip: generation check, workspace
  validation, and official skill validation passed
- Review: `/root/router_forward_test` completed a fresh router scenario and
  confirmed intake, global IDs, UX routing, assignment, and QA timing
- Evidence: frozen candidate `b8e40cee2e193279b173e7aab3be320e48dee858`
- Remaining risks: tool schemas can evolve and require generator updates
- Handoff decision and receiver: Developer wires aggregate governance checks
