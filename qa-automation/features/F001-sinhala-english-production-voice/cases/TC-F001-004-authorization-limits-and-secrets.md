---
id: TC-F001-004
feature: F001
stages: [S01]
acceptance_refs: [F001-AC16, F001-AC20, F001-AC21]
risk: security
priority: required
automation: qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/security-boundaries.test.mjs
command: node --import ./qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/alias-register.mjs --test qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/session-authorization.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/security-boundaries.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/feature-flag.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/session-work.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/security-dynamic.qa.mjs
---

# TC-F001-004 — Authorization Limits and Secret Boundaries

## Purpose and preconditions

Verify media routes require matching capabilities, legacy routes fail closed,
payloads and provider spend are bounded, secrets remain absent, the kill switch
works dynamically, and cleanup tombstones remain bounded.

## Test data and privacy

Generated ephemeral tokens and source structure; no credential values.

## Steps

Run capability lifecycle, live route, streaming-bound, spend-cap, feature
disable/rollback, cleanup/tombstone, and redacted secret/log checks.

## Expected results

Cross-session, missing, and revoked credentials fail; all resource routes guard;
oversized work and excess spend stop before provider work; disabling F001 aborts
active session work while still permitting authenticated cleanup.

## Language, device, and environment slices

Server boundary; browser bearer propagation is integration coverage.

## Evidence and failure handling

Any unauthorized access or unguarded route blocks S01 T90.
