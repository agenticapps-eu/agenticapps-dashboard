## Reviewer: gemini
_generated 2026-08-04T05:28:17Z · timeout 540s_

VERDICT: REQUEST-CHANGES
*   **Unimplemented Prior Security Requirement:** The spec correctly adds a requirement that all file reads must be size-capped, but critically notes this was "required by this change's first-round review ... and was the one of the three left unimplemented." Shipping without this hardening measure exposes the daemon to a DoS vector via oversized `tasks.md` or `REVIEWS.md` files. This must be implemented before approval.
*   **Cross-Change Dependency:** The spec depends on two corrections to another open change, `retire-v1-surfaces`. This creates a process hazard. If `retire-v1-surfaces` merges first without those corrections, the durable specs will be in a conflicting state. This change should be formally marked as a blocker for `retire-v1-surfaces` to ensure they are merged in the correct order or state.
*   **Stale Review Evidence:** The solution for handling multiple `REVIEWS-round-N.md` files is to select the most recently modified file. This is vulnerable to an editor, script, or `git` operation touching a file and updating its `mtime` without changing its content, potentially causing the board to classify a change based on a stale, superseded record that now appears "newer". The selection logic should be more robust, using the round number as the primary sort key and `mtime` only as a tie-breaker.
*   **Deep-Link Error State:** The scenario for a deep link to a non-existent change states the board "states that the change was not found," but does not specify how. This user-facing error state should be defined: a toast, a dismissible banner, or another specific UI element.

## Reviewer: codex
_generated 2026-08-04T05:30:07Z · timeout 540s_

VERDICT: REQUEST-CHANGES

- Card identity mandates `sourceIdentity(repositoryRoot, ...)`, leaking absolute paths/usernames and contradicting task 1.1’s registry-ID identity. Specify registry ID normatively.
- Deduplication suppresses backlog cards matching active/archive slugs, but the drawer scenario requires same-named backlog and active cards to both render. That scenario is unreachable.
- Malformed-record behavior conflicts: one requirement skips malformed entries, while upstream retains active/archive cards with partial evidence. Empty directories are also admitted upstream but excluded by the tasks. Define admission and partial-evidence behavior explicitly.
- Review freshness based on filesystem mtime is not semantic round ordering and is easily altered. A later review round can lose to an older touched/copied file, breaking the “cleared rejection” scenario.
- Realpath/stat/size checks are TOCTOU-prone unless tied to the opened file descriptor. Require `O_NOFOLLOW` or equivalent descriptor-based containment, type, and size validation.
- The endpoint is not fleet-bounded: per-source/per-file limits do not bound repository count, total evidence bytes, checklist rows, or concurrent timed-out scans. Add aggregate limits plus request coalescing or cancellation.
- Degradation reasons and author-controlled titles/checklist/reviewer text need explicit disclosure rules: symbolic errors only, no raw paths/usernames, and plain-text rendering.

## Reviewer: opencode
_generated 2026-08-04T05:31:18Z · timeout 540s_

I'll verify the change's factual claims against the actual code before issuing a verdict.
The change directory already exists locally — good, I can verify claims against both repos.

