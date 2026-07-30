# EchoTalk Agent Instructions

## Required project skill

For any planning, architecture, implementation, review, QA, release, or UAT
work in this repository, read and follow:

`./.agents/skills/echotalk-development/SKILL.md`

Load only the reference files that the skill routes you to. Treat those files
as the canonical project knowledge shared by Codex and Claude.

## Non-negotiable boundaries

- Preserve unrelated and uncommitted user work.
- Never expose secrets, credentials, raw private audio, or personal data.
- Do not claim Sinhala quality from intuition; use the versioned evaluation set.
- Keep provider integrations behind project interfaces. Do not couple product
  behavior directly to one STT, LLM, or TTS vendor.
- Do not approve your own work. QA evidence and human client acceptance are
  separate gates.
- Only the human client can sign UAT acceptance or authorize production release.
- Keep each agent within its assigned task scope and writable file patterns.
- Record material architecture decisions as ADRs and release evidence by commit.

## Repository commands

Use commands declared in `package.json`. Before handing work to QA, run the
relevant checks for the changed scope. The workspace governance check is:

```bash
npm run agents:validate
```

## Instruction precedence

User instructions override project defaults. A nearer `AGENTS.md` may refine
these rules for its subtree. Security, privacy, and human-approval gates cannot
be silently weakened.
