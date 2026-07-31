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

## 4b. Pinning is a third model, and §4's argument now cuts the other way

§4 above says the fleet is *"correct by coincidence rather than by
construction"* — byte identity holds, but nothing records why it should keep
holding. On 2026-07-31 `claude-workflow` supplied exactly the construction §4
asked for, and it did so by removing the thing this plan measures.

ADR-0047 replaced the vendored copies with a pin: `tools/core-vendor.manifest`
names one `core_commit` and a `sha256` per file, `bin/resolve-core-artifact.sh`
turns that into verified bytes, and `install.sh` publishes those. The copies in
`bin/` are gone. The reasoning recorded upstream is that the runtime never read
them — the project hook resolves `~/.agenticapps/bin` first — so they existed
only to feed the installer, and they drifted: on 2026-07-28 the gate shipped
1.2.2 → 1.3.0 → 1.3.1 → 1.4.0 in a single day, twelve mechanical re-vendor PRs
across four repos.

**Rejected: treat the absence as a missing artefact.** It is what the scanner
does today, and it inverts the surface's meaning — the host with the strongest
provenance story scores worst, and a reader who trusts the page would "fix" it by
re-vendoring, which is the drift mechanism ADR-0047 removed.

**Rejected: treat it as explained divergence under §8.** §8 is right and stays:
an ADR does not make older or patched bytes current. But this is not older bytes.
There are no local bytes at all, and the installer publishes the reference bytes
at a named commit. §8 governs a *copy that differs*; this is *no copy, resolved
on demand*. Collapsing the two would make §8 mean "any upstream decision we
disagree with", which is not what it says.

**Chosen: a third state, verified rather than believed.** Pin integrity is the
comparison — one commit covering every entry, every published artefact listed,
every digest matching the reference bytes the scanner already reads. That last
clause is the load-bearing one: a manifest is a claim in exactly the way a
version header is a claim, and §3 exists because this surface does not accept
claims. A self-consistent manifest whose digests do not match the reference is a
finding, and it is a *better* finding than the missing-file one it replaces,
because it catches a stale pin — the real failure mode of this model.

Vendoring is not deprecated here. Three hosts still vendor, and two of them
(`pi`, `opencode`) carry gate 1.3.1 against core's 2.0.0, which is a true
divergence finding and must keep reading as one. Scoring a vendoring host as
deficient for not having migrated would be this dashboard asserting a fleet
policy it does not own, against a migration nobody has scheduled.

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
exception. The daemon executes only a harness whose bytes match the core
reference; a divergent harness is a finding, not trusted test code. Each run gets
a fresh private scratch child with a disk cap and unconditional cleanup, while
the result cache is the only retained daemon state.

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

## 8. Intentional divergence is annotated, not suppressed

**Rejected: an allow-list that turns approved drift green.** Conformance answers
whether a host matches current core. An ADR may make an older or patched copy a
sound local choice, but it does not change that comparison. The surface may link
the explanation; it still reports the measured divergence.

## 9. Cache identity includes the test contract

The checked artifact and harness are necessary but not sufficient when the core
reference or runner contract changes independently. The cache fingerprint
therefore covers four inputs: tested artifact bytes, harness bytes, core
reference bytes, and a runner-contract version covering the fixed environment
and bounds. A change to any input invalidates the result.

## 10. Provenance presence is not historical verification

This change reports whether a host recorded a syntactically valid core commit.
It does not resolve arbitrary historical objects or compare bytes at that
commit, because doing so would require widening the bounded git capability. The
current-copy byte comparison remains independent and authoritative for content.

## 11. The write exception is explicit

The harness route may mutate only `~/.agenticapps/dashboard/workflow-harness/`.
Result files inherit the daemon's private mode discipline; scratch children are
fresh, bounded, and removed. `openspec/config.yaml` and the filesystem capability
name the same exception so the architectural constraint and durable spec cannot
disagree.
