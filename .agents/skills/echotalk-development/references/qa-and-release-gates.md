# QA and Release Gates

## Independent evidence

QA verifies the integrated commit and environment independently from the
developer. A failure remains failed until fixed and rerun. A skip is recorded
with reason, risk, owner, and completion date; it is never reported as passed.
A skipped required test blocks `qa-passed`. The QA owner may classify a test as
non-applicable only with requirement/architecture evidence; schedule or cost is
not non-applicability.

## Minimum sprint test matrix

- Requirement and acceptance-criterion traceability.
- Unit, contract, integration, end-to-end, and regression checks proportional
  to the change.
- Sinhala, English, and code-switch slices affected by the change.
- Accessibility: keyboard, focus, labels, text parity, contrast, reduced motion.
- Security/privacy and abuse cases for changed trust boundaries.
- Performance, latency, resilience, and cost budget where applicable.
- Supported browsers/devices and weak-network behavior.
- Deployment, migration, configuration, observability, and rollback rehearsal.

## Release gates

`qa-passed` requires:

- exact candidate commit/image identity;
- all acceptance criteria evidenced;
- required automated checks green;
- manual and live-provider results recorded;
- no unresolved critical/high security issue;
- no unapproved privacy/retention change;
- metrics, alerts, runbook, and rollback verified;
- known limitations and residual risks accepted by the correct owner.

`uat-ready` additionally requires a stable production-like environment, seeded
non-sensitive data, client scenarios, bilingual instructions, evidence links,
and issue/escalation process.
Backend/provider changes still require client-visible UAT of transcript meaning,
uncertainty/clarification, correction, latency, fallback, and affected language
scenarios.

`accepted` requires the human client's explicit dated decision against the
candidate identity. Agents may prepare but cannot sign it.

`released` requires explicit production authorization, deployment of the
accepted artifact, migrations/backups as applicable, smoke and feature checks,
monitoring confirmation, and rollback readiness.

## UAT outcomes

Use `accepted`, `accepted-with-conditions`, or `rejected`.
`accepted-with-conditions` is an accepted sub-state only when every condition
states owner, deadline, risk, and whether release is permitted. It never replaces
separate production authorization. Any code, configuration, model, prompt,
provider, migration, or environment change affecting a tested requirement
invalidates acceptance; QA and the UAT coordinator jointly document whether an
evidence-only change is non-material.

The PM verifies the client representative against the project stakeholder
record. Durable approval must identify the person, date, candidate, decision,
conditions, and production-authorization answer in the UAT record or an approved
linked system.

## Risk acceptance

- Product behavior/requirement risk: Product Owner or identified human client.
- Security/privacy risk: designated security/privacy owner; legal questions go
  to qualified counsel.
- Reliability/operations risk: service owner and release owner.
- Budget/cost risk: budget owner.
- QA coverage risk: QA recommends but cannot accept it; the accountable owner
  above decides, and required-test skips still block the gate.
- Production exposure requires two non-substitutable human decisions: the
  identified client gives product acceptance and explicit permission for the
  accepted candidate to enter production; the release owner gives the
  operational go/no-go after verifying controls. Neither can override a missing
  decision from the other.

## Evidence retention

Store durable summaries under `delivery/sprints/<stage>/`. Link large or
sensitive artifacts from approved systems; do not commit secrets, private raw
audio, or personal data.
