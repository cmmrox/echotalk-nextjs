# Sinhala AI Standards

## Quality position

No provider is assumed accurate enough for every Sri Lankan speaker, device,
domain, or code-switch pattern. Select routes from a versioned local evaluation
set and production-safe telemetry, not marketing scores or anecdotal demos.

## Evaluation corpus

Maintain consented, de-identified, versioned samples with immutable splits:

- native Sinhala in formal and conversational registers;
- Sinhala-English code-switching at phrase and word boundaries;
- Sri Lankan English accents;
- names, places, numbers, dates, currency, acronyms, and product vocabulary;
- quiet/noisy rooms, mobile microphones, compression, and weak networks;
- different speaker demographics without storing unnecessary identity.

Keep a sealed test set. Developers tune on train/dev only. Track corpus license,
consent, provenance, transcription guidelines, and deletion obligations.

## Ground truth

Use native-speaker transcription guidelines and double annotation on test data.
Resolve disagreements independently. Preserve Sinhala script, intentional
English tokens, punctuation policy, and a separate normalized representation.

## STT measurement and routing

Report WER and CER overall and by slice. Also measure named-entity error,
language-tag accuracy, semantic intent, empty transcript rate, and latency.

Use an economical primary route when it meets the slice threshold. Escalate
low-confidence, unstable, domain-critical, or mixed-language turns to a stronger
route or a second recognizer. Compare hypotheses using confidence, stability,
language/script consistency, glossary coverage, and semantic agreement. Ask the
user to confirm when disagreement remains material.

Define route promotion before testing: minimum sample and slice balance,
baseline, allowable regression, confidence/uncertainty method, quality/latency/
cost thresholds, critical entities, material-disagreement rule, and approving
product, technical, privacy, operations, and budget owners. If evidence is
insufficient, keep the route offline or shadow-only.

Never use an LLM to silently “repair” the verbatim transcript. Store any
LLM-normalized form separately with its model/prompt version.

For normalization changes, version the rule/model/prompt; compare exact entity,
number, currency, script, and language preservation against baseline; measure
semantic change and deterministic repeatability; and define allowable regression
delta in the sprint before implementation.

## LLM behavior

- Detect the requested reply language from user intent and session preference,
  not only Unicode script.
- Preserve names, numbers, currency, and English technical terms.
- Prompt explicitly for natural Sinhala, concise spoken output, and uncertainty.
- Evaluate native-speaker naturalness, instruction following, factuality,
  entity preservation, safety, and code-switch behavior.
- Use deterministic or low-temperature settings for transcript normalization.

## TTS behavior

Evaluate intelligibility and naturalness with native listeners. Include names,
numbers, mixed-script text, abbreviations, questions, and long responses.
Normalize text for speech without changing displayed text. Cache only content
allowed by privacy policy, keyed by voice/model/version and normalized input.

## Production feedback

Collect thumbs, correction, retry, and route-failure signals without retaining
raw audio by default. Sampling audio for improvement requires explicit consent,
encryption, limited access, retention expiry, and deletion support. Promote a
route only after shadow/offline evidence and rollback readiness.

Every provider test plan states provider/model/version, environment, sanitized
sample set and size, language/device slices, timeout/retry/fallback cases,
latency/cost capture, and evidence format.
