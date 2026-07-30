---
id: TC-F001-004
feature: F001
stages: [S01]
acceptance_refs: [F001-AC16, F001-AC20, F001-AC21]
risk: security
priority: required
automation: qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/security-boundaries.test.mjs
command: node --test qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/session-authorization.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/security-boundaries.test.mjs
---

# TC-F001-004 — Authorization Limits and Secret Boundaries

## Purpose and preconditions

Verify media routes require matching capabilities, legacy routes fail closed,
and empty speech gates costly work.

## Test data and privacy

Generated ephemeral tokens and source structure; no credential values.

## Steps

Run capability lifecycle and boundary-enforcement tests, then secret/log scans.

## Expected results

Cross-session, missing, and revoked credentials fail; all resource routes guard.

## Language, device, and environment slices

Server boundary; browser bearer propagation is integration coverage.

## Evidence and failure handling

Any unauthorized access or unguarded route blocks S01 T90.
