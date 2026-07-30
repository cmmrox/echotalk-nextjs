# Provider Contract Boundaries

EchoTalk owns provider-neutral contracts. A vendor SDK, model name, response
shape, and error type must stop at its adapter boundary.

## Required contracts

- `SpeechRecognizer`: accepts controlled audio and returns interim/final
  hypotheses, language, confidence semantics, timing, usage, and normalized
  errors.
- `TranscriptPolicy`: selects the user-visible verbatim transcript, records
  normalization separately, and chooses clarification or fallback.
- `ConversationModel`: streams text with language policy, tool policy,
  cancellation, usage, model version, and normalized errors.
- `SpeechSynthesizer`: streams or returns playable audio with voice/model
  metadata, timing, usage, cancellation, and normalized errors.
- `TurnEvent`: immutable transition carrying session, turn, trace, time, route,
  and outcome identifiers.

## Adapter capability descriptor

Each adapter states whether it supports streaming, interim results, confidence,
word timing, language tags, custom vocabulary, cancellation, required formats,
regional processing, configured retention, and cost/usage reporting. Routing
may select only behavior the descriptor supports.

## Compatibility

Contract changes require an ADR when they cross service or storage boundaries.
Prefer additive evolution. Contract tests must use versioned redacted fixtures;
live-provider checks are a separate, cost-limited QA surface.
