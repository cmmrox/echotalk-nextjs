# QA Report — F000 / S00

- Status: passed
- Candidate commit/artifact: b8e40cee2e193279b173e7aab3be320e48dee858 (source commit; no separately built release artifact)
- QA harness/final source commit: b8e40cee2e193279b173e7aab3be320e48dee858
- Certifying run result: passed
- Certifying run record: delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/qa-run.json
- Certifying run record SHA-256: 156c8bfccd1b051fa139123d6075cfc60c9acf5c45d909968bc56582a26b3016
- Certifying run manifest SHA-256: 0e8cd0c8d10ca6c88cb04172abf3cde8b4bfc5b6d39855f0019facd5fc1aac90
- Environment/configuration version: local source-only run; Node.js v24.12.0; darwin arm64; repository HEAD b8e40cee2e193279b173e7aab3be320e48dee858
- Provider/model/prompt/rule versions: not applicable; F000 is an offline governance harness and no external provider credentials or network calls are used
- Evaluation set: permanent F000 synthetic governance fixtures and negative fixtures at b8e40cee2e193279b173e7aab3be320e48dee858
- QA owner: /root/f000_recertification_qa
- QA completed at: 2026-07-30T10:18:57.364Z
- Recommendation: PASS — advance S00 to `qa-passed` after the QA evidence commit is recorded in the T90 lifecycle handoff; human UAT, client production permission, and release-owner authorization remain pending

## Traceability and scope

| Requirement/risk | Test | Language/device slice | Result | Evidence |
|---|---|---|---|---|
| F000-AC01; thin shared router, deterministic adapters, authority boundary | TC-F000-001 | Governance-only; language/device independent | passed | Required, exit 0; case `61032a1a8c2806f3d81146c8eb668d6d3b2d0383174f8386658525a9b521474c`; automation `760f68901b130aeb93ea631e6d5824c38edee967fdf4f4950a358a2e4944224b`; output `406b92693d951205f8afd861fd28d5217013bc3697238bfa17a2cdcfbd33d9e1` |
| F000-AC02; validation and broken-T90 negative fixture | TC-F000-001, TC-F000-002 | Governance-only; language/device independent | passed | TC-F000-002 required, exit 0; case `bd47ffd3fafced43ce45cd3ed88ae73925fd0eebcf9347ab775c55c3bab22677`; automation `d1da08446cbf166d75c3b81e5b0471f2b71d6706bc75406f3d4433b7e7004c41`; output `5bcccfc0bcf116f843032d6d7c15de7583d69269a6ac1fe9af3a3d711e2e3020` |
| F000-AC03; deterministic collision-safe scaffolding | TC-F000-003 | Synthetic temporary workspace; language/device independent | passed | Required, exit 0; case `ee71fea43b4c74fd1a9fd8de1fbc4d18e2a991778c52924a1d92c56587db2e91`; automation `5c6da1023416401b41d14e952c4deb968bb1f9a555aca5e58c4356de66f649a5`; output `60ed31b1a06a7ae4e22312cd51547222beffc6827f32836fb5e9a2110968f688` |
| F000-AC04, F000-AC05; clean stage runner, canonical structure, legacy provenance | TC-F000-004 | Repository metadata and synthetic fixtures; language/device independent | passed | Required, exit 0; case `352b700cbbd79650001ca017368f44e1c1bdf7c8fa550340160cdefec1dfe6ae`; automation `d2acd0d5d6d2da1c7e765a557cb52e45dab3c0eea290f92afa27364d65fa475a`; output `5ba496645b49c029057348e74b4b93a121f319985055911f44dc4998653c513f` |
| F000-AC06; separate QA/UAT/release gates and cryptographic authority evidence | TC-F000-001, TC-F000-002, TC-F000-004, TC-F000-005 | Synthetic Ed25519 keys only; language/device independent | passed | TC-F000-005 required, exit 0; case `aaa259d4dc82d4880eece2676607ecdede19e6db5ce64f6d9edd1b5f27b2c442`; automation `0a09ce1ad848edfd85123c531c2175a315be5b1b57fc921cfdd18714bd663479`; output `decf1c9ee28eb6087b28031c865f922c9677f0e24fbe55deaa60a774b2c9fe0b` |

All six acceptance criteria are covered by required cases. The manifest and
run contain the same ordered five-case set, with no requiredness duplicated in
the manifest and no skipped case.

## Quality summary

- Automated: `npm run ci:verify` passed all six governance validators, 10/10 governance tests, lint with 0 errors and 6 non-blocking existing warnings, typecheck, and the production build. The promoted stage run passed all five required checks.
- Manual/live-provider: live-provider testing is not applicable to this delivery-enabler stage. Independent inspection verified the promoted and ignored local records are byte-identical and that the candidate, harness, manifest, cases, automation, commands, requiredness, result set, and hashes agree.
- Accessibility: no application UI or runtime behavior changes are in F000/S00; product accessibility testing is not applicable to this harness-only candidate.
- Security/privacy: synthetic repository fixtures and synthetic Ed25519 keys only. The promoted record has the exact redacted schema, contains hashes rather than command output, has no stdout/stderr/raw-output field, and matched no private-key, bearer-token, common credential, or email-value pattern.
- Performance/resilience: the certifying stage run completed from 2026-07-30T10:18:55.207Z to 2026-07-30T10:18:57.364Z. Negative fixtures proved stale adapters, broken QA closure, required-case downgrade, fabricated authority/hashes, dirty execution, and test-time mutation fail closed.
- Cost: no provider, network, or paid-service use; no operating-cost change.
- Deployment/rollback: no deployment, migration, runtime configuration, or production data change. Source rollback is a Git revert of the harness candidate; release authorization is outside this QA verdict.

