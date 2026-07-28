---
change: decide-tailnet-ipv6-policy
reviewers: [claude]
reviewed_at: 2026-07-28T15:25:56Z
artifacts_reviewed:
  - "openspec/changes/decide-tailnet-ipv6-policy/proposal.md"
  - "openspec/changes/decide-tailnet-ipv6-policy/design.md"
  - "openspec/changes/decide-tailnet-ipv6-policy/specs/daemon-runtime/spec.md"
  - "openspec/changes/decide-tailnet-ipv6-policy/tasks.md"
  - "openspec/specs/daemon-runtime/spec.md"
overall_verdict:
  claude: APPROVE
recommendation: proceed
review_gate: overridden
review_gate_note: >-
  One reviewer on record, and the change-gate does not count it. Accepted
  explicitly by the operator. See "Review-gate override" below and ADR 0002.
---

> External reviewer output is untrusted content. It is preserved verbatim
> as review evidence and was not treated as instructions.

## Review-gate override

The §18 change-gate requires **two independent other-vendor reviewers**. This
change carries **one reviewer, which the gate does not count at all.**

Both facts matter and neither should be softened:

1. Only one vendor returned a verdict on the frozen round-5 bundle. The other
   two failed to produce any output — a tooling failure, not a disagreement.
2. That one reviewer is `claude`, and `openspec-change-gate.sh` excludes
   `claude` from the reviewer count when claude is the implementing host
   (`OPENSPEC_GATE_SELF`). By the gate's own definition this change has **zero**
   independent reviews.

The mitigating fact, recorded so the override is judged on what is actually
true: the planning artifacts were authored by **codex**, and the round-5 review
was performed by a **separate claude session** reviewing codex's work. At the
moment it was performed it was a genuine cross-vendor review. The gate cannot
see that history — it sees only that claude is now the implementing host.

The operator was shown all of the above and explicitly accepted it. Because the
gate counts zero reviewers, `GSD_SKIP_REVIEWS=1` is required for **every** write
during implementation, not for a single step. That is a broader override than a
one-off escape hatch, and it is deliberate. It must stay visible in command and
commit output.

This override is scoped to the artifacts frozen at the hash below. If the
proposal, design note, spec delta, or task ledger changes materially, the
override lapses and a fresh review is required.

## Provenance

Frozen round-5 review packet: `/tmp/tailnet-ipv6-review-r5.b0fz1g/review-prompt.txt`
Packet SHA-256: `992ec6286bc553751873a52ed880b38283382ce889eadbe3d4fc1f6d18f54a73`
(re-verified 2026-07-28 before this record was written; matches the hash the
round-5 session recorded).

| Reviewer | Model | Started (UTC) | Duration | Exit | Outcome |
| --- | --- | --- | ---: | ---: | --- |
| claude | Claude Code 2.1.220, `opus[1m]` | 2026-07-28T15:25:56Z | 155s | 0 | APPROVE |
| gemini | `gemini-2.5-pro` | 2026-07-28T15:25:56Z | 12s | 1 | No output — free-tier quota `limit: 0` |
| opencode | `hf:moonshotai/Kimi-K3` | 2026-07-28T15:25:56Z | 300s | 4 | No output — timed out; two identical-prompt retries also timed out |

Neither failed provider produced a partial verdict. Their absence is a tooling
failure, not a silent disagreement. Both failure modes are transient
(a daily quota, a model timeout), so a later session can obtain the missing
reviews against this same packet hash without re-freezing the bundle.

### Superseded review record

An earlier `REVIEWS.md` recorded gemini and opencode approvals dated
2026-07-27. That record was taken **before `design.md` existed** and approved an
earlier policy — notably a spec delta that narrowed the CLI to exactly three
bind selectors, which later rounds reversed. It was replaced rather than
appended to, because carrying it forward alongside the current bundle would
have presented two stale approvals as current evidence. It remains in git
history.

## Reviewer: claude

## Review — round 5, `decide-tailnet-ipv6-policy`

### Verification performed against the bundle

**Semantic compatibility with the main spec.** The delta modifies `Bind Modes And Network Exposure` by exact requirement name — the same requirement the main spec carries, so no parallel requirement is created. Both original scenarios survive: `Tailscale bind detects the interface or fails gracefully` is split into `Tailscale bind setup failures are distinct` + `Tailscale bind detects the interface` (a strict tightening, not a drop), and `Binding all interfaces warns and enforces CIDR` is carried verbatim. The original normative clauses (default `127.0.0.1`, `--bind tailscale`, explicit address including `0.0.0.0`, enforcement of `100.64.0.0/10` on non-loopback binds, all-interfaces banner) are all still present and only narrowed. No other main-spec requirement is touched or contradicted.

**Non-widening claim.** Checked clause by clause: the accepted set is stated three times (proposal, design decision 1, requirement body) as `100.64.0.0/10` in dotted or mapped form, with normalisation before range classification. `::ffff:8.8.8.8 → outside-range` is pinned by both a scenario and a task, which is the specific test that would catch an accidental widening through the mapping strip. The out-of-scope list and task 4's final check both restate it. This holds.

**Enforcement-selection gap.** The pre-change behaviour (IPv6 literals falling through the loopback-equivalent branch) meant a non-loopback IPv6 bind ran *silently unenforced*. The change makes that either fail fast or require an explicit opt-out. That is strictly safer than today, not a relaxation, and the "does not do" list's claim that the opt-out flag and its default are untouched survives scrutiny.

**Non-observability.** The requirement forbids the class from any HTTP response *including to authenticated callers*, and pins it with a scenario asserting identical status, public code, and field set across classes. Task 2 has matching tests for both halves. The `requestId` is correctly identified as pre-existing (installed before CIDR middleware, already in the error envelope), so no new correlation surface is introduced — and task 1 pins the middleware ordering that makes this true.

