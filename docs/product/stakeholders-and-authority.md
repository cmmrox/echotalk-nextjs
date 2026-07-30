# Stakeholders and Authority

The machine-readable authority source of truth is
[`authority-registry.json`](authority-registry.json). This page explains that
registry; stage and gate records must use its stable principal IDs.

## Required human authorities

| Authority | Named person | Decision |
|---|---|---|
| Product owner | `user-client` — the user unless delegated in writing | Approves features and product-risk acceptance. |
| Human client / UAT approver | `user-client` — the user unless delegated in writing | Accepts or rejects a QA-passed candidate and separately permits production. |
| Security and privacy owner | Pending | Accepts eligible residual security/privacy risk. |
| Budget owner | Pending | Approves provider and operating-cost thresholds. |
| Release owner | Pending | Gives operational go/no-go and owns rollback. |

An agent may prepare evidence, questions, scenarios, or records. It may not
invent a human identity, sign UAT, approve legal/commercial risk, permit
production, or replace an operational release owner.

Changing an authority ID or pinned public key is itself a human-reviewed
governance change. Production repositories must protect the default branch and
this registry with required review. Local validators cannot authenticate a
person from a name: accepted UAT and operational release decisions therefore
require signed JSON records verified against the pinned Ed25519 public keys.
The candidate commit freezes the authority registry and public keys used for
that stage; later worktree edits cannot change its trust roots. Until a required
key is configured before candidate freeze, the corresponding gate fails closed.
Public-key handling is documented in
[`authority-keys/`](authority-keys/README.md).

## Decision separation

Production exposure requires all of the following for the same candidate:

1. independent QA recommendation;
2. dated human client UAT acceptance;
3. explicit human client permission to deploy that candidate; and
4. release-owner operational go/no-go.

No one decision substitutes for another.
