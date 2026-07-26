## Reviewer: gemini
_generated 2026-07-26T14:30:19Z · timeout 180s_

VERDICT: REQUEST-CHANGES

*   **Missing Endpoint Security Model:** The spec defines a new network endpoint but is silent on its authentication and authorization model. It should specify how access is controlled to prevent unauthorized observation of potentially sensitive agent activities.
*   **Undefined UI Error State:** The requirement for polling is missing a scenario for network failure. The spec should define how the UI behaves when it cannot refresh its data, such as displaying a "stale data" warning, to prevent misleading the user.
*   **Potential PII Exposure:** Agent task descriptions may contain PII, which could be exposed on a shared "second device". The spec should address this risk, clarifying whether data redaction is considered an upstream responsibility or if the data is assumed to be safe.
*   **Ambiguous "Active Session" Definition:** The active-session filter correctly relies on the shared data model but never defines what "active" means. The spec should state the criteria (e.g., "updated in the last X hours") to ensure the feature is implemented correctly.
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms
Created execution plan for SessionEnd: 2 hook(s) to execute in parallel
Expanding hook command: CMUX_BIN="${TERMLOOP_BUNDLED_CLI_PATH:-$(command -v termloop)}"; { [ -n "$TERMLOOP_SURFACE_ID" ] || [ -n "$TERMLOOP_WORKSPACE_ID" ]; } && [ "$TERMLOOP_HOOKS_DISABLED" != "1" ] && [ "$TERMLOOP_GEMINI_HOOKS_DISABLED" != "1" ] && [ -n "$CMUX_BIN" ] && [ -x "$CMUX_BIN" ] && { "$CMUX_BIN" gemini-hook session-end >/dev/null 2>/dev/null || true; echo '{}'; } || echo '{}' (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Expanding hook command: /Users/donald/.superset/hooks/gemini-hook.sh (cwd: /Users/donald/Sourcecode/agenticapps/agenticapps-dashboard)
Hook execution for SessionEnd: 2 hooks executed successfully, total duration: 15ms

## Reviewer: codex
_generated 2026-07-26T14:32:54Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- Stage 1’s stub violates the unconditional requirement that board data come from the shared adapters. Feature-gate it, mark it explicitly synthetic, or define a transitional requirement.
- `{sessions, tasks}` cannot distinguish an absent host from a host with zero tasks or a failed/malformed adapter. Add per-host availability/error metadata and partial-failure scenarios.
- The normative delta never defines the promised fixed wire shape or enum values. Specify fields, types, optionality, status/host enums, composite identity, and session–task referential integrity.
- The endpoint reads sensitive home-directory and SQLite state outside registered-project roots, but no `filesystem-access-policy` delta names allowed roots or requires symlink-safe, size-bounded, strictly read-only access. SQLite reads must not create sidecars.
- Session titles, task titles/notes, blockers, and `cwd` may contain PII, secrets, or hostile markup. Specify data minimization, plain-text rendering, output bounds, and no logging or persistence of board payloads.
- Timing is unverifiable and internally inconsistent: “recent,” “short interval,” and “few seconds” conflict with the design’s 24-hour/3-second/4-second values and the daemon’s roughly five-second cache. Define exact semantics, including missing `completedAt`.
- `blockedBy` contains IDs, but the UI requires titles. Define host/session-scoped lookup, collision handling, and fallback behavior when blockers are missing or filtered out.
- The extraction tasks do not move/export `host-style.ts`, despite requiring shared colours. Also require a textual host label so identity is not conveyed by colour alone.
- “One adapter fix updates both frontends without a second edit” is false for a separately published, versioned dependency unless release and upgrade behavior is specified; Node compatibility and the daemon’s no-native-dependency invariant are also unaddressed.

## Reviewer: opencode
_generated 2026-07-26T14:35:17Z · timeout 180s_

I'll check a couple of things in the repo to ground the review, then give theverdict.
VERDICT: REQUEST-CHANGES

- **Internal contradiction on the done-column bound.** "Four Columns With A Bounded Done Column" first scenario asserts "each task appears in exactly one column", but the second scenario excludes done tasks outside the window. Done tasks older than the window vanish — so they do not appear in exactly one column. Same contradiction in the grouping scenario ("no task disappears in either arrangement"): done-out-of-window tasks disappear regardless of grouping. Scope both scenarios to "non-bounded-out tasks" or to the in-window set.

- **Stage-1 stub contradicts the "shared adapter" requirement.** `Board Data Comes From The Shared Adapter Implementation` is written as a permanent SHALL ("The board SHALL obtain host data from the same adapter implementation"). But the plan explicitly ships `/api/v2/board` against a stub (`skeleton-data.ts`) before the extraction lands. The requirement needs a temporal qualifier ("once the extraction is complete, the board SHALL…") or the stub phase must be carved out, otherwise Stage 1 is non-compliant with its own spec on day one.

- **Extraction scope omits the colour definitions.** Requirement "Host Identity Uses The Shared Colour System" mandates colours "imported from the shared package rather than redefined." But tasks §4 only moves "model, store, and three adapters plus fixtures and tests" — it does not move `src/lib/host-style.ts`. The requirement is unsatisfiable against the file list as written; either add host-style to the extraction scope or rename the requirement to permit the dashboard to import colours from the adapter package's *model* (which won't exist).

