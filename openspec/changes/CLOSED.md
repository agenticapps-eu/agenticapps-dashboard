# Open changes at retirement — 2026-08-05

The dashboard was retired on 2026-08-05 (**[ADR-0004](../../docs/decisions/0004-retire-the-dashboard.md)**).
Three changes were open. None will be completed. They are left in place rather
than deleted, because a proposal records reasoning that outlives the product, and
because deleting them would make the repo look tidier than the history was.

| Change | Tasks | State at close |
|---|---|---|
| `retire-v1-surfaces` | **39/56** | Merged to `main` incomplete, deliberately. |
| `add-oss-readiness` | **0/23** | Proposed, never started. |
| `verify-tailscale-second-device-access` | **0/24** | Proposed, worktree created, never started. |

## `retire-v1-surfaces` — 39/56, merged incomplete

The v1→v2 cutover. Sections 2 through 5 are complete and are the reason
`openspec/specs/` states v2 as current truth: the daemon teardown (107 files,
−17,527 lines), the product-quality invariants, the spec fold (145 → 105
requirements, 15 → 10 capabilities), and the supersession note.

**What was left undone, and why it is fine that it was:**

- **§1, three bullets** — remove help pages, widget dispatch entries and
  contextual links whose only destination is a retired surface; author one help
  page per surviving surface; land it as one commit. So the archived `main`
  carries help content that points at surfaces §2 deleted. This is stated plainly
  rather than papered over: it is documentation for a product nobody should run.
- **§6** — unhook the linter and observer packages from the workspace. They were
  to be moved out, not deleted, because both have standalone value. They remain
  in `packages/`, intact, and are recoverable from there.
- **§7** — deploy, pair, and the two-stage review. Verification of a shipment
  that is not happening.

Finishing these would have polished a product being withdrawn. The decision to
stop mid-change is itself recorded in ADR-0004 rather than left to look like
abandonment.

## `add-oss-readiness` — 0/23

Never started. Its subject — what a repo must carry to be credibly open-source —
is not dashboard-specific and is the one proposal here worth re-reading if the
question comes up elsewhere.

## `verify-tailscale-second-device-access` — 0/24

Never started, though a worktree was created for it. Worth recording precisely
*because* it never moved: "from any device" was a founding premise of this
product, stated in the original binding spec. The change that would have proved
the premise sat at 0/24 while the product was otherwise actively developed. That
is evidence about which parts of the original vision were load-bearing, and it
fed directly into ADR-0004.
