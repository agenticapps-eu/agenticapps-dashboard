## REMOVED Requirements

> **The question survives; the answer form does not.** "Are the implementations
> conformant?" is now asked of the four host workflows and answered by a version
> comparison with byte-identity checks, in `workflow-fleet-conformance`. What is
> withdrawn is the weighted score over coverage columns, its tiers, its trend
> chart, and its family cards. The new capability is deliberately **not** named
> `fleet-conformance`, so that one word does not carry two concepts in one slot.

### Requirement: Equal-Weight Conformance Scoring

**Reason**: The score's inputs were the coverage columns, which are withdrawn. It
also demonstrated the failure v2 designs against: a number that moves for reasons
nobody can reconstruct and that nobody can map back onto an action — and one
whose value changes retroactively whenever the input set changes. v2 shows six
states and lets the reader count.

**Migration**: No score replaces it. The fleet surface sorts by count of `fail`
then `never`, which recovers the one thing the score was used for.

### Requirement: Drifted Repos Excluded From Scoring

**Reason**: An exclusion rule for a score that no longer exists.

**Migration**: None. In v2 a drifted repo is not excluded from anything; its
`workflow` check reports the drift, which is the point.

### Requirement: Conformance Tiers

**Reason**: Tiers bucket the withdrawn score. Bucketing a number nobody can act
on produces a label nobody can act on.

**Migration**: None. Six per-check states carry more information than three
tiers, without an intermediate number.

### Requirement: Conformance Endpoint

**Reason**: Serves the withdrawn score and tiers.

**Migration**: The route is removed. `workflow-fleet-conformance` exposes a
version matrix over the five workflow repos, which is a different response for a
different question.

### Requirement: Fleet Trend Chart

**Reason**: A 90-day series over the withdrawn score. v2 keeps no fleet-wide time
series: the temporal signal that proved useful is per-check staleness — whether a
review predates the code it reviewed — and that is carried on each check rather
than aggregated into a curve.

**Migration**: No chart replaces it. Historical snapshots are left in place and
become inert.

> This is also why `remove-gitnexus-integration` was descoped. That change
> devoted its first and largest task block to recomputing this chart's history so
> a removed column would not read as a fleet-wide improvement. **The analysis was
> correct and remains correct** — an uncorrected cutover would have written a
> measurement change into the chart as a health change, permanently. The measure
> is dropped only because the chart it protects is withdrawn here, leaving the
> recomputation with no consumer. The reasoning is preserved in that change's
> proposal so the descope reads as a decision rather than a missed task.

### Requirement: Chart Reveal Across Input Modalities

**Reason**: An interaction contract for the withdrawn chart.

**Migration**: None.

### Requirement: Honest Cold-Start States

**Reason**: The honesty principle it encoded is the most important thing this
capability contributed, and it is not being withdrawn — it is being promoted.
`repo-readiness` states it as a standing invariant across all six checks: absent
data is never rendered as a passing or zero value. What is withdrawn is its
narrow expression as the chart's cold-start behaviour.

**Migration**: Superseded by `Absent Data Is Never Rendered As A Passing Or Zero
Value` in `repo-readiness`, which binds more broadly than this requirement did.

### Requirement: Chart Accessibility

**Reason**: An accessibility contract for the withdrawn chart. The general
principle survives and is strengthened: `design-system` gains a standing
requirement that state is never signalled by colour alone, which applies to every
surface rather than to one chart.

**Migration**: Superseded by the non-colour-dependence requirement in
`design-system`.

### Requirement: Path Drift Panel

**Reason**: A panel on the conformance page, which is withdrawn. Path drift
detection itself is **not** withdrawn — it lives in `project-registry`, which v2
leaves untouched.

**Migration**: Detection and repair remain available through the registry
surface. Only the panel on the conformance page goes.
