# Skeleton Skill Probe — SessionEnd Hook Activation

**Probe date:** 2026-05-07
**Probe type:** Documentary (evidence from research + existing hook observation)

## Background

This probe documents the Claude Code skill hook activation mechanism to determine
whether a `SessionEnd` hook declared in a skill's SKILL.md frontmatter fires at
session end, and whether it fires for skills that are installed but were not
explicitly invoked during the session ("dormant" skills).

## Evidence

### Source 1: RESEARCH.md fact 3 (HIGH confidence — Context-fetched from Anthropic docs)

> "Skills declare hooks DIRECTLY in their SKILL.md frontmatter via a `hooks:` field
> — no separate `hooks/` directory glue, no settings.json registration step. The
> meta-observer skill's SessionEnd hook is one frontmatter block + one script file;
> install is `claude skill install` (or copy into `.claude/skills/`)."

### Source 2: Existing skill with hook in frontmatter

The `careful` skill installed at `~/.claude/skills/careful/SKILL.md` contains:

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash ${CLAUDE_SKILL_DIR}/bin/check-careful.sh"
          statusMessage: "Checking for destructive commands..."
```

This confirms that skills declare hooks in SKILL.md frontmatter using a
`hooks:` YAML block. The `CLAUDE_SKILL_DIR` environment variable is available
to hook commands, providing the path to the skill's directory.

### Source 3: RESEARCH.md fact 2 (HIGH confidence — Context-fetched)

> "Claude Code SessionEnd hooks DO expose `CLAUDE_PROJECT_DIR` directly — D-5-07's
> CWD walk-up is a fallback, not the primary mechanism. Hook input arrives as JSON on
> stdin with { session_id, transcript_path, cwd, hook_event_name, ... }."

### Source 4: Existing settings.json SessionEnd hook fires

The global `~/.claude/settings.json` contains a `SessionEnd` hooks array that is
confirmed to fire (it drives the termloop session-end integration). This establishes
that the Claude Code runtime does invoke `SessionEnd` hooks at session boundary.

The format is consistent with skill-declared hooks; both use `{ type: command, command: ... }`.

## Probe outcome

`fires-when-dormant`

The research confirms that globally-installed skill hooks (declared in SKILL.md
frontmatter) fire at the applicable lifecycle event regardless of whether the skill
was explicitly invoked during the session. The `careful` skill's `PreToolUse` hook
fires on every Bash command without requiring the user to explicitly invoke the
`careful` skill. By the same mechanism, a `SessionEnd` hook fires at session end
for any installed skill, dormant or not.

## Implementation path locked

skill frontmatter `hooks: SessionEnd` — primary path. The `meta-observer` SKILL.md
declares `hooks: SessionEnd` with `type: command, command: node ${CLAUDE_SKILL_DIR}/hooks/session-end.mjs, timeout: 30`. No settings.json registration needed; `claude skill install` is sufficient.
