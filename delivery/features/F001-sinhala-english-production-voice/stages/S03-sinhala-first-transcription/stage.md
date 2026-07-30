---
id: S03
feature: F001
slug: sinhala-first-transcription
status: proposed
acceptance_refs: []
depends_on: [S01, S02]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S03 — Sinhala-First Transcription

## Production-releasable outcome

An evaluated Google STT V2 Sinhala/English route produces ordered, provenance-
preserving transcripts with explicit language modes, calibrated uncertainty,
user correction, and safe text fallback behind route/policy flags.

## Included scope and exclusions

- Included: Google `chirp_2` benchmark/adapter, Sinhala/English/Auto,
  adaptation vocabulary, alternatives/confidence, mixed/Romanized policy,
  transcript forms, critical entities, edit/confirm/retry/cancel UX, and
  measured fallback.
- Excluded: unapproved OpenAI STT traffic, universal confidence thresholds,
  silent translation, LLM response promotion, TTS, and production release.

## Requirements and acceptance criteria

Requirements: `F001-R01`–`R07`, `R14`, and `R16`. Planned primary acceptance:
`F001-AC01`, `AC05`, `AC06`, and `AC07`, activated only with task and
permanent-QA coverage. AC04/AC16 are regression obligations from S01.

## Architecture and data

The adapter emits ordered segments/alternatives and exact provider, region,
model, capability, configuration, usage, and cost identity. Policy emits
verbatim/corrected/normalized forms, language spans/mode, protected entities,
decision/reason, and version. Corrections are auditable events. OpenAI STT stays
off unless privacy ADR and evaluation approve it.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 language/correction policy | business-analyst | — | feature language specifications | planned |
| T02 correction UX design | ui-ux-engineer | T01 | feature UX specifications | planned |
| T03 Google STT adapter | full-stack-developer | T01 | new Google STT provider files | planned |
| T04 transcript/language policy | full-stack-developer | T01 | new policy modules/tests | planned |
| T05 accessible client flow | ui-ux-engineer | T02, T04 | assigned Echo UI files | planned |
| T06 OpenAI STT fallback | full-stack-developer | T01 | isolated disabled adapter | conditional |
| T80 recognition integration | full-stack-developer | T03–T06 | shared STT/pipeline/routes/config | planned |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

## Security, privacy, and abuse

Show what will be sent and require confirmation when policy says so. Treat
corrections and protected entities as restricted. Fallback is a provider
disclosure and cannot run without approval, consent basis, redaction, and caps.

## Quality, latency, reliability, and cost budgets

Use S02 thresholds per language/acoustic/entity slice. Compare Google
`chirp_2`, approved configuration, and any fallback on the same sealed set.
Measure correction/clarification, latency, failure, and cost. Normal production
traffic uses one recognizer, not parallel STT.

## Observability and operations

Record route/config/capability, language mode/spans, confidence availability,
policy decision/reason, correction event, fallback, latency, usage, and cost
without raw content in normal telemetry.

## Configuration, migration, deployment, and rollback

Verify target-region/API entitlement; observe the adapter before enforcing
policy. Roll out internal language cohorts. Rollback disables policy enforcement
and OpenAI fallback, restores the last evaluated Google route, or uses text-only
while preserving correction provenance.

## Independent QA

Final task: `T90`. QA covers Sinhala, Sri Lankan English, mixed/code-switched,
Romanized, entities, ordering, correction, uncertainty, failure, latency, cost,
accessibility, and rollback.

## UAT scenarios

Feature UAT 6, 8, 9, and 14: Romanized policy, critical transcript correction,
reject/retry, and Google failure fallback.

## Risks and exit criteria

Risks are region/capability mismatch, incomparable confidence, code-switching,
silent normalization, entity errors, and fallback privacy/cost. Exit requires
human Auto/Romanized/entity/correction decisions, evaluated route, passing T90,
safe fallback, and no silent semantic change.
