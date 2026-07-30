---
id: T06
feature: F000
stage: S00
slug: ci-baseline-remediation
type: maintenance
status: in-review
owner_role: full-stack-developer
reviewer_role: qa-engineer
owner: /root
reviewer: /root/harness_adversarial_review
base_sha: dec20c441963ad53653e41225a3517ebe93f22c1
result_sha: pending
depends_on: [T04]
requirement_refs: [F000-R05]
acceptance_refs: [F000-AC02]
writable_paths: ["eslint.config.mjs", "next.config.ts", "media-service/opusFromMp3.ts", "scripts/governance/*.mjs"]
prohibited_paths: ["app/**", "components/**", "lib/**", "media-service/*.ts except media-service/opusFromMp3.ts"]
test_commands: ["npm run lint", "npm run typecheck", "npm run build"]
next_owner: qa-engineer
---

# T06 — Remediate the CI Baseline

## Outcome

The new CI gate can evaluate the existing application without a pre-existing
lint error or hundreds of warnings from vendored generated VAD runtime assets.

## Included scope and exclusions

- Included: a behavior-neutral `let` to `const` correction, use of the packaged
  FFmpeg installer binary through Next.js server externalization, ignoring
  generated `public/vad/` assets in ESLint, and unused imports introduced by
  F000 scripts.
- Excluded: resolving existing non-blocking application warnings or changing
  media behavior.

## Development

Apply only the exact baseline findings necessary for a usable setup and CI
signal. Do not disable rules for authored application code.

## Tests

- Tests added or updated: none; existing type/build checks protect behavior.
- Commands and expected outcomes: lint exits zero, followed by typecheck/build.

## Acceptance criteria

CI can enforce the full F000 verification command without suppressing authored
code errors.

## Security, privacy, and data impact

None.

## Observability, configuration, and migration

ESLint no longer parses third-party generated VAD files; they remain committed
and build-visible. No runtime configuration or migration.

## Rollout and rollback

Ship with the CI workflow. Revert only if ESLint begins owning generated assets.

## Evidence and handoff

- Actual files changed: `eslint.config.mjs`, `media-service/opusFromMp3.ts`,
  `next.config.ts`, and unused F000 script imports
- Commands run with pass/fail/blocked/skip: lint passed with six existing
  warnings; typecheck and production build passed
- Review: `/root/migration_integrity_review` verified the packaged FFmpeg 4.4
  binary, executable mode, Next output tracing, documentation, and build
- Evidence: result commit pending candidate freeze
- Remaining risks: existing authored warnings remain visible; a 2026-07-30
  production dependency audit reported 26 vulnerabilities, including one
  critical and sixteen high, and blocks application production readiness until
  a separately scoped dependency/security stage remediates and retests them
- Handoff decision and receiver: independent QA
