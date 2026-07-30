# Evaluation Annotation Guide

This guide is a draft method for authorized native-language annotators. It does
not authorize collection or access.

## Transcript forms

Record verbatim speech separately from corrected and normalized forms. Preserve
Sinhala script, intentional English tokens, hesitations required by the rubric,
negation, names, amounts, dates, identifiers, and units. Never silently
translate or repair meaning.

## Annotation

- Use `comparison-v1` from the F001 evaluation specification: NFC, collapsed
  Unicode whitespace, trimmed edges, ASCII-only case folding, and preserved
  punctuation/Sinhala/numbers/symbols.
- Tag language/slice and protected entities from the approved taxonomy.
- Test-set samples require two independent native-speaker annotations.
- Disagreement requires a separately assigned adjudicator and reason code.
- Unknown or inaudible content is marked by the approved token, not guessed.
- Semantic/entity judgments cite the rubric version, not free-form private text.

## Privacy

Annotators see only authorized samples in restricted tools. Do not copy audio,
transcripts, consent references, sample identifiers, or screenshots into Git,
chat, tickets, logs, or gate evidence. Report incidents immediately and stop
work when consent, expiry, or access is unclear.

## Versioning

Changing tokenization, punctuation, entity taxonomy, rubric, annotation tool,
adjudication, or split rules creates a new version and requires a baseline
comparison. Sealed test content is not exposed to developers.
