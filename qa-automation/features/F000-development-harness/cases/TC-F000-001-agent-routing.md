---
id: TC-F000-001
feature: F000
stages: [S00]
acceptance_refs: [F000-AC01, F000-AC02, F000-AC06]
risk: governance
priority: required
automation: qa-automation/features/F000-development-harness/governance/agent-workspace.test.mjs
command: node --test qa-automation/features/F000-development-harness/governance/agent-workspace.test.mjs
---

# TC-F000-001 — Agent Routing and Authority Boundaries

## Purpose and preconditions

Verify one thin skill, a valid Claude symlink, deterministic Codex/Claude
adapters, and the absence of a client-signing agent.

## Test data and privacy

Repository files plus a synthetic temporary corrupted adapter. No secrets.

## Steps

Run the agent-workspace Node test. It first validates the real workspace, then
copies the relevant harness to a temporary directory, corrupts one generated
adapter, and proves the validator rejects it.

## Expected results

The current workspace passes. Stale adapter content fails with an actionable
message. No human-client agent exists.

## Language, device, and environment slices

Not language/device dependent; supported Node.js CI and local environments.

## Evidence and failure handling

T90 records command status and output hash. Any failure blocks S00.
