# F001 Evaluation Specification

## Scope

S02 defines a reproducible Sinhala/English evaluation method without claiming a
quality threshold or provider promotion. Until the human corpus, privacy, and
budget gates close, every executable fixture is fictional and every provider
is fake.

## Required slices

- Sinhala Unicode: conversational and formal.
- Sri Lankan English.
- Intra-turn and inter-turn Sinhala-English switching.
- Romanized Sinhala.
- Names, places, amounts, dates, currency, identifiers, units, and negation.
- Quiet/noisy, codec/device, weak-network, first/follow-up, clarification,
  correction, cancellation, fallback, and empty-speech conditions.

Real coverage is established only by an approved external manifest digest. A
synthetic fixture may exercise a slice mechanically but cannot prove population
coverage or native-speaker quality.

## Metrics

- Comparison normalization `comparison-v1` applies Unicode NFC, converts every
  Unicode whitespace run to one ASCII space, trims leading/trailing space, and
  folds ASCII `A-Z` to `a-z`. It preserves punctuation, Sinhala code points,
  numbers, symbols, and all non-ASCII letter case. WER tokens are the resulting
  space-delimited strings. CER units are Unicode code points, including the
  normalized inter-word spaces. Any future rule is a new evaluator version.
- WER: word substitutions + deletions + insertions divided by reference words.
- CER: Unicode-code-point substitutions + deletions + insertions divided by
  normalized reference code points.
- Semantic accuracy: externally supplied binary/graded judgment with rubric
  version; the runner does not use an LLM to invent ground truth.
- Entity accuracy: exact protected-entity matches divided by expected entities.
- Clarification rate: `clarification_requested` observations divided by
  observations marked clarification-eligible under the pinned critical-entity
  rubric. Missing eligibility is reported, not treated as false.
- Success: completed eligible observations divided by attempted observations.
- Latency: deterministic p50/p95/p99 using nearest-rank over milliseconds.
- Cost: integer micro-USD estimates by attempted and successful observation,
  using an immutable catalog; estimates are not invoices.

Empty references and missing judgments are reported explicitly, never divided
silently or counted as passing. A non-empty hypothesis against an empty
reference records every hypothesis unit as an insertion and an undefined rate;
two empty values record zero edits and an undefined rate. Metrics are reported
overall and by approved slice with denominators and suppressed small cells.

## Provenance

Every run binds candidate, corpus/split, manifest digest, evaluator, annotation,
slice registry, provider/model/config/prompt/policy, price catalog, and report
schema versions. Output ordering and report hashing are deterministic.

## Evidence boundary

Git-safe scorecards contain aggregate counts, rates, latency, cost, versions,
limitations, failures, and skips. They never contain audio, reference or
hypothesis text, sample IDs/digests, consent references, storage locators,
credentials, provider payloads, or person-linked metadata.

## Human gates

The corpus steward approves corpus source/license, consent, splits, annotations,
and native-speaker adjudication. The security/privacy owner approves storage,
region, access, retention, deletion, provider disclosure, and suppression. The
budget owner approves prices, currencies, caps, sampling, and drift response.
No agent substitutes for these decisions.
