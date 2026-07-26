# Backlog — work that is not a spec change

An OpenSpec change must carry a spec delta. Some real, tracked work has no
product-behaviour delta at all — it is process debt. That work is recorded here
so it is not lost between the phase tree and the change list.

Carried in from `docs/legacy-planning/STATE.md` §"Deferred Items" during the
OpenSpec migration (2026-07-26).

## Human verification backlog

**Status:** open. Carried forward at both the v1.1 close (2026-06-08) and the
v1.2 close (2026-06-14) under proceed-and-acknowledge.

The v1.2 open-artifact audit found 22 items, all inherited from already-shipped
v1.0/v1.1 phases — none from v1.2 or Phase 8:

| Category | Detail | Status |
|---|---|---|
| verification | `VERIFICATION.md` for phases 00, 01, 02, 03, 04, 06, 05.1, 10, 11.1, 11.2 | `human_needed` (10 items) |
| uat | Phase 01 `HUMAN-UAT.md` | 2 genuinely-open scenarios |
| uat | Phases 03, 05, 07, 13, 05.1, 10, 11, 11.1 | partial/closed/resolved — 0 pending |

The implementations shipped and have been in production use since. What is
missing is the human confirmation, which is precisely the part that cannot be
delegated to an agent.

**The decision to make:** sign each phase off individually against shipped
behaviour, or retire the backlog wholesale with one recorded decision on the
grounds that sustained production use has superseded the gate. Either is
defensible. A fourth carry-forward is not — at that point the acknowledgement
means nothing.

Whichever is chosen, update `docs/legacy-planning/STATE.md` §"Deferred Items"
so a future audit does not re-open it.

> This was briefly staged as an OpenSpec change during the migration and then
> withdrawn: it has no spec delta, and `openspec validate` correctly refuses a
> change without one. Process debt belongs here, not in `openspec/changes/`.

## Known stale artifact

`.claude/claude-md/workflow.md` is the GSD-era vendored workflow document. As of
workflow v3.0.0, `CLAUDE.md` points at `docs/WORKFLOW.md` instead. The old file
was deliberately left in place — migration `0032` does not remove it, the
`normalize-claude-md.sh` hook still references it, and §08 is supersede-don't-delete
— but it describes a front end this repo no longer uses. Worth a follow-up to
confirm whether the hook reference is still live and retire the file if not.
