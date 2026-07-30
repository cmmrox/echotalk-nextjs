---
id: ADR-0003
status: accepted
date: 2026-07-30
owners: [/root]
feature_refs: [F001]
stage_refs: [S02]
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

## Options considered

| Option | Quality | Latency | Cost | Privacy/security | Operations |
|---|---|---|---|---|---|
| Store evaluation content in Git | Easy inspection | Fast | Low | Unacceptable leakage | Irreversible history |
| Give developers full external-store access | Easy tuning | Fast | Medium | Sealed-set compromise | Weak separation |
| Restricted store plus sealed enclave | Representative and controlled | Runner overhead | Managed | Least privilege | Requires custodian |

## Consequences

- Benefits: immutable splits, content-free Git evidence, controlled deletion.
- Tradeoffs and residual risks: external storage and human custody are required.
- Migration/compatibility: synthetic fixtures remain Git-safe; real data never migrates into Git.
- Observability: access/deletion audit remains restricted; Git receives versions and signed aggregate receipts.

## Validation and rollback

- Evidence required: human-approved policy, ACL/expiry/deletion tests, sealed
  access proof, digest binding, and independent T90.
- Rollout: synthetic schemas first; real enclave only after T04.
- Rollback or migration path: revoke access and execute approved source/derived deletion.
- Rollback/reversal trigger: consent/access ambiguity, leakage, expired data, or split exposure.
