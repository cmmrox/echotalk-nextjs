# QA Report — F001 / S01

- Status: passed
- Candidate commit/artifact: e7ca7efbe51e06a393348553cb3084751b244b9d
- QA harness/final source commit: 7f6cb9400b06443d857e70c62b91f78172f4e847
- Certifying run result: passed
- Certifying run record: delivery/features/F001-sinhala-english-production-voice/stages/S01-secure-platform-baseline/gates/qa-run.json
- Certifying run record SHA-256: 1e94acdbb1cc5a35e03b1f9f1c6faf034cbf7b2f81253679f2dea013d4533274
- Certifying run manifest SHA-256: a97c501c0ad58e525f688d6632e597d71225bda78eaa73eade3bd76cde82c986
- Environment/configuration version: Node v24.12.0; macOS arm64; F001 disabled by default; synthetic in-process provider fakes
- Provider/model/prompt/rule versions: contract `f001-s01-v1`; transcript policy `verbatim-v1`; candidate adapter identities/configuration asserted without live provider calls
- Evaluation set: TC-F001-001 through TC-F001-004; synthetic Sinhala/English text, generated buffers/tokens, and no private audio/transcripts
- QA owner: /root/s01_independent_qa
- QA completed at: 2026-07-30T12:39:47.565Z
- Recommendation: advance S01 to `qa-passed` after QA branch integration preserves the exact candidate and harness commits

## Traceability and scope

| Requirement/risk | Test | Language/device slice | Result | Evidence |
|---|---|---|---|---|
| F001-R02 / AC02 recognition completeness | TC-F001-001 | Sinhala Unicode and English fixtures | passed | Ordered final segments occur once; missing confidence remains null |
| F001-R02/R13/R14 / AC03/AC04/AC16 turn integrity | TC-F001-002 | Language-neutral synthetic audio and text | passed | Exact audio lookup, chronological history, FIFO queue, duplicate suppression, and active-delete race |
| F001-R07/R13/R18 / AC04/AC09 provider neutrality | TC-F001-003 | Provider-neutral synthetic bundle | passed | Actual pipeline injection plus route, timing, quality, usage, and cost record assertions |
| F001-R14/R17/R20 / AC16/AC20/AC21 boundaries | TC-F001-004 | Server boundary on macOS/Node | passed | Capability lifecycle, kill switch, bounded bodies, spend cap, cleanup/tombstones, legacy guards, and tracked-secret scan |

## Quality summary

- Automated: four required cases passed; 31 assertions passed; zero failures and zero skips.
- Manual/live-provider: not applicable to S01 provider promotion; no external provider or credential was used.
- Accessibility: no new S01 interaction requirement; production build preserved the existing UI. Client-visible accessibility remains assigned to later UX stages.
- Security/privacy: dynamic bearer isolation and revocation, no-store responses, disable-and-cleanup behavior, bounded streaming reads, and tracked credential-shape scan passed.
- Performance/resilience: FIFO concurrency, duplicate scheduling, deletion during active recognition, timer cancellation, and 1,050-session tombstone stress passed.
- Cost: per-attempt conservative monetary reservation rejected work before exceeding the configured session cap.
- Deployment/rollback: default-off flag, active-session kill switch, authenticated cleanup while disabled, full build, and no-migration rollback boundary passed.

## Defects, skips, and residual risk

| ID | Severity | Status | Owner | Risk/required action |
|---|---|---|---|---|
| None | — | closed | — | No blocking defect remained in the certified matrix |

| Skipped/non-applicable test | Reason/evidence | Risk | Owner | Completion date |
|---|---|---|---|---|
| Live Google/OpenAI call | Provider promotion and live quality are excluded from S01 and require later measured stages | Provider-specific behavior remains unclaimed | S03-S05 owners | later stage |
| Browser/device and native-language UAT | S01 changes server correctness/boundaries; human UAT remains explicitly outside T90 | No client acceptance or production claim | human client/UAT coordinator | pending |
| Production identity and protected external attestation | Capability authorization is not user identity; local agent identity is not cryptographic independence | Public exposure remains blocked | security/privacy and release owners | before production |

## Candidate integrity and rerun decision

- Material change after candidate freeze: none in the certified source. Harness commits after `e7ca7ef` change only `qa-automation/features/F001-sinhala-english-production-voice/**`.
- Rerun required/completed: the first clean run was superseded before evidence commit to preserve the existing developer wildcard; final certification was rerun clean against `e7ca7ef` with harness `7f6cb94`.

| Residual risk | Accountable acceptor | Decision/evidence |
|---|---|---|
| Google STT/TTS cannot guarantee transport cancellation after local deadline abandonment | service/release owner | Capability declares cancellation false; local state mutation after deletion is blocked and provider promotion remains later-stage work |
| Capability token does not establish production user identity | security/privacy owner | F001 remains default-off and public exposure is prohibited |
| Three pre-existing lint warnings and Node module-type warnings | engineering owner | Non-blocking; zero lint errors, typecheck/build pass |
| Merge/integration could invalidate evidence if product files change | project manager | Preserve candidate ancestry and file content; rerun T90 for any material product/config change |

## Gate decision

- [x] Candidate identity verified
- [x] Acceptance criteria evidenced
- [x] Required regression passed
- [x] Operations and rollback verified
- [x] No unaccepted blocking risk

Decision and rationale: PASS. The exact S01 source candidate satisfies its
selected acceptance criteria under the permanent synthetic matrix, security and
cleanup stress, and full repository regression. QA recommends `qa-passed`; this
does not grant UAT acceptance, production permission, or release authorization.
