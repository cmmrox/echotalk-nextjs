---
id: S04
feature: F001
slug: bilingual-conversation-intelligence
status: proposed
acceptance_refs: []
depends_on: [S03]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S04 — Bilingual Conversation Intelligence

## Production-releasable outcome

OpenAI produces structured, natural Sinhala/English replies from the accepted
transcript and exact chronological context, with protected entities,
clarification, idempotency, versioning, cost routing, and safe retry.

## Included scope and exclusions

- Included: structured display/TTS response contract, current turn exactly
  once, permitted history, language intent, protected entities, prompt/model/
  policy versions, uncertainty, streaming/cancellation, usage/cost, small
  default route, and bounded escalation.
- Excluded: tool actions, unbounded memory, retraining, silent transcript
  reinterpretation, TTS synthesis, and production release.

## Requirements and acceptance criteria

Requirements: `F001-R06`, `R08`–`R10`, `R14`, and `R18`. Planned primary
acceptance: `F001-AC08` and `AC10`, activated only with task and permanent-QA
coverage. S04 supplies response evidence for AC11 and preserves S01 idempotency.

## Architecture and data

The canonical accepted turn is supplied once. Structured output includes
display text, TTS text, reply-language mode, uncertainty, protected-entity
evidence, and usage with prompt/model/policy and permitted-history provenance.
Transcript/history are untrusted input. ADRs define routing, timeout
reconciliation, context limits, safety/tool boundaries, and rollback.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 bilingual behavior examples | business-analyst | — | feature response specifications | planned |
| T02 OpenAI contract/routing ADR | solution-architect | T01 | assigned architecture files | planned |
| T03 OpenAI orchestration | full-stack-developer | T02 | assigned agent/provider files | planned |
| T04 evaluated routing/recovery | full-stack-developer | T02, T03 | dedicated routing/prompt-policy files | planned |
| T80 conversation integration | full-stack-developer | T03, T04 | shared routes/state/config | planned |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

## Security, privacy, and abuse

Apply least-context disclosure, prompt-injection defenses, structured-output
validation, server-side credentials, content-free logs, rate/spend limits, and
no consequential tool execution from unconfirmed voice input.

## Quality, latency, reliability, and cost budgets

Use S02 native-speaker and entity-preservation thresholds. Select the
lowest-cost route that passes; escalate only evaluated uncertain/complex turns.
Measure first-token/full-text latency, malformed output, retries, tokens,
successful-turn cost, and duplicate billing.

## Observability and operations

Record route, model/prompt/policy versions, allowed-history count, structured
validation, uncertainty, fallback, timing, tokens, estimated/invoiced cost
identity, and idempotency without conversation content.

## Configuration, migration, deployment, and rollback

Evaluate offline/consented, then enable an internal model-route flag. Preserve a
previous approved model/prompt/policy combination. Rollback changes routing
without rewriting historical turns; ambiguous timeout produces explicit retry,
not another assistant turn.

## Independent QA

Final task: `T90`. QA covers chronology, duplicates, protected meaning,
Sinhala/English/mixed response quality, clarification, prompt injection,
malformed output, timeout/retry, latency, cost, and regression.

## UAT scenarios

Feature UAT 1–5, 7, and 15: Sinhala, English, switching, entities/negation, and
OpenAI failure without duplicate turns.

## Risks and exit criteria

Risks are prompt injection, malformed output, Romanized/mixed drift, entity
mutation, context disclosure/growth, ambiguous timeout, and model drift. Exit
requires approved quality/cost gates, validated structured behavior, passing
T90, and reversible model/prompt/policy selection.
