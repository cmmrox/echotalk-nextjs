---
id: T04
feature: F001
stage: S02
slug: consented-corpus-approval
type: human-decision
status: blocked
owner_role: business-analyst
reviewer_role: project-manager
owner: pending-corpus-steward-human
reviewer: /root
base_sha: 5b0b9ddba2374b0eaa3a828094ddada12f46a1cd
result_sha: pending
depends_on: [T02]
requirement_refs: [F001-R16, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: ["delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/tasks/T04-consented-corpus-approval.md", "evaluation/manifests/approved/**"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/**", "evaluation/data/**", "qa-automation/**"]
test_commands: ["npm run governance:validate"]
next_owner: project-manager
---

# T04 — Obtain Consented Corpus Approval

## Outcome

A named human corpus steward, security/privacy owner, and budget owner approve
the external manifest digest, purpose, access, retention, deletion, disclosure,
sampling, and spend boundaries.

## Included scope and exclusions

- Included: human decisions and a metadata-only approved external-manifest
  digest after authorization.
- Excluded: agent-created consent, raw samples in Git, legal conclusions, or
  implied provider/shadow approval.

## Development

No agent implementation. This task remains blocked until named authorities and
their explicit decisions are recorded.

## Tests

- Tests added or updated: governance verifies named ownership/evidence later.
- Commands and expected outcomes: structural validation only.

## Acceptance criteria

This human gate is mandatory before a real AC18 baseline or T90 certification.

## Security, privacy, and data impact

Restricted data stays outside Git in approved encrypted storage with
least-privilege access and deletion evidence.

## Observability, configuration, and migration

Record opaque manifest digest and policy versions only. External provisioning is
outside this task artifact.

## Rollout and rollback

Revocation disables capture/shadow and triggers governed deletion.

## Evidence and handoff

- Actual files changed: none until human decision.
- Commands run with pass/fail/blocked/skip: blocked.
- Evidence: named authorities and decisions pending.
- Remaining risks: all real-data, provider disclosure, and budget risks.
- Handoff decision and receiver: PM cannot unblock T80/T90 without human proof.