- **Explained-empty-state needs a response field not in the frozen wire shape.** "No hosts present" requires the surface to "state which hosts were looked for and not found." The frozen §7.2 wire shape is `{sessions[], tasks[]}` with no envelope for absent hosts. Either name a response envelope (`{present:[], absent:[], sessions:[], tasks:[]}`) explicitly distinct from the frozen data model, or the requirement collides with "do not change the data model / wire shape frozen." Unresolved.

- **Strict-validation vs. graceful-degradation tension.** "Shape drift becomes a parse error" says a single bad record surfaces as an error; "A Missing Host Degrades Rather Than Fails" says one bad host doesn't take the others down. The spec doesn't say what happens when one record inside a *present* host is malformed — does the whole host fail (drops others' data from that host), is the host degraded to absent, or only the record dropped? Adapters have internal error containment, but the per-record/per-host error boundary at the daemon layer is unspecified.

- **`done` tasks with no `completedAt`.** The bound window keys off `completedAt`, which is optional in the upstream model. No scenario covers a `done`-status task missing `completedAt` — show it, hide it, or treat as unbounded? Real rendering gap.

- **Partially-failing host (present but unreadable) not covered.** "A Missing Host Degrades" only handles "not present." A host whose files exist but whose adapter throws (permission denied, corrupt SQLite, locked file) is unspecified. Given the adapters' whole value is error containment, the daemon-level behaviour on adapter throw should be a named scenario.

- **Security: board over a network to a second device, no auth/field-redaction story.** The founding use case is an iPad across the room — i.e., off-loopback. The spec delta never states `/api/v2/board` inherits the existing bearer-token / pairing / CORS-lock gate from `auth-and-pairing`, nor addresses that `cwd` and `note?` fields expose filesystem paths and arbitrary agent-captured text over that network. Given §`filesystem-access-policy` is the named security spine, the board surface should declare (a) auth inheritance and (b) which fields are safe to ship off-machine. `note?` in particular can leak secrets; no redaction rule.

- **No rate-limit / fan-out on a 3 s poll from multiple second devices.** Requirement "Board Freshness Without Push" fixes short-interval polling but places no ceiling on concurrent clients per the single daemon. Minor, but worth a scenario given the "leave it open on an iPad" pattern.

- **Read-only requirement is endpoint-thin.** It asserts "no endpoint SHALL modify" but never pins the verb to GET or forbids mutating siblings of `/board`. A scenario asserting only GET is permitted (no POST/PATCH/DELETE on `/api/v2/board*`) would close that.

- **Stale-during-pause undefined.** "Backgrounded surface stops polling" pauses fetches, but no scenario states whether the last snapshot stays visible, is greyed, or is cleared — and what staleness indicator the user sees. UX/marketing gap, not correctness, but the GAP already enumerates product judgement as fair game.

- **"Both directions" validation claim is misleading.** "Validated at the wire boundary in both directions" — the daemon is the sole producer; there is no inbound normalised body for this GET endpoint. Either drop "both directions" or clarify it means the outbound response plus the stub/adapter ingestion into the shared store.

- **Open GAP on the done-window length is acceptable** (explicitly deferred), but the requirement still says the bound "SHALL be stated on the surface" — fine — yet tasks §3 lists "the bound is stated" without anchoring it to the deferred value, so an implementer could ship a bound with no stability guarantee. Low risk; acceptable.

Netwyx [sic]: the design intent is sound and the staged plan is defensible, but the spec delta has two genuine internal contradictions (done-column vs. "every task appears"; grouping "no task disappears"), a self-contradiction against its own staged plan (shared-adapter requirement vs. stub), two missing scopes (colour extraction, empty-state envelope), and a real security gap (auth + field exposure over the network). Fix the contradictions and the security story before approving.

