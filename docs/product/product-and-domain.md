# EchoTalk Product and Domain

## Product outcome

EchoTalk is a low-latency voice conversation agent for people who speak Sinhala,
English, or naturally mix both. It must return synchronized text and speech,
preserve meaning across language boundaries, and remain understandable when a
provider is uncertain.

## Primary users and contexts

- Sri Lankan Sinhala-first users, including users who code-switch with English.
- English-first users speaking with Sri Lankan accents.
- Users on mobile devices and variable networks.
- Operators who need auditable quality, latency, cost, and safety evidence.

Tamil is a future language track unless an approved feature explicitly brings it into scope.
Do not imply production Tamil support from configuration alone.

## Core product principles

1. Meaning is more important than literal transliteration.
2. Never silently convert Sinhala speech into English text or vice versa.
3. Display the transcript early, allow correction, and preserve the correction
   as evaluation feedback with consent.
4. When confidence or route agreement is low, clarify rather than confidently
   inventing.
5. Voice is an interface, not the sole interface. All core flows need visible
   text and keyboard-accessible controls.
6. Optimize cost after meeting measured quality and latency thresholds.

## Conversation contract

For each turn, retain a stable turn ID and distinguish:

- captured audio interval;
- raw provider hypotheses;
- selected verbatim transcript;
- normalized text used for reasoning;
- detected/selected language and script;
- assistant text;
- synthesized audio;
- timings, provider route, quality signals, and cost.

The user-visible transcript is verbatim by default. Normalization is a separate,
traceable field and must not erase the original.

## Success measures

- Sinhala and English word/character error rates by slice.
- Code-switch named-entity and intent accuracy.
- Task success and correction rate.
- Speech-end to partial transcript, final transcript, first text token, and first
  playable audio latency.
- Cost per successful turn and per conversation.
- Abandonment, retry, clarification, and fallback rates.

Targets belong in the active stage after baseline measurement. Do not
invent universal “full accuracy” guarantees.

## Requirement form

Every requirement states the user, scenario, desired outcome, acceptance
evidence, language slices, accessibility impact, privacy classification,
failure behavior, and out-of-scope cases.
