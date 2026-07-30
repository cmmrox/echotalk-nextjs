---
id: TC-F001-001
feature: F001
stages: [S01]
acceptance_refs: [F001-AC02]
risk: correctness
priority: required
automation: qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/recognition-assembly.test.mjs
command: node --test qa-automation/features/F001-sinhala-english-production-voice/secure-baseline/recognition-assembly.test.mjs
---

# TC-F001-001 — Complete Recognition Assembly

## Purpose and preconditions

Prove all non-empty final provider results appear once and in order.

## Test data and privacy

Synthetic Sinhala and English text only.

## Steps

Run the deterministic multi-result assembly cases.

## Expected results

No result is missing, duplicated, or reordered; absent confidence stays null.

## Language, device, and environment slices

Sinhala Unicode and English; runtime-independent.

## Evidence and failure handling

Any mismatch blocks S01 T90.
