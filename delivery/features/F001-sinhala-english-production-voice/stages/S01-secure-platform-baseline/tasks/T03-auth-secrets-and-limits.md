---
id: T03
feature: F001
stage: S01
slug: auth-secrets-and-limits
type: implementation
status: in-review
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: pending-solution-architecture-review
base_sha: ef369889ccf3144b51c94741e7aa4777edc89d18
result_sha: pending
depends_on: [T01]
requirement_refs: [F001-R14, F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC16, F001-AC19, F001-AC20, F001-AC21]
writable_paths: [".env.example", "app/api/**", "components/echo/live-session-panel.tsx", "lib/http/**", "lib/security/**", "lib/limits.ts", "lib/webrtc/fullClientSession.ts", "media-service/sessionCleanup.ts", "media-service/segmentationBuffer.ts", "media-service/resultStore.ts", "media-service/ttsStore.ts", "media-service/metrics.ts", "media-service/peerManager.ts", "qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/session-authorization.test.mjs"]
prohibited_paths: ["docs/product/authority-registry.json", "docs/features/**", "package-lock.json"]
test_commands: ["npm run test:f001:s01:dev", "npm run lint", "npm run typecheck"]
next_owner: project-manager
---

# T03 — Enforce Session Authorization Secrets and Limits

## Outcome

Session capabilities, fail-closed legacy routes, bounded requests/provider work,
safe diagnostics, and deterministic cleanup protect the prototype boundary.
## Included scope and exclusions

- Included: token hashes, bearer propagation, limits, redaction, cleanup.
- Excluded: production user identity, invoice reconciliation, legal approval.

## Development

Return the raw capability once, retain it in browser memory, and store only hash.
## Tests

- Tests added or updated: matching, cross-session, missing, revoked capability.
- Commands and expected outcomes: tests, lint, and typecheck pass.

## Acceptance criteria

Developer evidence for AC19, AC20, AC21; public identity remains a hard gate.
## Security, privacy, and data impact

The capability is restricted; session close revokes it and clears transient data.
## Observability, configuration, and migration

Commit variable names only. No secret value and no migration.
## Rollout and rollback

Legacy routes stay disabled without a server token; retain security fixes.
## Evidence and handoff

- Actual files changed: listed route, client, authorization, and cleanup paths.
- Commands run with pass/fail/blocked/skip: tests/typecheck/lint pass.
- Evidence: no credential or private fixture entered Git.
- Remaining risks: capability does not establish user identity.
- Handoff decision and receiver: architecture review, then T80.
