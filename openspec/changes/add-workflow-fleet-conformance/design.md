# Design notes — workflow fleet conformance

## 1. Why this is not called `fleet-conformance`

The name is taken, by a capability this plan withdraws. The old
`fleet-conformance` is an equal-weight score over coverage columns, with tiers, a
90-day trend chart, and family cards. This one is a version comparison with no
score at all.

The *question* survives — are the hosts conformant? — but the *answer form* does
not. Reusing the name would leave two different concepts under one word in the
same spec slot, which is the most reliable way to misread it six months later.
The same reasoning applies to `coverage`, which in v2 means test coverage and no
longer means tooling coverage; that is why the readiness capability is not called
`fleet-coverage` either.

## 2. Why three numbers per host and not one

**Rejected: report `implements_spec` from the primary skill.**

Measured 2026-07-26: every host reports the same value there. On that evidence
the fleet is uniformly current. It is not — three of four hosts carry skills
several minor versions behind, and one host carries six of them. The single
number is not wrong, it is just answering a narrower question than the one it
appears to answer.

**Chosen: primary, minimum, maximum, plus the laggards by name.** The range is
what makes the drift visible at a glance; the names are what make it actionable.
A range alone tells you something is behind without saying what.

## 3. Why byte identity rather than version headers

A host can carry `# gate-version: 1.2.2` in a file whose bytes differ from the
core reference. The version marker is a claim; the hash is a check. The failure
this guards against is a host that hand-merges an update instead of vendoring it,
which produces exactly that signature: correct header, divergent content.

At the time of writing all four hosts are byte-identical for the gate, the
reviewer CLI, and the conformance harness. The scanner must report that as green.
If it does not, the scanner is wrong and the fleet is fine — worth stating,
because the temptation when building a drift detector is to trust the detector
over the measurement.

## 4. Why the vendor header gets its own row even though nothing is broken

Byte identity currently holds. But it holds without any recorded provenance: no
host names the core commit its artefacts came from, although a host's own spec
requires it as a SHALL. So the fleet is correct by coincidence rather than by
construction, and nothing would detect the moment that stopped being true.

A row that reads "missing" across all four hosts while everything else reads
green is exactly the kind of quiet finding this page exists to produce.

## 5. The harness execution decision

**Rejected: run the harness on page load.** It builds fixture repos and stubs a
CLI on the path. Seconds per host, four hosts, every render. Unacceptable.

**Rejected: don't run it from the dashboard at all** — keep it a terminal tool
and show only versions and hashes.

This was seriously considered, because it is the only option that leaves the
security spine untouched, and it was put to the user as such. It was rejected in
favour of widening the spine under explicit bounds: the harness result is the
only signal that distinguishes "the gate file is identical" from "the gate
behaves correctly", and byte identity alone cannot tell you the gate works.

**Chosen: on-demand, bounded, with an aged cache.** The bounds are requirements,
not implementation notes, because they are the entire justification for the
exception.

**Why age alone is not enough for cache invalidation.** A harness result from
three days ago against a gate that was re-vendored yesterday is worse than no
result — it reads as current evidence for a file that no longer exists. So the
cache is keyed on the checked file's content, and age is displayed rather than
used as the invalidation rule.

## 6. Why no version numbers appear in any requirement

Every measured value in this project was taken on one day. A requirement that
says "core spec is 1.0.0" is a measurement wearing a guarantee's clothing: it
becomes false the next time core releases, and a spec that carries a stale
measurement as fact is worse than one carrying no numbers.

So the requirements below specify comparisons — maximum across sections, range
across skills, equality against the reference — and the numbers live in the
scanner's output where they belong.

## 7. Why the page stays quiet when everything is green

Shared artefacts are currently all green. The page should look unremarkable when
that is true. Its value is that a glance is *possible*, not that it congratulates
anyone — an instrument panel, not a scoreboard. This is a design constraint
rather than a product guarantee, so it is recorded here and not as a requirement.
