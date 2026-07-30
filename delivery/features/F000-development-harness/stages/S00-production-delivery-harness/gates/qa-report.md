# QA Report — F000 / S00

- Status: passed
- Candidate commit/artifact: 14dc61dbe4669d92b0b75aaba07407f3c3e6ba91
- QA harness/final source commit: 14dc61dbe4669d92b0b75aaba07407f3c3e6ba91
- Certifying run result: passed
- Certifying run record: delivery/features/F000-development-harness/stages/S00-production-delivery-harness/gates/qa-run.json
- Certifying run record SHA-256: 527dcdeff3c400d08d87b2de91b7c076b288c9605460c44fc71b23d55ea9b0dd
- Certifying run manifest SHA-256: 0e8cd0c8d10ca6c88cb04172abf3cde8b4bfc5b6d39855f0019facd5fc1aac90
- Environment/configuration version: local repository / Node.js v24.12.0 / darwin arm64
- Provider/model/prompt/rule versions: not applicable
- Evaluation set: synthetic governance fixtures
- QA owner: /root/f000_independent_qa
- QA completed at: 2026-07-30T10:08:35.277Z
- Recommendation: advance the exact candidate to `qa-passed` after the PM records the evidence commit and T90 completion; do not infer human UAT acceptance, production permission, release-owner approval, or release authorization

## Scope and execution

- Preflight: `git rev-parse HEAD` returned the exact candidate and
  `git status --porcelain=v1 --untracked-files=all` was empty.
- Candidate baseline: `npm run ci:verify` passed all six governance validators,
  10/10 governance tests, lint with zero errors and six warnings, typecheck, and
  the production build.
- Certifying execution, run exactly once:
  `npm run qa:stage -- F000 S00 --candidate 14dc61dbe4669d92b0b75aaba07407f3c3e6ba91 --promote-evidence --qa-owner /root/f000_independent_qa`.
- The certifying execution passed 5/5 required cases, promoted the redacted
  record above, and reported no failed, skipped, cancelled, or blocked case.

## Traceability and results

| Acceptance criteria / risk | Permanent case | Result | Evidence |
|---|---|---|---|
| F000-AC01, F000-AC02, F000-AC06 / agent routing and authority separation | TC-F000-001 | passed, required, exit 0 | Case `61032a1a8c2806f3d81146c8eb668d6d3b2d0383174f8386658525a9b521474c`; automation `760f68901b130aeb93ea631e6d5824c38edee967fdf4f4950a358a2e4944224b`; output `657a45dcf22a242fe0515b697e866ee520e005ff007b8e3df714bbdc5bedc3e7` |
| F000-AC02, F000-AC06 / delivery traceability and final-QA closure | TC-F000-002 | passed, required, exit 0 | Case `bd47ffd3fafced43ce45cd3ed88ae73925fd0eebcf9347ab775c55c3bab22677`; automation `d1da08446cbf166d75c3b81e5b0471f2b71d6706bc75406f3d4433b7e7004c41`; output `d7f4837bc8d431d529533394bab44685a1b5ef2a6b32134eab76c5c3f4b3855e` |
| F000-AC03 / safe artifact scaffolding | TC-F000-003 | passed, required, exit 0 | Case `ee71fea43b4c74fd1a9fd8de1fbc4d18e2a991778c52924a1d92c56587db2e91`; automation `28f5712e7bbc28d4c26c7f25393f758e45990d49fef82d90535ad25cb85615fb`; output `ec64fb40a39e3bd75168fb8f09234dce1a405716b400d67c2596b24142bfdbcd` |
| F000-AC04, F000-AC05, F000-AC06 / canonical structure and certifying runner | TC-F000-004 | passed, required, exit 0 | Case `352b700cbbd79650001ca017368f44e1c1bdf7c8fa550340160cdefec1dfe6ae`; automation `f0bb2e99c0e48f627375afef38a57563ce77425d8f551d635c0e5f12beea0dc2`; output `2b22b170aefe8510ddc60c0b5362d4e13b85e783792b1376bd96b2b495625d40` |
| F000-AC06 / cryptographic authority evidence | TC-F000-005 | passed, required, exit 0 | Case `aaa259d4dc82d4880eece2676607ecdede19e6db5ce64f6d9edd1b5f27b2c442`; automation `0a09ce1ad848edfd85123c531c2175a315be5b1b57fc921cfdd18714bd663479`; output `0acb038172f177dfc6751d039db7d3cc4b5829a9d4a22876168e2fb8b6965e49` |

## Evidence integrity and privacy

- Candidate and QA harness both resolve to
  `14dc61dbe4669d92b0b75aaba07407f3c3e6ba91`.
- The promoted record states `working_tree_clean: true`,
  `certifying_run: true`, and `result: passed`.
- The manifest hash, all case hashes, and all automation hashes were
  independently recomputed from the exact harness commit and match the record.
- The promoted JSON contains only the approved identity, environment, timing,
  command, status, duration, and SHA-256 fields. There are no raw output,
  stdout, stderr, secret, credential, token, private-key, transcript, or audio
  fields or detected sensitive-value indicators.

## Quality summary

- Automated: candidate baseline passed; stage QA passed 5/5 required cases.
- Manual/live-provider: not applicable to this repository-governance-only
  feature; no provider credentials or network calls were used.
- Language/accessibility: runtime Sinhala, English, code-switch, device, and UI
  behavior are unchanged and outside F000; documentation routing and human
  authority boundaries passed permanent automation.
- Security/privacy: synthetic fixtures only; authority signatures, evidence
  integrity, ignored local runs, and redaction boundaries passed.
- Performance/resilience/cost: the certifying matrix completed from
  `2026-07-30T10:08:32.992Z` to `2026-07-30T10:08:35.277Z`; no external
  services or billable provider calls were used.
- Deployment/rollback: no application migration or deployment is in scope;
  rollback remains a Git revert of the harness/evidence integration commit.

## Defects, skips, limitations, and residual boundary

- Defects: none found in F000/S00 acceptance scope.
- Required skips or non-applicable substitutions: none.
- Observation: candidate lint completed with zero errors and six warnings in
  pre-existing runtime files outside the harness acceptance scope.
- The local `/root/f000_independent_qa` owner is a recorded orchestration
  identity, not cryptographic proof of organizational independence. A protected
  independent review, protected CI environment, or equivalent external
  attestation remains required before a production release claim.
- Human client UAT, explicit client production permission, release-owner
  operational go/no-go, signed authorization, deployment, and post-deployment
  verification remain pending and are not granted by this report.

## Candidate integrity and gate decision

- Material candidate or harness-source change during execution: none.
- Rerun decision: no rerun is required for this evidence-only report. Any
  material candidate, QA manifest, permanent case, automation, configuration,
  or environment change requires affected and regression QA to run again.
- [x] Exact candidate and harness identity verified.
- [x] All F000 acceptance criteria evidenced by required permanent cases.
- [x] Required regression passed with no failure or skip.
- [x] Applicable rollback and no-deployment boundary verified.
- [x] No unresolved blocking F000/S00 QA risk.

Decision and rationale: independent QA passes the exact candidate for the
`qa-passed` gate only. The record is clean, certifying, redacted, cryptographically
bound to the candidate sources, and all five required cases passed. All human
UAT and production/release authorities remain separate and pending.
