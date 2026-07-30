---
id: S05
feature: F001
slug: natural-speech-output
status: proposed
acceptance_refs: []
depends_on: [S02, S04]
final_qa_task: T90
candidate_sha: pending
product_owner: user-client
human_client: user-client
release_owner: pending-human
---

# F001 / S05 — Natural Speech Output

## Production-releasable outcome

An evaluated, configuration-pinned Google Sinhala/English synthesis route
speaks the approved response meaning naturally and always preserves complete
text fallback.

## Included scope and exclusions

- Included: target-project voice discovery, Gemini-TTS `si-LK` evaluation,
  voice/model/locale/encoding settings, pronunciation set, display/TTS
  equivalence, TTS-only normalization, format benchmark, transient audio,
  accessible playback, and text fallback.
- Excluded: voice cloning, assumed Preview production approval, changing
  displayed meaning for pronunciation, indefinite caching, and release.

## Requirements and acceptance criteria

Requirements: `F001-R10`–`R12`, `R14`, and `R18`. Planned primary acceptance:
`F001-AC12`–`AC13`, activated only with task and permanent-QA coverage.
Accessible delivery is rechecked in S06.

## Architecture and data

Version voice, model, locale, encoding, speaking configuration, normalization
policy, usage, and cost. Keep separate display and TTS text with semantic
equivalence evidence. Audio references are short-lived; synthesis owns no
durable domain state. ADRs cover capability discovery, Preview risk, caching,
format, and rollback.

## Task dependency graph

| Task | Role | Depends on | Writable paths | Status |
|---|---|---|---|---|
| T01 pronunciation/equivalence set | business-analyst | — | feature TTS specifications | planned |
| T02 synthesis architecture | solution-architect | T01 | assigned ADRs/contracts | planned |
| T03 Google TTS adapter | full-stack-developer | T02 | new Google TTS provider files | planned |
| T04 pronunciation policy | full-stack-developer | T01, T02 | new TTS-normalization files | planned |
| T05 playback/text recovery UX | ui-ux-engineer | T01 | assigned playback UI files | planned |
| T80 synthesis integration | full-stack-developer | T03–T05 | shared TTS/media/config | planned |
| T90 independent QA | qa-engineer | T80 | QA and gate paths only | draft |

## Security, privacy, and abuse

Send only approved synthesis text. Keep audio transient and access-controlled.
No user voice cloning or biometric use. Preview/provider terms, data region,
retention, and caching need human privacy review.

## Quality, latency, reliability, and cost budgets

Native speakers score pronunciation, naturalness, entity/number rendering,
code-switching, and semantic parity by slice. Measure text-to-audio/end-to-end
latency, failure/recovery, characters, conversion overhead, and cost. Preview
status cannot be hidden by a passing quality score.

## Observability and operations

Record voice/model/locale/encoding/config, normalization version, audio format,
timing, character usage, cost, cache decision, failure, and text fallback
without response content.

## Configuration, migration, deployment, and rollback

Call `voices:list` in the target project, benchmark provider-native formats and
conversion, then enable per-language internal flags. Rollback immediately to
text-only or a previously approved stable voice; Preview failure never blocks
text.

## Independent QA

Final task: `T90`. QA covers native-speaker pronunciation/naturalness, meaning
parity, voice pinning, accessibility, failure, format quality, latency, cost,
privacy, and rollback.

## UAT scenarios

Feature UAT 16 plus representative audio from UAT 1–7: complete text recovery
on synthesis failure and human review of Sinhala/English/mixed speech.

## Risks and exit criteria

Risks are Preview instability, unavailable target-project voices, Sinhala
pronunciation, entity/number errors, semantic mismatch, conversion loss/latency,
and playback accessibility. Exit requires capability evidence, human
voice/Preview decision, passing quality gates/T90, and verified text rollback.
