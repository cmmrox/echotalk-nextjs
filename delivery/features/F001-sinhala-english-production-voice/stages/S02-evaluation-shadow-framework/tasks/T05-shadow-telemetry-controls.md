---
id: T05
feature: F001
stage: S02
slug: shadow-telemetry-controls
type: implementation
status: done
owner_role: full-stack-developer
reviewer_role: solution-architect
owner: /root
reviewer: /root/s01_architecture_review
base_sha: e1637658a366ca01af5874209ecacc8e81a6f47e
result_sha: 7dd2ef0c32a38455dd0d85a4c8b79c940bc36da9
depends_on: [T02]
requirement_refs: [F001-R17, F001-R18, F001-R20]
acceptance_refs: [F001-AC18]
writable_paths: [".env.example", "lib/evaluation/shadowPolicy.ts", "lib/evaluation/shadowTelemetry.ts", "qa-automation/features/F001-sinhala-english-production-voice/evaluation-framework/shadow-controls.test.mjs", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/tasks/T05-shadow-telemetry-controls.md"]
prohibited_paths: ["app/**", "components/**", "media-service/pipeline.ts", "lib/services/**", "evaluation/data/**", "delivery/features/F001-sinhala-english-production-voice/stages/S02-evaluation-shadow-framework/gates/**"]
test_commands: ["npm run test:f001:s02:dev", "npm run typecheck", "npm run lint"]
next_owner: full-stack-developer
---

# T05 — Implement Shadow Telemetry Controls

## Outcome

A default-off policy can decide synthetic eligibility and aggregate content-free
shadow telemetry without calling or wiring a provider.

## Included scope and exclusions

- Included: explicit approval inputs, deterministic sampling, per-run cap,
  kill switch, safe dimensions/counters, reset/delete behavior.
- Excluded: runtime pipeline wiring, restricted content, real provider fan-out,
  production dashboard, approved sample rate, or paid traffic.

## Development

Fail closed unless feature, disclosure, consent scope, and budget are all
explicit. No environment value alone may create a disclosure.

## Tests

- Tests added or updated: default off, cap, sampling, redaction, reset.
- Commands and expected outcomes: listed commands pass.

## Acceptance criteria

Supports the control and aggregate reporting mechanics used by AC18/R20.

## Security, privacy, and data impact

Telemetry rejects content-like keys and stores only bounded aggregate counts.

## Observability, configuration, and migration

Commit variable names only; no secret or migration.

## Rollout and rollback

No live rollout. Disable flag and clear aggregate memory.

## Evidence and handoff

- Actual files changed: `.env.example`, the assigned shadow policy and telemetry
  modules, and the assigned developer test.
- Commands run with pass/fail/blocked/skip:
  - `npm run typecheck` — pass.
  - `npm run test:f001:s02:dev` — pass, 8/8 tests across T03 and T05.
  - `npm run lint` — pass with zero errors and three pre-existing warnings in
    `app/page.tsx` and `media-service/audioPackaging.ts`.
  - `git diff --check` — pass.
- Evidence: implementation commit
  `7dd2ef0c32a38455dd0d85a4c8b79c940bc36da9`.
- Independent review: PASS; deterministic fail-closed gates, bounded
  content-free telemetry, no runtime/provider wiring; final combined S02
  developer suite passed 12/12.
- Remaining risks: live disclosure requires T04 and later integration approval.
- Handoff decision and receiver: T80/full-stack developer after T03 and T04;
  T80 remains blocked on T04.
