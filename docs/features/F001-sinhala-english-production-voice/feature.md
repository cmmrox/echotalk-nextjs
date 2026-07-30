---
id: F001
slug: sinhala-english-production-voice
status: approved
kind: user-facing
product_owner: user-client
---

# F001 — Sinhala-English Production Voice Conversations

## Problem and user value

EchoTalk already supports a voice-to-agent loop, but it cannot yet claim
production-quality Sinhala and bilingual behavior. The current flow can lose
recognition segments, classify language from script alone, omit the current user
turn from model context in one path, and does not give users a reliable way to
correct uncertain transcripts.

This feature will provide trustworthy Sinhala, Sri Lankan English, and
Sinhala-English code-switched conversations using Google Speech-to-Text and
Text-to-Speech with OpenAI reasoning. “Full accuracy” is not a responsible
production promise; the product promise is measured quality, visible
uncertainty, user correction, safe fallback, and continuous regression control.

## Users and scenarios

- Sinhala-first users speaking conversational or formal Sinhala.
- Bilingual users switching languages within a sentence or between turns.
- Users speaking Sri Lankan English, Sinhala names, places, amounts, dates, and
  domain terms.
- Users typing or speaking Romanized Sinhala.
- Users needing transcript review, keyboard access, screen-reader feedback,
  replay, interruption, or text-only continuation.
- Operators needing quality, latency, failure, and cost visibility without
  access to private conversation content.

## Included behavior

- Explicit `Sinhala`, `English`, and `Auto` session modes.
- Google STT as primary recognizer, configured and evaluated for Sinhala and
  English.
- Provider-neutral STT, transcript-policy, LLM, and TTS contracts.
- Separate raw, verbatim, user-corrected, and normalized transcript forms.
- Sinhala script, English, mixed/code-switched, and Romanized Sinhala handling.
- Editable transcript and targeted confirmation for uncertain critical data.
- OpenAI replies using exact chronological context and protected entities.
- Google Gemini-TTS treated as a Sinhala candidate, not an assumed production
  dependency, because `si-LK` is currently Preview; promotion requires
  native-speaker quality evidence and an explicit preview-risk decision.
- Turn-scoped audio, idempotency, cancellation, replay, interruption, retry,
  and text recovery.
- Versioned evaluation, telemetry, redaction, rate/spend limits, canary, and
  rollback.

## Excluded behavior

- Tamil or languages other than Sinhala and English.
- A promise of perfect recognition, reasoning, pronunciation, or zero latency.
- Custom training/fine-tuning before a measured baseline proves it necessary.
- Providers other than Google and OpenAI in the initial release.
- Native mobile apps, biometrics, speaker recognition, emotion inference, or
  voice cloning.
- High-consequence actions based only on an unconfirmed transcript.
- Indefinite raw-audio or full-transcript retention.
- Agent approval of UAT, privacy policy, production access, or release.

## Requirements

- `F001-R01`: Users can select Sinhala, English, or Auto; intent is visible,
  session-persistent, and supplied to recognition, reasoning, and synthesis.
- `F001-R02`: Recognition processes every final segment exactly once and binds
  audio to the intended session, turn, and attempt.
- `F001-R03`: Language analysis distinguishes Sinhala script, English,
  mixed/code-switched content, and Romanized Sinhala without silent translation.
- `F001-R04`: Every turn keeps separate raw, verbatim, corrected, and normalized
  transcript fields with actor, reason, policy version, and time.
- `F001-R05`: Users can inspect and correct recognized text; required
  confirmations can be accepted, edited, retried, or cancelled.
- `F001-R06`: The system asks a targeted clarification for uncertain names,
  amounts, dates, identifiers, negation, and other approved critical entities.
- `F001-R07`: STT, policy, LLM, and TTS use versioned provider-neutral
  interfaces so routing changes do not rewrite conversation logic.
- `F001-R08`: OpenAI receives the current user turn and permitted history
  exactly once, chronologically, with language and correction context.
- `F001-R09`: Replies are natural in the selected language, preserve protected
  entities, handle code-switching, and avoid unnecessary translation.
- `F001-R10`: Each response records model/prompt/policy versions and structured
  display text, TTS text, language mode, uncertainty, usage, and cost.
- `F001-R11`: Displayed and spoken meanings match; material content is never
  available only in audio.
- `F001-R12`: Google TTS language, voice, encoding, and speaking settings are
  pinned, observable, native-speaker evaluated, and gated by service launch
  stage.
- `F001-R13`: Turn processing has an idempotent lifecycle with trace, session,
  turn, attempt, cancellation, and terminal-state identifiers.
- `F001-R14`: Timeout, throttling, malformed output, unavailable audio, and TTS
  failure have bounded, non-duplicating retry/fallback.
