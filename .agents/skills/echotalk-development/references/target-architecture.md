# Target Architecture

## Direction

Evolve the current single Next.js process into replaceable, observable
boundaries. Use staged extraction; do not rewrite working paths all at once.

```text
Web client
  | HTTPS/WebRTC
  v
Next.js control API ---- PostgreSQL
  | session/control         durable metadata, consent, evaluation, audit
  v
Media gateway --------- Redis
  | audio frames            ephemeral state, queues, rate limits
  v
Turn orchestrator
  |-- STT router -> provider adapters
  |-- transcript policy and confidence
  |-- LLM router -> provider/model adapters
  `-- TTS router -> provider adapters

Telemetry/cost ledger <- every boundary
Encrypted object storage <- consented, retention-limited artifacts only
```

## Boundary responsibilities

- Web client: capture/playback, text parity, correction, consent, reconnection.
- Control API: identity, session authorization, configuration, durable records.
- Media gateway: long-lived WebRTC, jitter/VAD/turn framing, backpressure.
- Orchestrator: turn state machine, timeouts, routing, cancellation, fallbacks.
- Provider adapters: translate project contracts to vendor APIs and normalize
  errors, usage, confidence, and timing.
- PostgreSQL: durable configuration, metadata, evaluation versions, audit.
- Redis: short-lived session state, queues, distributed locks, rate limits.
- Object storage: optional encrypted samples under explicit consent/retention.

## Stable interfaces

Define project-owned contracts before adding providers:

- `SpeechRecognizer`: streaming/batch hypotheses with language, confidence, and
  word timing where available.
- `TranscriptPolicy`: route selection, agreement, normalization, clarification.
- `ConversationModel`: streaming response, tool policy, usage, cancellation.
- `SpeechSynthesizer`: streaming audio, voice metadata, timing, cancellation.
- `TurnEvent`: immutable state transition with trace, session, and turn IDs.

Provider-specific types must stop at adapter boundaries.

Each adapter exposes a capability descriptor instead of fabricating unsupported
signals: streaming, interim results, confidence semantics, language tags, word
timing, custom vocabulary, cancellation, audio formats, regional processing,
and provider retention. The orchestrator selects only policies compatible with
the declared capabilities.

## Turn state

Use explicit transitions:
`created -> listening -> speech-ended -> transcribing -> reasoning ->
synthesizing -> playing -> completed`, with `cancelled`, `timed-out`, and
`failed` terminal alternatives. Transitions must be idempotent and observable.

## Reliability and scaling

- Persist no essential session state only in a web process.
- Make retries bounded and operation-aware; never duplicate billed/model turns.
- Propagate cancellation when the user interrupts.
- Use deadlines and circuit breakers per provider.
- Apply backpressure instead of unbounded audio or turn queues.
- Scale media workers separately from stateless APIs.

## Architecture decisions

Create an ADR for a new service, data store, external provider, protocol,
retention policy, security boundary, or irreversible migration. Use
`assets/adr-template.md`.
