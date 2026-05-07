---
name: meta-observer
description: |
  Silent persister for the AgenticApps dashboard. At session end, reads the
  Claude Code transcript and atomically writes the last Workflow commitment
  block plus all tool-use hook firings into <projectRoot>/.planning/skill-observations/.
  This populates the CommitmentBlock and HookFirings panels in the dashboard.
disable-model-invocation: true
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: "node ${CLAUDE_SKILL_DIR}/hooks/session-end.mjs"
          timeout: 30
---

# meta-observer

A silent persister — no user-facing skill body required. The SessionEnd hook
runs `node hooks/session-end.mjs` once per Claude session at natural session
boundary. It reads the session transcript and writes two files per session:

- `<stamp>--<sessionId>.md` — the last `## Workflow commitment` block
- `<stamp>--<sessionId>.jsonl` — one JSON line per tool-use firing

No per-message overhead. Crashed sessions produce no record (acceptable).

## Install

Install per-project (D-5-09 — one skill per project, no global install):

```
claude skill install <path-to-packages/meta-observer>
```

After install, `CLAUDE_SKILL_DIR` in the hook command resolves to the installed
skill directory, so no path configuration is needed.

## What it writes

Example filenames written to `<projectRoot>/.planning/skill-observations/`:

```
2026-05-07T17-55-12--abc123.md
2026-05-07T17-55-12--abc123.jsonl
```

The date-time stamp uses ISO format with colons replaced by dashes. The latest
file by mtime is picked up by the dashboard's CommitmentBlock panel.

## Privacy

- Reads only the local transcript file provided by Claude Code in the hook payload.
- Writes only inside the resolved `<projectRoot>/.planning/skill-observations/` directory.
- No network calls, no telemetry, no data leaves the local machine.
- The `sandboxRoot` constraint in `atomicWrite` prevents any write outside that directory.