- `F001-R15`: Core controls and live states are keyboard operable and announced
  to assistive technology; text-only use remains available.
- `F001-R16`: A consented, de-identified evaluation set covers language,
  dialect, code-switching, entities, devices, noise, network, and turn types.
- `F001-R17`: Audio and person-linked transcripts are restricted data with
  consent, least-privilege authorization, redaction, retention, and deletion.
- `F001-R18`: Operators can monitor aggregate quality, latency, fallback,
  failures, usage, and cost per successful turn without conversation content.
- `F001-R19`: Shared production state uses approved durable stores; ephemeral
  buffers are bounded and reliably cleaned when a session ends.
- `F001-R20`: Flags support shadow evaluation, internal pilot, canary, pause,
  provider-route rollback, and complete feature disablement.

## Acceptance criteria

- `F001-AC01`: Sinhala, English, and Auto are visible and persist across
  supported session reconnect behavior.
- `F001-AC02`: Multi-result fixtures produce all final segments once and in
  order.
- `F001-AC03`: Concurrent/queued tests prove audio cannot attach to another
  turn.
- `F001-AC04`: A stable turn record contains transcript provenance, reply/TTS
  text, language, route/version, timing, quality, usage, and cost attribution.
- `F001-AC05`: Versioned fixtures separately pass for Sinhala Unicode, Sri
  Lankan English, mixed speech, turn switching, and Romanized Sinhala.
- `F001-AC06`: No normalization or language policy silently changes protected
  meaning.
- `F001-AC07`: Corrections are consented, auditable, reversible before send, and
  become the only current-turn text supplied to the LLM.
- `F001-AC08`: Uncertain critical entities trigger a focused clarification
  rather than an unmarked guess.
- `F001-AC09`: Contract tests replace provider adapters with fakes without
  changing orchestration.
- `F001-AC10`: Tests prove the LLM receives current turn and allowed history
  exactly once and in order.
- `F001-AC11`: A sealed native-speaker set meets approved Sinhala, English,
  code-switch, entity-preservation, and response-quality thresholds.
- `F001-AC12`: Display and audio have equivalent meaning; TTS failure preserves
  the complete text response.
- `F001-AC13`: Promoted Google voices/settings are configuration-driven,
  observable, pronunciation-tested, and explicitly approved if still Preview.
- `F001-AC14`: Record, stop, confirm, edit, retry, replay, interrupt, and
  text-mode controls work by keyboard.
- `F001-AC15`: Screen readers receive meaningful recording, processing,
  confirmation, playback, failure, and completion states.
- `F001-AC16`: Empty speech never invokes the LLM; timeout/cancel/retry tests
  create no duplicate user or assistant turn.
- `F001-AC17`: Session close clears or expires all governed buffers, timers,
  attempts, and media references.
- `F001-AC18`: Baseline/release reports publish WER/CER, semantic and entity
  accuracy, clarification, latency, success, and cost by required slice.
- `F001-AC19`: Telemetry contains no keys, raw audio, unrestricted transcripts,
  or arbitrary client event content.
- `F001-AC20`: Authorization, upload/media limits, rate limits, and spend caps
  are enforced at production resource boundaries.
- `F001-AC21`: Provider secrets stay server-side and out of browser, logs,
  fixtures, evidence, Git, and task artifacts.
- `F001-AC22`: State migrations have verified backup, rollback, and
  compatibility evidence.
- `F001-AC23`: Each stage passes independent `T90` QA with permanent evidence.
- `F001-AC24`: Product, privacy, UAT, operational, and release decisions remain
  pending until recorded by the named human authority.

## Language, accessibility, and UX slices

- Conversational/formal Sinhala; short commands and multi-sentence speech.
- Sri Lankan English and locally common accent patterns.
- Intra-sentence and inter-turn switching.
- Sinhala Unicode, English, mixed script, and Romanized Sinhala.
- Names, Sri Lankan places, organizations, amounts, phone/reference numbers,
  dates, times, units, abbreviations, punctuation, and negation.
- Quiet/noisy rooms, microphone distance, supported browser/device combinations,
  interrupted speech, long pauses, and weak networks.
- First turn, follow-up, correction, clarification, cancel, replay, and text
  recovery.
- Keyboard, screen reader, reduced motion, visible focus, and understandable
  status/error behavior.

## Security, privacy, and data handling

- Raw audio and person-linked transcripts are restricted.
- Default to transient processing. Retained samples require purpose-specific
  consent, retention/deletion rules, access control, and de-identification.
- Provider region, data use/training, retention, residency, subprocessors, and
  DPA suitability require human privacy/legal review before production.
- Authentication and authorization protect session, turn, media, transcript,
  correction, and replay resources.
- Content stays out of ordinary logs. Debug capture is disabled by default and,
  if approved, time-bounded, consented, controlled, and auditable.