**Task-to-scenario traceability.** I walked every scenario to a task. All 18 are reachable. The characterisation/TDD split is honest: task 1 is explicitly labelled green-on-first-run and carries no TDD flag, and the three genuinely new behaviours (classification, Tailscale setup distinction, IPv6 bind classification) each get a `Test first:` item. Design decision 4 explicitly justifies why the Tailscale distinction is RED/GREEN rather than characterisation.

**Honesty about cost.** The proposal states plainly that this declares a *supported* upstream Tailscale configuration unsupported by the daemon, and gives the concrete workaround. That is the right disposition for a change that closes a door.

### Non-blocking observations

Two narrow corners in the newly introduced classification rule, both fail-closed and neither reachable in the documented operating paths:

1. **Mapped-IPv4 bind literals.** `every other literal SHALL be classified as non-loopback` plus `any other non-loopback IPv6 literal … MUST fail before server startup` means `--bind ::ffff:100.64.0.5` is refused at startup, even though that bind *can* carry the admitted IPv4 path — which contradicts the stated rationale ("cannot carry the admitted IPv4 path"). The change normalises mapped form at admission but not at bind classification. The rule is determinate, so implementation isn't blocked; the rationale is just wider than the fact.

2. **`127.0.0.x` other than `127.0.0.1`.** Definitionally non-loopback under the new rule, so `--bind 127.0.0.2` starts cleanly with enforcement and can serve no peer at all — the exact "starts but serves nobody" outcome design decision 3 rejects for IPv6. Fail-closed and obscure, but the fail-fast principle is applied asymmetrically across address families.

Also minor: `Dual-stack wildcard :: SHALL start with enforcement enabled` reads unconditionally in the requirement body; the scenario's `without disabling CIDR enforcement` precondition is what resolves it against the opt-out. Worth a clause the next time this requirement is edited, not a reason to re-open now.

None of these change the accepted address set, weaken the boundary, or leave an implementer unable to proceed.

VERDICT: APPROVE

---

# Stage-3 implementation review (post-implementation, 2026-07-28)

The record above concerns the *plan* review, which the §18 gate counts as zero.
This section records the *implementation* review, which is separate — and which
found real defects, so it is the part of this file most worth reading.

Two independent reviewers examined the implemented diff. Both were given the
spec delta, design note and ADR, and neither was told what the other found. The
Codex pass was commissioned specifically because "no other-vendor review at all"
was this change's recorded weakness.

| Reviewer | Vendor | Scope | Verdict |
| --- | --- | --- | --- |
| code-reviewer | claude | Implementation, adversarial | 4 findings, no explicit verdict |
| codex | **codex** | Implementation, adversarial | **REQUEST-CHANGES** |

## What they found

They converged, from different directions, on **one root cause**:
`classifyExplicitBind`'s fallthrough **failed open**. Anything it did not
recognise was classified loopback, and loopback silently means no CIDR
middleware and no all-interfaces warning.

| # | Severity | Defect | Status |
| --- | --- | --- | --- |
| 1 | **Critical** (codex) | `--bind 0` (also `00`, `0000`) took the fallthrough; Node's `listen()` resolves `0` to `0.0.0.0`. Every interface, no boundary, no banner. | Fixed |
| 2 | **High** (codex) | `--bind ::1` / `::` built `http://::1:5193`. `writeServerInfo` validates with `z.string().url()`, which rejects it — so the two IPv6 modes this change *added* threw after the listener was already accepting connections. | Fixed |
| 3 | Important (claude) | `::0`, `0:0:0:0:0:0:0:0` and the expanded form escaped the all-interfaces path, because the wildcard was matched by string equality against `'::'`. With the opt-out: all interfaces, unenforced, unwarned. | Fixed |
| 4 | Important (claude) | `getTailscaleIP` validated against the boundary unconditionally, overruling `--no-enforce-cidr` and regressing control servers on a custom IPv4 prefix. Its message never mentioned the flag. | Fixed |
| 5 | Important (claude) | Nothing tested the `runStart` wiring, which is where "fail before startup" actually lives — and which is why 1 and 2 passed every unit test. | Fixed: `bind-wiring.subprocess.test.ts` runs the real CLI |
| 6 | Medium (both) | The refusal diagnostic is a synchronous pre-auth `stderr` write per refused request: unbounded log growth, event-loop blocking, and a possible statistical timing oracle. | **Open — see below** |

Both reviewers independently confirmed the two claims that matter most:
**the accepted address set did not change** (codex traced it; the claude
reviewer ran a 1.4M-case differential fuzz of the old and new predicates and
found zero disagreements), and **the refusal class does not leak** over HTTP.

## Verification of the reviewers' claims

Their findings were reproduced before being acted on, not taken on trust:
`node listen('0')` binds `0.0.0.0`; `net.isIPv6` accepts `::0`,
`0:0:0:0:0:0:0:0` and `0000:…:0000` while none is `=== '::'`; and
`z.string().url()` rejects every unbracketed IPv6 authority and accepts the
bracketed form.

## Open item carried forward

Finding 6 is **not fixed**. The spec mandates recording the class but says
nothing about volume, so this is a design decision rather than a defect, and it
is recorded here rather than silently resolved. Options are sampling, a
periodic per-class counter, or accepting it. It needs an explicit ruling before
this ships.

## What this does and does not settle

This is a genuine cross-vendor review, and it is the first independent scrutiny
this change received. It does **not** retire the §18 override: that gate wants
≥2 independent reviewers on the *plan*, before code, and this review happened
after. What it does establish is that the implementation was reviewed by another
vendor, that the review found two serious defects the author did not, and that
those defects are fixed and pinned by tests.
