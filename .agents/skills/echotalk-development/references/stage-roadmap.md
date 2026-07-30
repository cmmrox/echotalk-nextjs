# Stage Roadmap

Each stage is a releasable increment behind safe configuration or feature
controls. Exact numeric quality, latency, and cost gates are set after S02
baseline evidence.

## S00 — Delivery and environment foundation

Establish shared agent governance, repository instructions, role adapters,
delivery templates, reproducible local setup, CI quality gates, configuration
inventory, baseline security checks, and a deployable non-production
environment. Exit with independent QA and human UAT of the delivery workflow.

## S01 — Secure platform baseline

Add identity/session authorization, durable metadata, Redis ephemeral state,
secret management, rate/spend controls, consent/retention foundations,
structured telemetry, deployment/rollback, backups, and production-like
observability. Keep the existing voice route functioning behind controls.

## S02 — Evaluation and shadow framework

Create the licensed/consented bilingual corpus, annotation guide, versioned
splits, STT/LLM/TTS evaluation harnesses, latency/cost ledger, provider
interfaces, redacted fixtures, dashboards, and shadow execution. This stage
defines evidence-based promotion thresholds.

## S03 — Sinhala-first transcription

Introduce streaming STT adapters, glossary/context support, language and
code-switch policy, confidence/agreement routing, normalization separation,
clarification/correction UX, and safe fallback. Promote routes by evaluation
slice, not globally.

## S04 — Bilingual conversation intelligence

Introduce model routing, natural Sinhala system behavior, conversation memory
policy, streaming/cancellation, safety/tool boundaries, evaluation gates,
fallbacks, and cost control. Preserve user language and critical entities.

## S05 — Natural speech output

Introduce TTS adapters, native-speaker evaluation, text normalization,
streaming/chunking, interruption, privacy-aware caching, fallback voices, and
voice settings. Text remains available if synthesis fails.

## S06 — Real-time UX, accessibility, and resilience

Harden the extracted media gateway, reconnection, jitter/backpressure,
barge-in/echo behavior, mobile/network performance, bilingual UI, transcript
correction, consent, keyboard/screen-reader support, and end-to-end load/chaos
tests.

## S07 — Controlled general availability

Complete threat model and privacy review, penetration/load/resilience testing,
SLOs/on-call/runbooks, capacity and cost budgets, incident/deletion drills,
canary rollout, production UAT, monitoring, rollback rehearsal, and final
release evidence.

## Parallel tracks

After S00, BA/UX discovery, corpus governance, platform foundations, and
provider evaluation can progress in parallel when contracts and writable paths
are independent. Promotion order still follows dependencies: S02 evidence
precedes route selection; S01 controls precede production data; QA precedes UAT;
human acceptance precedes release.

A later provider starts with an S02-compatible evaluation task even when S02 is
closed; implementation/promotion remains an S03 task. It need not reopen the
entire stage, but it must satisfy the current S02 evidence contract and record
any evaluation-version change.
