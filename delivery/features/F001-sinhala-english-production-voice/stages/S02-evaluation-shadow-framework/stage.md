---
id: S02
feature: F001
slug: evaluation-shadow-framework
status: proposed
acceptance_refs: []
depends_on: [S01]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S02 — Evaluation and Shadow Framework

## Production-releasable outcome

A versioned, privacy-governed Sinhala/English evaluation and sampled shadow
framework produces reproducible quality, latency, and cost baselines without
promoting a provider route.

## Included scope and exclusions

- Included: consented corpus manifest, annotation guide, slice registry, sealed
  tests, provider fakes, offline runners, scorecards, price catalog, sampled
  shadow instrumentation, safe dashboards, and disable/delete controls.
- Excluded: private raw audio in Git, unrestricted dual-provider traffic,
  provider promotion, invented thresholds, training, UAT, and release.

## Requirements and acceptance criteria

Requirements: `F001-R16`–`R18` and `R20`. Planned primary acceptance:
`F001-AC18`, activated only with task and permanent-QA coverage. S02 also
creates fixtures for AC05 and the frozen method used for AC11.

## Architecture and data

Restricted corpus content is separated from aggregate reports. Its registry
uses opaque sample IDs, consent/version/expiry, slice tags, source hash,
annotation/evaluation version, and ACL. ADRs cover consent, retention/access,
sealed-set isolation, redacted telemetry, pricing, and shadow disclosure.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 evaluation specification | business-analyst | — | evaluation specifications | done |
| T02 corpus/eval architecture | solution-architect | T01 | assigned ADRs/contracts | done |
| T03 runner and price ledger | full-stack-developer | T02 | new evaluation modules/scripts | ready |
| T04 consented manifest | corpus-steward-human | T02 | approved manifests only | blocked |
| T05 sampled shadow telemetry | full-stack-developer | T02 | assigned shadow/telemetry files | ready |
| T80 serialized integration | full-stack-developer | T03–T05 | shared scripts/config/contracts | blocked |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

## Security, privacy, and abuse

Shadowing restricted content is a provider disclosure and defaults off.
Capture requires consent, least privilege, expiry/deletion, and content-free
telemetry. No private sample enters Git or durable gate evidence.

## Quality, latency, reliability, and cost budgets

Report WER/CER, semantic/entity accuracy, annotation agreement, correction and
clarification proxies, latency percentiles, success/failure, and cost per
attempted/successful turn by slice. Humans approve thresholds after baseline.

## Observability and operations

Version corpus splits, annotations, evaluator, provider/config, prompt/policy,
price catalog, and report. Monitor disclosures, spend, runner failure,
sealed-set access, and estimate/invoice drift without content logging.

## Configuration, migration, deployment, and rollback

Offline fixtures come first. Capture/shadow flags remain off until approved.
Rollback disables capture/shadow, stops disclosures, and executes governed
sample deletion while preserving approved aggregate evidence.

## Independent QA

Final task: `T90`. QA reproduces metrics/pricing and verifies corpus controls,
redaction, sealed-set isolation, disable/delete, and budgeted provider fan-out.

## UAT scenarios

Feature UAT 21: an authorized steward verifies consent, de-identification,
slices, sealing, versions, and a safe aggregate report.

## Risks and exit criteria

Risks are leakage, corpus bias, test overfitting, annotation disagreement,
dual-provider spend, and price drift. Exit requires S01 evidence, human
consent/access decisions, reproducible baseline, passing T90, and thresholds
submitted for human approval without provider promotion.
