# EchoTalk Delivery

`delivery/` contains live execution state. It does not own stable product,
architecture, or standards knowledge.

For each approved feature:

```text
delivery/features/FNNN-slug/
  README.md
  stages/SNN-slug/
    stage.md
    tasks/TNN-slug.md
    gates/qa-report.md
    gates/qa-run.json          # after exact-candidate certification
    gates/uat-record.md
    gates/uat-decision.json + .sig
    gates/release-evidence.md
    gates/release-authorization.json
    gates/release-authorization.sig
    gates/release-result.json + .sig
```

Read the canonical lifecycle and artifact contracts in
[`docs/governance/`](../docs/governance/). Generate new artifacts through the
scripts exposed by `npm run scaffold:*`, then run
`npm run governance:validate`.
