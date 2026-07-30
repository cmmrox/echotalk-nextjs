@AGENTS.md

# Claude Code adapter

The imported `AGENTS.md` and the canonical skill under
`.agents/skills/echotalk-development/` are the source of truth. Project skills
are exposed to Claude through `.claude/skills/echotalk-development`.

Use `.claude/agents/` only as thin role adapters. Do not duplicate project
architecture, domain rules, or delivery standards in this file.
