# EchoTalk Production Roadmap

The canonical stage definitions and dependencies are maintained in:

`../.agents/skills/echotalk-development/references/stage-roadmap.md`

## Delivery state

| Stage | Outcome | Status | Production exposure |
|---|---|---|---|
| S00 | Delivery and environment foundation | in-progress | none |
| S01 | Secure platform baseline | proposed | gated |
| S02 | Evaluation and shadow framework | proposed | shadow only |
| S03 | Sinhala-first transcription | proposed | controlled rollout |
| S04 | Bilingual conversation intelligence | proposed | controlled rollout |
| S05 | Natural speech output | proposed | controlled rollout |
| S06 | Real-time UX and resilience | proposed | controlled rollout |
| S07 | Controlled general availability | proposed | human-authorized |

## Governance

Each stage receives its own charter, task handoffs, ADRs, QA report, UAT record,
and release evidence. A later stage may start discovery in parallel, but cannot
bypass dependency, QA, human UAT, or production authorization gates.
