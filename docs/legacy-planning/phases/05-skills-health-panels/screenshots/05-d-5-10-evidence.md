## Workflow commitment

I am using the agentic-apps-workflow skill for this task.
Task scope: Read packages/meta-observer/SKILL.md frontmatter and report whether it declares a SessionEnd hook.
Task size: tiny

Skills I will invoke, in order:
1. agentic-apps-workflow — emit commitment ritual per protocol (already invoked).
2. (none further) — pure read-only inspection, no edits, no commits, no verification artifacts required.

Post-phase gates (if applicable): none (read-only sanity check, no code change).
Verification evidence I will produce: a one-sentence report citing the frontmatter contents.

Once I have stated this plan, I am committed to it. Deviating without explicit user approval is a protocol violation.

Yes — `packages/meta-observer/SKILL.md` declares a `SessionEnd` hook in its frontmatter (lines 9–14), running `node ${CLAUDE_SKILL_DIR}/hooks/session-end.mjs` with a 30-second timeout.