- Credentials use server-side secret storage and separate environment scopes;
  values are never recorded in documentation or Git.

## Failure and fallback behavior

- Silence: retry/text option; no LLM call.
- Uncertainty: editable text and targeted confirmation.
- Google STT failure: bounded retry then text fallback. OpenAI STT fallback
  remains disabled until approved by privacy ADR and measured routing policy.
- Ambiguous LLM timeout: reconcile with idempotency key or offer explicit retry;
  never silently create a second turn.
- TTS/playback failure: keep complete text and recovery controls.
- Network/session loss: preserve only approved durable state, expire ephemeral
  media, and present deterministic recovery.
- Rate/spend boundary: reject new costly work without corrupting active turns.

## Quality, latency, reliability, and cost budgets

Numeric gates will be approved after a representative baseline rather than
invented without evidence. Baseline and candidate reports will include:

- STT word and character error rate by language slice.
- Semantic correctness and protected-entity preservation.
- Correction, retry, fallback, and clarification rates.
- Speech-to-transcript, transcript-to-first-token, complete-text, text-to-audio,
  and end-to-end p50/p95/p99 latency.
- Successful-turn, duplicate-turn, timeout/cancel, and recovery rates.
- Provider usage and LKR/USD cost per attempted/successful turn, with session
  and daily caps.

Low cost cannot override privacy, safety, or minimum-quality gates.

## Telemetry and operations

- Correlate trace, session, turn, attempt, provider request, and idempotency IDs.
- Record provider/model/voice/region/config/prompt/policy versions, timings,
  state, fallback reason, confidence availability, usage, and cost.
- Use a versioned price catalog and distinguish estimates from invoices.
- Dashboards expose aggregate quality slices, latency, errors, capacity, cost,
  and flag cohort without exposing content.
- Alert on error/timeout spikes, duplicates, quality regression, anomalous cost,
  quota exhaustion, cleanup failure, and rollback triggers.
- Runbooks cover provider outage, compromised key, spend stop, privacy incident,
  state recovery, route rollback, and complete disablement.

## UAT scenarios

1. Multi-turn conversational Sinhala.
2. Formal Sinhala information request.
3. Multi-turn Sri Lankan English.
4. Sinhala-to-English switching between turns without context loss.
5. Intra-utterance code-switching with preserved terms.
6. Romanized Sinhala following the approved display/reply policy.
7. Names, places, dates, amounts, identifiers, and negation preservation.
8. Editing/confirming an uncertain critical transcript before LLM use.
9. Rejecting a transcript, retrying speech, and continuing.
10. Silence/noise creating no invented turn or LLM request.
11. Complete, ordered long/multi-segment speech.
12. Rapid turns that cannot exchange audio, transcript, or response.
13. Interrupting playback and starting the next turn.
14. Approved bounded fallback during Google STT failure.
15. No duplicate turn during OpenAI failure.
16. Complete text recovery during Google TTS failure.
17. Keyboard-only and screen-reader completion of the core flow.
18. Reconnect/session close respecting persistence/deletion policy.
19. Clean behavior at rate/spend limits.
20. Operator diagnosis without viewing private content.
21. An authorized evaluation steward verifies consent provenance,
    de-identification, required slice coverage, sealed-set separation, version
    identity, and an aggregate baseline without unauthorized content exposure.
22. An authorized operator exercises shadow/internal/canary controls, pauses on
    a simulated trigger, rolls back the provider route, and completely disables
    F001 while preserving evidence and safe text behavior.

## Decisions, assumptions, and dependencies

- Confirmed by user: OpenAI LLM and relevant Google STT/TTS credentials are
  available. Values must not enter docs, tasks, fixtures, evidence, logs, or Git.
- Entitlements, enabled Google APIs, billing/quota, service-account scope,
  deployment region, and OpenAI project limits require verification.
