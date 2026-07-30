---
id: TC-F001-002
feature: F001
stages: [S01]
acceptance_refs: [F001-AC03, F001-AC04, F001-AC16]
risk: concurrency
priority: required
automation: qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/turn-audio-isolation.test.mjs
command: node --test qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/turn-audio-isolation.test.mjs qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/agent-input.test.mjs
---

# TC-F001-002 — Turn Isolation and Exact History

## Purpose and preconditions

Prove audio is retrieved by session/turn and current text enters model input once.

## Test data and privacy

Synthetic buffers and text.

## Steps

Run exact audio lookup and chronological model-input tests.

## Expected results

No cross-session/turn audio and no duplicate current turn.

## Language, device, and environment slices

Language-neutral structural behavior.

## Evidence and failure handling

Any mismatch blocks S01 T90; concurrency stress remains separately required.
