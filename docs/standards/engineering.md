# EchoTalk Engineering Standards

## Implementation

- Prefer small vertical increments and explicit interfaces.
- Validate input at every trust boundary and return typed, non-sensitive errors.
- Keep business policy separate from provider SDK calls.
- Make state transitions and externally retried operations idempotent.
- Add timeouts, cancellation, bounded retries, and resource limits.
- Do not log audio, full transcripts, credentials, tokens, or model prompts by
  default. Use stable IDs and redacted structured fields.
- Keep configuration environment-specific and fail closed on missing production
  secrets. Commit names and examples, never values.

## API and data

- Version externally consumed contracts and document compatibility.
- Use request/session/turn/trace IDs across services.
- Define ownership, retention, classification, and migration/rollback for every
  persisted field.
- Use additive, backward-compatible migrations before destructive cleanup.
- Enforce tenant/user authorization in server-side data access, not only UI.

## Observability and cost

Emit structured metrics for route, model, language slice, outcome, latency,
retry, error class, token/audio usage, and estimated cost. Avoid high-cardinality
personal data. Establish SLOs and alerts only from measured baselines.

Track at least p50/p95/p99 for:

- speech-end to partial and final transcript;
- final transcript to first model token;
- model completion to first playable audio;
- end-to-end successful turn;
- cost per successful turn and provider fallback rate.

## Testing pyramid

- Unit: policies, state machines, normalization, validation, cost calculation.
- Contract: every provider adapter against recorded/redacted fixtures.
- Integration: databases, Redis, queues, object storage, authentication.
- End-to-end: browser microphone/text flows with deterministic test doubles and
  a controlled live-provider smoke suite.
- Load/resilience: concurrency, backpressure, provider timeouts, reconnects,
  interruption, duplicate events, and partial outages.

Live-provider tests must have explicit cost limits and must not expose private
fixtures.

## Operational readiness

Every production increment includes configuration inventory, dashboards,
alerts, runbook, capacity/cost estimate, deployment strategy, database plan,
rollback procedure, and ownership. Health checks must prove the dependency
needed for serving, not merely that a process exists.

## Review

Review correctness, privacy/security, bilingual behavior, failure modes,
observability, performance/cost, compatibility, test adequacy, and rollback.
Record accepted residual risk rather than hiding it.
