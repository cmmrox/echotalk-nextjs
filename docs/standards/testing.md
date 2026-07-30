# EchoTalk Testing Standard

## Test surfaces

| Surface | Purpose |
|---|---|
| Unit | Policies, validation, state machines, normalization, budgets, and pure transformations. |
| Contract | Provider adapters and project interfaces against versioned redacted fixtures. |
| Integration | Routes, orchestration, storage, queues, identity, cancellation, and failure handling. |
| Browser E2E | Text/microphone flows, accessibility, interruption, reconnect, and supported devices. |
| Bilingual evaluation | Sinhala, English, and code-switch STT/LLM/TTS quality by approved corpus slice. |
| Resilience/load | Backpressure, concurrency, latency, weak networks, timeouts, partial outage, and recovery. |
| Security/privacy | Authorization, abuse, input limits, injection, redaction, retention, and deletion. |
| Deployment smoke | Configuration, migrations, health, core journey, monitoring, and rollback identity. |

## Test ownership

Every implementation task adds or updates proportional developer tests.
Independent QA owns permanent acceptance/regression cases and the final stage
matrix. Developer tests do not replace stage QA.

## Evidence rules

- Bind results to exact candidate commit, artifact, environment, provider/model,
  prompt/rule, configuration, and evaluation-set versions.
- Record pass, fail, blocked, skip, and non-applicable separately.
- A required skip or failure blocks `qa-passed`.
- Do not commit secrets, personal transcripts, or private raw audio.
- Keep raw local runs in ignored `qa-automation/runs/`; publish only reviewed,
  redacted summaries.
- Any material code, configuration, model, prompt, provider, migration, or
  environment change invalidates affected evidence.
