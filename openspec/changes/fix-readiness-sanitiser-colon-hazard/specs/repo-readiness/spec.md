## MODIFIED Requirements

### Requirement: Absent Data Is Never Rendered As A Passing Or Zero Value

A check that has not run SHALL be reported as `never` and MUST NOT be rendered as
`0 %`, as an empty-but-passing state, or as a green indicator.

A check that could not be evaluated because of an error SHALL carry a dedicated
structured error marker on the result, distinct from its status, so that
"evaluation failed" is distinguishable from "never ran" **without parsing prose**.
Error text SHALL be free of absolute filesystem paths and of any credential
material. Every error-bearing result SHALL use status `fail`. In sorting, it
contributes to the evaluation-error count and is excluded from the ordinary
`fail` count, so one result is never counted twice.

**Keeping absolute paths off the wire SHALL NOT be achieved by discarding
repo-relative ones.** A path the daemon has already validated as repo-relative is
the reader's only handle on what to fix. Where the daemon can certify the
rendered text, that path SHALL survive into it — including when the path's own
characters make it resemble an absolute one, which a repo-relative path may
legally do by containing a colon.

Detection on rendered text cannot separate the two in every case, and the
exceptions are stated rather than left to the implementation. A citation whose
**first** segment carries the colon is indistinguishable from an interpolated
absolute path and SHALL still be withheld, as is a leak appearing later in a
whitespace-delimited token that already contains a path separator. Both are
resolved by withholding the reference, never by withholding the response.

The prohibition on credential material is not subject to this survival
obligation. Where a reference itself carries credential material, the
prohibition takes precedence and the reference SHALL NOT be reproduced on any
field, restricted or not.

**A message the daemon cannot certify SHALL degrade alone.** Where text built
from author-controlled input fails the outbound check — for its shape **or for
its length** — the daemon SHALL substitute text it can certify and answer
normally. Certification SHALL be against the field's own schema rather than any
narrower rule: the length bound is reachable by a maximal path containing no
suspicious character at all, so a guard that checks only the path rule leaves the
response as exposed as no guard would.

This obligation binds every message built from author input — the per-check
error, the coverage check's artifact errors, and the repo-level notice — not
only the sites that first exhibited the fault.

Substitution is distinct from the reduction required above for a deriver's own
absolute path. Reduction rewrites a known absolute path down to a repo-relative
or symbolic reference; substitution replaces text whose reference cannot be
certified at all. A reader sees a repo-relative reference in the first case and
no reference in the second.

Where the withheld reference belongs to a check, that check's summary SHALL
retain it so far as that field's own length bound permits. A citation near the
path maximum is truncated there too: the guarantee is that the response
survives, not that every reference is recoverable from every field. The
repo-level notice has no sibling field of its own — the reference it withholds
remains on the result of the check that declared it.

#### Scenario: Missing coverage data is not zero percent
- **WHEN** a repo has no coverage artifact
- **THEN** the coverage check reports `never`
- **AND** the fleet row shows an absence marker rather than `0 %`.

#### Scenario: An evaluation error is not silent success
- **WHEN** a deriver throws while evaluating a check
- **THEN** that check reports `fail` and carries the structured error marker together with an explanatory summary
- **AND** it is never reported as `ok`.

#### Scenario: An error is machine-distinguishable from never-run
- **WHEN** one check has never run and another failed to evaluate
- **THEN** the two are distinguishable by the presence of the error marker alone
- **AND** neither requires reading the summary text to tell them apart.

#### Scenario: Error text carries no paths or secrets
- **WHEN** a deriver's failure produces an error message containing an absolute path or credential material
- **THEN** the reported error text is reduced to a repo-relative or symbolic reference
- **AND** no credential material reaches the response.

#### Scenario: A repo-relative path resembling an absolute one still reaches the reader
- **WHEN** a declared check cites the legal repo-relative evidence path `docs/notes:/Users/x.md` and that citation cannot be verified
- **THEN** the check's error text names that path
- **AND** the response is validated and sent rather than refused.

#### Scenario: An uncertifiable message never withholds the fleet
- **WHEN** a registered repo's readiness file cites an evidence path whose rendered message the daemon cannot certify
- **THEN** the fleet response is answered with every registered repo present
- **AND** that repo's own checks are still reported.

#### Scenario: A withheld reference is still reachable
- **WHEN** the daemon substitutes certifiable text for a check's error naming an author-supplied path that is shorter than the summary's length bound
- **THEN** that check's summary still carries the full path
- **AND** the substituted text names no path rather than a misleading one.

#### Scenario: A maximal path defeats the guard by length, not by shape
- **WHEN** a declared check cites an evidence path at the path schema's maximum length, containing no colon and no character that resembles an absolute path
- **THEN** the rendered message exceeds the sanitised field's length bound and is substituted rather than sent
- **AND** the response is answered rather than refused.

#### Scenario: The configured coverage path is guarded like any other author input
- **WHEN** a repo configures a coverage artifact path the daemon cannot certify in a rendered message, and reading that artifact fails
- **THEN** the coverage check reports its failure with substituted text
- **AND** the response carrying it is answered rather than refused.