- Current official-provider evidence, rechecked 2026-07-30:
  - [Google STT V2 language support](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages)
    lists Sinhala `si-LK` on `chirp` and `chirp_2`; in
    `asia-southeast1`, `chirp_2` lists automatic punctuation, model adaptation,
    and word-level confidence. This is the primary benchmark candidate.
  - [Google Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)
    lists Sinhala `si-LK` as Preview. The release plan therefore requires a
    preview-risk decision and a text-only rollback; ordinary Google Cloud voice
    availability must also be confirmed with `voices:list` in the target
    project.
  - [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
    supports turn identifiers, expected-language/context hints, and
    latency-versus-quality tuning, but notes that completion order is not
    guaranteed and some streaming models do not expose confidence. It remains
    an evaluated fallback, not an assumed Sinhala winner.
- Cost strategy: keep the split pipeline so STT/TTS providers can be benchmarked
  independently; use the lowest-cost OpenAI reasoning route that passes the
  sealed Sinhala quality set, escalating only uncertain/complex turns. Do not
  pay for parallel STT in normal traffic; shadow comparison is sampled and
  budget-capped.
- Required ADRs: provider contracts/capabilities; transcript provenance and
  retention; uncertainty/OpenAI STT fallback; production state; audio protocol
  and turn binding; credentials/region/provider data use; evaluation/release
  thresholds.
- Human decisions: Product Owner and release authority; Auto and Romanized
  behavior; critical entities/correction rules; consent/retention/deletion and
  region; supported devices/browsers/network and authentication; Google voices;
  post-baseline budgets; pilot/canary/UAT/rollback ownership.
- Portfolio alignment decision: the Product Owner approved F001 as the umbrella
  feature delivered through stages S01–S07. The former provisional F002–F007
  feature labels are retired from the roadmap without allocating those IDs.

## Proposed implementation plan

This plan is non-executable until feature approval. After approval, stages and
tasks will be scaffolded through the governance harness with one independent
`T90` QA task per stage.

| Outcome | Main work | Depends on | Rollback |
|---|---|---|---|
| 1. Secure correctness/platform baseline | Fix multi-result STT, current-turn history, turn-scoped audio, idempotency, auth/limits; define contracts/ADRs | Approved feature/decisions | Keep existing flow behind disabled flag |
| 2. Evaluation and shadow framework | Consented corpus, annotations, fakes, scorecards, cost ledger, sealed baseline, shadow runs | 1 | Disable capture/shadow |
| 3. Sinhala/English recognition and correction | Benchmark Google STT V2 `chirp_2` (`si-LK`, target-region capability checked), modes, adaptation vocabulary, language/Romanized policy, uncertainty routing, correction UI; optional measured OpenAI STT fallback | 1–2 and privacy ADR | Google-only or text-only |
| 4. Bilingual OpenAI conversation | Responses-based structured output, exact history, protected entities, ambiguity, usage/cost; small/default route with evaluated escalation | 1–3 | Revert model/prompt/policy |
| 5. Evaluated Google TTS | Benchmark Gemini-TTS `si-LK` Preview and any project-listed voices, pronunciation set, text/audio parity, format benchmark, text fallback, preview-risk decision | 2 and 4 | Disable speech; keep text |
| 6. Realtime UX, resilience, production state | Accessible controls, interruption, circuit breakers, durable state, retention/deletion, observability | 1–5 | Disable voice/realtime; restore compatible state |
| 7. Controlled production readiness | Regression, security/privacy, performance/cost gates, UAT, pilot, canary, runbooks, rollback drill | 1–6 | Pause cohort or disable feature/route |

### Proposed task delegation after approval

| Work package | Owner |
|---|---|
| Acceptance detail, language policy, corpus, UAT traceability | Business Analyst |
| Provider/transcript/state/security/audio/rollout ADRs | Solution Architect |
| Stage/task graph, scope, gates, and handoffs | Project Manager |
| Provider contracts and turn lifecycle | Full-stack Developer |
| Existing STT/history/audio correctness | Full-stack Developer |
| Google STT adapter | Full-stack Developer |
| OpenAI STT fallback, only if approved | Full-stack Developer |
| Language/transcript/uncertainty policy | Full-stack Developer |
| Mode/correction/replay/interruption/accessibility design | UI/UX Engineer |
| Accessible client implementation | UI/UX Engineer |
| OpenAI agent orchestration | Full-stack Developer |
| Google TTS/pronunciation | Full-stack Developer |
| Identity, authorization, state, migrations | Full-stack Developer |
| Privacy, redaction, rate/spend, operations | Full-stack Developer |
| Independent functional/security/a11y/quality/latency/cost QA | QA Engineer |
| Human acceptance preparation and decision records | UAT Coordinator |
| Canary/release preparation and rollback | Project Manager + human authority |

Parallel writes will use separate task branches/worktrees and disjoint writable
paths. Package/lockfiles, schema/migrations, integration status, `T90`, UAT, and
release artifacts are serialization gates.

### Development start gate

Development may begin only after:

1. Product Owner approval and the portfolio-alignment choice;
2. privacy, language, entity, support-envelope, and authority decisions;
3. scaffolded stage/tasks with dependencies and writable paths;
4. architect ownership of required ADRs; and
5. assignment of an independent QA owner for the first stage.

## Approval

- Human product owner: `user-client`
- Feature decision/date: approved as the F001 umbrella feature on 2026-07-30
- Approval evidence: explicit user instruction, “Approve F001 umbrella and
  create the implementation stages,” in the governing Codex task
- Development authority: stage planning/scaffolding approved; implementation
  begins only from ready, assigned task artifacts
- UAT decision/date: pending
- Production/release decision/date: pending
- Evidence: this draft plus future recorded human decisions
