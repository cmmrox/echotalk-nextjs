---
id: ADR-0003
status: proposed
feature: F001
stage: S02
---

# ADR-0003 — Evaluation Data Governance and Sealed-Set Isolation

## Context

Real audio, transcripts, consent, and annotations are restricted. Reproducible
evaluation needs version identity without exposing sealed content.

## Decision

Separate Git-safe configuration, restricted corpus storage, a separately
authorized sealed-test enclave, and content-free aggregate evidence. Git holds
schemas, fictional fixtures, policy versions, and approved external manifest
digests only. Real artifacts require encryption, least privilege, expiry,
audited access, revocation/deletion propagation, and a named custodian.

## Consequences

Developers cannot enumerate or tune against the test set. Runners receive
ephemeral read-only access and publish aggregates subject to approved
small-cell suppression. S02 cannot be ready until the human policy is recorded.

## Rollback

Revoke access, disable evaluation/capture/shadow, and execute the approved
deletion workflow. Consent revocation and deleted content are never rolled back.
