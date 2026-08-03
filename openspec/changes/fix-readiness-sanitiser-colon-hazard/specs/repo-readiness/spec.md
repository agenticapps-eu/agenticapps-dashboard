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
the reader's only handle on what to fix, and SHALL survive into the reported text
— including when its own characters make it resemble an absolute path. A
repo-relative path may legally contain a colon, so a detector working on rendered
text cannot always separate the two. Where it cannot, the ambiguity SHALL be
resolved by withholding the reference, and never by withholding the response.

**A message the daemon cannot certify SHALL degrade alone.** Where text built
from author-controlled input fails the outbound check, the daemon SHALL
substitute text it can certify and answer normally. The complete reference SHALL
remain on the same result in a field carrying no such restriction, so that
withholding it from one message never removes it from the surface. This obligation
binds every message built from author input, including the repo-level notice
raised when a citation cannot be verified.

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
- **WHEN** the daemon substitutes certifiable text for a message naming an author-supplied path
- **THEN** that check's summary still carries the full path
- **AND** the substituted text names no path rather than a misleading one.
