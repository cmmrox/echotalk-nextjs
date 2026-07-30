---
id: T04
feature: F000
stage: S00
slug: governance-automation-and-ci
type: implementation
status: done
owner_role: full-stack-developer
reviewer_role: qa-engineer
owner: /root
reviewer: /root/harness_adversarial_review
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: b8e40cee2e193279b173e7aab3be320e48dee858
depends_on: [T02, T03]
requirement_refs: [F000-R04, F000-R05]
acceptance_refs: [F000-AC02, F000-AC03, F000-AC04, F000-AC06]
writable_paths: ["scripts/**", "qa-automation/**", ".github/**", "package.json", ".gitignore"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**"]
test_commands: ["npm run governance:validate", "npm run test:governance", "npm run qa:stage -- F000 S00"]
next_owner: project-manager
---

# T04 — Implement Governance Automation and CI

## Outcome

Offline scripts scaffold valid artifacts, reject governance drift, run the F000
stage matrix, and expose the same controls to CI.

## Included scope and exclusions

- Included: agent/docs/delivery/traceability/QA/release validators, scaffold
  commands, stage QA runner, tests, and GitHub Actions.
- Excluded: application behavior tests and live provider calls.

## Development

Use the Node.js standard library so governance has no extra production
dependency. Fail closed with actionable messages and never write tracked
evidence during validation.

## Tests

- Tests added or updated: unit/fixture tests for success and intentional
  corruption, plus the permanent F000 matrix.
- Commands and expected outcomes: all frontmatter commands pass; intentional
  negative fixtures fail inside tests without changing the repository.

## Acceptance criteria

`F000-AC02`, `F000-AC03`, `F000-AC04`, and validator enforcement for
`F000-AC06`.

## Security, privacy, and data impact

Runner output contains commands, exit results, hashes, and timestamps only.
Local run files are ignored.

## Observability, configuration, and migration

CI exposes separate governance, lint/typecheck, and build results. No migration.

## Rollout and rollback

Enable CI with the harness change. Roll back scripts and package commands as one
unit if they block valid artifacts.

## Evidence and handoff

- Actual files changed: governance/scaffold/stage-runner scripts, F000 QA cases
  and tests, package commands, ignore policy, and pinned GitHub Actions workflow
- Commands run with pass/fail/blocked/skip: aggregate governance, ten
  governance regression tests passed; dirty-worktree stage precheck completed
  non-certifying and now returns its required distinct status `2`
- Review: `/root/harness_adversarial_review` reproduced and closed authority
  spoofing, fabricated hashes, empty/downgraded QA, dependency/role drift,
  post-check mutation, and dirty certification
- Evidence: frozen candidate `b8e40cee2e193279b173e7aab3be320e48dee858`;
  local run remains ignored
- Remaining risks: later features need additional runtime QA tools
- Handoff decision and receiver: PM completes entrypoint and legacy migration
