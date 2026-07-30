---
id: S07
feature: F001
slug: controlled-general-availability
status: proposed
acceptance_refs: []
depends_on: [S01, S02, S03, S04, S05, S06]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S07 — Controlled General Availability

## Production-releasable outcome

The exact immutable S06-integrated candidate is independently qualified,
prepared for native-speaker UAT, and promoted only through approved internal,
canary, human acceptance, and separate operational release gates.

## Included scope and exclusions

- Included: final traceability, approved numeric gates, dependency/security/
  privacy review, production-like load/soak/resilience/cost evidence, immutable
  artifact/config identity, UAT preparation, canary/pause/kill switch, rollback
  drill, runbooks, monitoring, and signed gate records.
- Excluded: new product code, schema, prompt, model, voice, provider policy, or
  behavior; agent-simulated UAT; implicit production permission; unreviewed
  deployment.

Any material change returns to its owning stage and a new `T90`.

## Requirements and acceptance criteria

Requirements: `F001-R16`–`R20`, with full F001 regression. Planned primary
acceptance: `F001-AC11`, `AC23`, and `AC24`, activated only with task and
permanent-QA coverage. S07 consolidates rather than substitutes for earlier
independent T90 and human-authority obligations.

## Architecture and data

No new domain data or architecture. Freeze commit, image/artifact digests,
migrations, provider project/region/quota, model/prompt/policy, voice/settings,
flags, evaluation set/method, price catalog, dashboards, and runbooks. Evidence
references approved, redacted artifacts only.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 final traceability/thresholds | business-analyst | — | feature/release traceability | planned |
| T02 security/privacy assessment | security-privacy-human | — | reviewed assessment/evidence | planned |
| T03 performance/resilience evidence | full-stack-developer | — | test/load evidence only | planned |
| T04 UAT preparation | uat-coordinator | T01 | UAT instructions/blank decisions | planned |
| T05 release/canary preparation | project-manager | T01–T03 | runbooks/release evidence | planned |
| T80 candidate consolidation | project-manager | T01–T05 | stage status/evidence indexes | planned |
| T90 independent final QA | qa-engineer | T80 | QA and gate paths only | draft |

After T90, UAT and release are gate activities. Only `user-client` may accept
and permit production. A separate named release owner gives operational go/no-
go and records deployment result.

## Security, privacy, and abuse

Require zero unresolved critical/high security issues, approved privacy/data-
use/retention decisions, verified authorization and deletion, key compromise
runbook, dependency review, safe limits, and signed human authority records.

## Quality, latency, reliability, and cost budgets

Apply the approved S02 method and human-approved Sinhala/English/code-switch,
entity, accessibility, latency, success, capacity, resilience, and cost gates
to the exact candidate. Skipped required coverage blocks QA.

## Observability and operations

Verify production-like dashboards, alerts, quota/spend controls, incident and
deletion runbooks, SLO/on-call ownership, artifact/config drift detection,
canary triggers, and rollback evidence.

## Configuration, migration, deployment, and rollback

Restore-test backup and migration; run internal pilot, constrained canary, pause
and rollback drills. Rollback stops new costly calls, drains/cancels safely,
reverts approved route/config/binary, preserves deletion/audit, and uses
text-only or complete F001 disablement before schema rollback.

## Independent QA

Final task: `T90`. QA freezes the candidate and executes the complete
functional, bilingual, accessibility, security, privacy, resilience,
performance, cost, migration, and rollback matrix. QA can advance only to
`qa-passed`.

## UAT scenarios

Prepare the human-approved subset of feature UAT 1–22, including native-speaker
conversation quality, corpus governance, and controlled canary/rollback.

## Risks and exit criteria

Risks are evidence/artifact drift, quota/region mismatch, cost shock, hidden
vulnerabilities, gate bypass, and unrehearsed rollback. Exit to `qa-passed`
requires passing T90 for the exact candidate. `accepted`,
`release-authorized`, and `released` separately require valid signed human
decisions and post-deployment verification.