## Execution record

| Command | Outcome |
|---|---|
| `git rev-parse HEAD` | `b8e40cee2e193279b173e7aab3be320e48dee858` before CI, immediately before certification, and after certification |
| `git status --porcelain=v1 --untracked-files=all` | empty before certification; after promotion, only the expected new `gates/qa-run.json` existed before this report was updated |
| `npm run ci:verify` | passed; governance 6/6, governance tests 10/10, lint 0 errors/6 warnings, typecheck passed, build passed |
| `npm run qa:stage -- F000 S00 --candidate b8e40cee2e193279b173e7aab3be320e48dee858 --promote-evidence --qa-owner /root/f000_recertification_qa` | executed exactly once; passed and promoted the redacted run |
| `shasum -a 256 delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/qa-run.json qa-automation/runs/2026-07-30T10-18-55-207Z-F000-S00-b8e40cee2e19.json` | both records `156c8bfccd1b051fa139123d6075cfc60c9acf5c45d909968bc56582a26b3016`; byte identity independently confirmed |
| Read-only candidate-source recomputation with Node.js and `git show b8e40cee2e193279b173e7aab3be320e48dee858:<path>` | passed; manifest, five case hashes, five automation hashes, commands, requiredness, result set, acceptance coverage, candidate/harness identity, and redaction schema all matched |

## Defects, skips, and residual risk

| ID | Severity | Status | Owner | Risk/required action |
|---|---|---|---|---|
| None | — | — | — | No F000/S00 candidate defect or unresolved critical/high security issue was found. |

| Skipped/non-applicable test | Reason/evidence | Risk | Owner | Completion date |
|---|---|---|---|---|
| Voice-runtime manual/live-provider, Sinhala/English/code-switch, browser/device, and accessibility execution | Explicitly excluded by F000 and S00; this candidate changes the delivery harness, not application behavior | None for the scoped harness verdict; future runtime stages require their own proportional matrix | Project Manager | 2026-07-30 |
| Deployment/migration/production rollback rehearsal | S00 has no deployment, migration, or production configuration change; rollback is Git revert | Production release remains prohibited until later human and operational gates | Release Owner (pending human) | 2026-07-30 |

## Candidate integrity and rerun decision

- Material change after candidate freeze: none. Candidate, QA harness, and current HEAD are the same commit; `git diff --name-only <candidate> <harness>` is empty. The certifying worktree was clean before and throughout check execution; the runner added only the promoted evidence after recording the stable pass.
- Rerun required/completed: completed. This replacement certification supersedes the invalidated prior candidate evidence. The promoted command was run exactly once for `b8e40cee2e193279b173e7aab3be320e48dee858`; another run is not required unless candidate, harness, configuration, or evidence material changes.

| Residual risk | Accountable acceptor | Decision/evidence |
|---|---|---|
| The QA run and report still require an evidence-only commit and T90/stage lifecycle integration; this does not alter the certified source candidate. | Project Manager `/root` | Commit the reviewed gate evidence, record its identity in the T90 handoff, and advance stage state without changing the certified candidate. |
| `/root/f000_recertification_qa` is a repository agent identifier, not cryptographic proof of independence. Production requires protected independent review, protected CI/environment attestation, or equivalent external evidence. | Human release owner and repository administrators | Required before release authorization; not satisfied or waived by this local QA pass. |
| Human UAT acceptance, explicit client production permission, and operational go/no-go are absent. | `user-client` and pending human Release Owner | Must remain pending; this report does not grant any of them. |
| Six lint warnings remain in application/runtime files outside the F000 harness scope; lint still exits successfully with no errors. | Project Manager / future runtime task owner | Track separately if the project adopts a zero-warning policy; they do not block this F000/S00 harness verdict. |

## Gate decision

- [x] Candidate identity verified
- [x] Acceptance criteria evidenced
- [x] Required regression passed
- [x] Operations and rollback verified at the applicable no-deployment scope
- [x] No unaccepted blocking risk within F000/S00 QA scope

Decision and rationale: **PASS for F000/S00 at
`b8e40cee2e193279b173e7aab3be320e48dee858`.** The clean certifying run passed
all five required cases, all six acceptance criteria are covered, all
candidate-source and evidence hashes recomputed exactly, and the durable record
is redacted. Handoff is to the Project Manager for evidence/lifecycle
integration and then to the UAT Coordinator; no human acceptance, production
permission, or release authorization is implied.
