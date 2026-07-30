---
id: TC-F000-005
feature: F000
stages: [S00]
acceptance_refs: [F000-AC06]
risk: human-authority-spoofing
priority: required
automation: qa-automation/features/F000-development-harness/governance/crypto-evidence.test.mjs
command: node --test qa-automation/features/F000-development-harness/governance/crypto-evidence.test.mjs
---

# Canonical Authority-Key and Signature Verification

## Preconditions

Use generated, synthetic Ed25519 keypairs only. No human or production private
key may enter the test.

## Steps

1. Export one public key with harmless PEM whitespace variants.
2. Compare canonical fingerprints for that key and a distinct key.
3. Sign an exact JSON byte sequence.
4. Verify the signature with the intended key, its formatting variant, the
   wrong key, and modified record bytes.

## Expected results

Formatting variants of the same Ed25519 key have one fingerprint, distinct keys
have different fingerprints, and only the exact signed bytes verify with the
intended key.

## Evidence policy

Record only synthetic test results. Never store generated private keys.
