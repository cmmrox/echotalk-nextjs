---
id: T90
feature: F000
stage: S00
slug: stage-qa-automation-and-execution
type: stage-qa
status: done
owner_role: qa-engineer
reviewer_role: project-manager
owner: /root/f000_recertification_qa
reviewer: /root
base_sha: b8e40cee2e193279b173e7aab3be320e48dee858
result_sha: 584c6f29406013153cfd186b3e766ba84cfd4ad1
depends_on: [T01, T02, T03, T04, T05, T06]
requirement_refs: [F000-R01, F000-R02, F000-R03, F000-R04, F000-R05, F000-R06]
acceptance_refs: [F000-AC01, F000-AC02, F000-AC03, F000-AC04, F000-AC05, F000-AC06]
writable_paths: ["qa-automation/features/F000-development-harness/**", "qa-automation/runs/**", "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/qa-report.md", "delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/qa-run.json"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**", "scripts/governance/**", ".agents/**", ".codex/**", ".claude/**"]
test_commands: ["npm run governance:validate", "npm run test:governance", "npm run qa:stage -- F000 S00", "npm run lint", "npm run typecheck", "npm run build"]
next_owner: uat-coordinator
---

# T90 — Independent Stage QA Automation and Execution

## Outcome

Independently verify all F000 acceptance criteria against an exact frozen
candidate and provide the only QA recommendation for S00.

## Included scope and exclusions

- Included: permanent F000 case/automation review, full applicable command
  matrix, negative-fixture behavior, candidate integrity, results, defects, and
  residual risk.
- Excluded: fixing product/harness implementation, human UAT, production
  permission, or release-owner approval.

## Development

QA may create or correct permanent QA cases and QA-only automation. If a defect
requires implementation changes, return it to the responsible task, freeze a
new candidate, and rerun affected and regression checks.

## Tests

- Tests added or updated: F000 permanent acceptance/regression automation.
- Commands and expected outcomes: every declared command is recorded as pass,
  fail, blocked, or skip; required failures/skips block `qa-passed`.

## Acceptance criteria

All `F000-AC01` through `F000-AC06`.

## Security, privacy, and data impact

Use synthetic repository fixtures only. Do not access or record secrets,
provider credentials, private audio, or personal transcripts.

## Observability, configuration, and migration

Record candidate, QA-harness/final source, Node/npm, operating environment, and
command results. No application migration.

## Rollout and rollback

This task does not deploy. A material candidate change invalidates the verdict.

## Evidence and handoff

- Actual files changed: QA automation, redacted certifying run, and QA report only
- Commands run with pass/fail/blocked/skip: `npm run ci:verify`;
  `npm run qa:stage -- F000 S00 --candidate
  b8e40cee2e193279b173e7aab3be320e48dee858 --promote-evidence --qa-owner
  /root/f000_recertification_qa`; post-report `npm run governance:validate`;
  candidate/evidence diff validation — all passed
- Evidence: five required cases passed in `gates/qa-report.md` and the promoted
  `gates/qa-run.json`; evidence commit
  `584c6f29406013153cfd186b3e766ba84cfd4ad1`
- Remaining risks: the local `/root/<agent>` identity is structural; protected
  branch review/CI or orchestrator attestation remains an external release gate
- Handoff decision and receiver: QA recommends S00 for human client UAT;
  UAT Coordinator receives the `qa-passed` stage
