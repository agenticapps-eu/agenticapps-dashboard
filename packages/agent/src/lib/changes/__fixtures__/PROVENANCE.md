# Change-board fixture provenance

Two sets, captured for different reasons. Neither is invented: a parser test
whose input was written to suit the parser proves nothing about the corpus.

## `active/` and `archive/` — mirrored from upstream

Byte-for-byte copies of `agents-task-viewer/src/openspec/__fixtures__`, which
are themselves captures from real OpenSpec changes. They exist here so the
conformance test (task 2.9) runs *the same bytes* through upstream's
`classifyActiveChange` and this board's `stage.ts`. Their SHA-256 values are
asserted before and after each read, exactly as upstream's `fixtures.test.ts`
does, so a parser test cannot silently rewrite its own evidence.

Mirrored 2026-08-03 from `agents-task-viewer` at
`d3ad90825948bd76fabc3e856d84077a5fd0398f`. The fixture tree itself last changed
upstream at `ce2d8458666db165dfd40dd0a2839b638e9b8f45` (2026-07-27).

Every hash below was verified equal to the value recorded in upstream's own
`__fixtures__/PROVENANCE.md` at capture time.

| Fixture path | SHA-256 |
| --- | --- |
| `active/openspec-lifecycle-board/.openspec.yaml` | `0db77a840c2a2356d82ebc1671bdddcc1cf7e075820f3837796105c53dfb739a` |
| `active/openspec-lifecycle-board/proposal.md` | `fedbb4924ef77be80893811a4f7ffdc023bc0033bc029216e4a59eac00c6e405` |
| `active/openspec-lifecycle-board/tasks.md` | `8c91a6efc8c92fd93d9b63d828e5232d32f64bcf436ab08c6b95a8ce3dadf3f0` |
| `active/openspec-lifecycle-board/REVIEWS.md` | `899e17510de3979ba6575f24f1765c7137088cfbc3cab77f6eceea4c21fe5b7c` |
| `active/openspec-lifecycle-board/specs/board-view/spec.md` | `f8bbf8fdd7347439d7f613165ffc622878b921283e30193f3e8a6694b5bf45c0` |
| `archive/2026-07-27-add-openspec-project-reader/.openspec.yaml` | `b47c76ffc72f324b3fb564eccb7cfee036d1f3a5424641dff2e67a7e0e74e2f5` |

## `real/` — this repository's own review records

Upstream's fixtures do not contain the two shapes this board had to get right,
because upstream does not produce them. Both are copied from this repository at
`8bfe2819c8ce20a35b6294d5be84916b0262664f`, unmodified.

| Fixture path | Source | Why it is here | SHA-256 |
| --- | --- | --- | --- |
| `real/retire-v1-surfaces-REVIEWS.md` | `openspec/changes/retire-v1-surfaces/REVIEWS.md` | The veto case. Two approvals (claude, opencode) and two requests for changes from two *other* reviewers (gemini, codex). Latest-verdict filtering counts two distinct approvals and advances it; the veto holds it at `validate`. This is the record that refuted the rule's first draft | `f776cda8fbfebf084ab0d1e953cc76479721ff8b230dca8217ab1ae093065dcd` |
| `real/close-readiness-spec-gaps/REVIEWS.md` | `openspec/changes/archive/2026-08-02-close-readiness-spec-gaps/REVIEWS.md` | The staleness case. A `REVIEWS.md` sitting beside three round records, with a *different* verdict set from every one of them | `0e079d572721b9a1b481e461725ba2cafeb55c765dfc2a11f44eba1a6ff50a55` |
| `real/close-readiness-spec-gaps/REVIEWS-round-1.md` | same directory | gemini APPROVE, codex REQUEST-CHANGES, opencode REQUEST-CHANGES | `92c85556965cca610cc49bd99db8ea6931fd8822a95539134ed80e2f91b7efdf` |
| `real/close-readiness-spec-gaps/REVIEWS-round-2.md` | same directory | three requests for changes | `ad7ccfb8bf6402fc41845a12eb6fe717b786c186297b0c8fa8b29e68e51ec7e0` |
| `real/close-readiness-spec-gaps/REVIEWS-round-3.md` | same directory | gemini APPROVE, codex and opencode REQUEST-CHANGES | `5c9c05bf1c7e513eac0b1f4307b187f197c1a5abe9f0c13d64b0636be246dc27` |
| `real/BACKLOG.md` | `openspec/BACKLOG.md` | The backlog case. Its two closed entries were corrected to upstream's marker convention by task 8.4 rather than the matcher being loosened to fit them; the third stays open. Two of its headings — `Redone migration`, `Add WITHDRAWN flag support` — contain marker words without being closed, which is the pair a substring test wrongly closed | `804de5db6700168d00d89acdeadc92c10175cbe81ccb9c98b213cc56c9e5d649` |

A `real/` fixture drifting from its source is not automatically a failure — the
source is a live document. It is a prompt to re-read the source and decide
whether the case the fixture pins still exists.
