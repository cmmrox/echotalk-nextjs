# EchoTalk QA Automation

This directory owns permanent, reusable QA definitions. It is separate from
developer-authored tests and from local execution evidence.

```text
qa-automation/
  features/FNNN-slug/
    README.md
    cases/TC-FNNN-NNN-slug.md
    governance|playwright|contracts|evaluations|resilience/
    stages/SNN.json
  runs/       # ignored local candidate execution
```

Every stage ends with T90. Run its matrix with:

```bash
npm run qa:stage -- FNNN SNN
```

The runner requires a clean worktree, binds results to `HEAD`, records no raw
command output in the JSON result, and treats required failures or skips as
blocking. Never store secrets, private raw audio, or personal transcripts here.

Independent QA certifies and promotes a redacted, tracked gate record with:

```bash
npm run qa:stage -- FNNN SNN --candidate <commit> \
  --promote-evidence --qa-owner /root/<independent-agent>
```

The promoted `delivery/.../gates/qa-run.json` is write-once for that execution.
The QA report records its SHA-256; gate validation recomputes the record,
manifest-at-commit, required-case set, and exact candidate relationship.

`--allow-dirty` is a developer precheck only. It records
`certifying_run: false`, reports `precheck-passed` when checks succeed, and exits
with status `2` so automation cannot mistake it for stage certification.
