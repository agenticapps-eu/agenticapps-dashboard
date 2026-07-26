## ADDED Requirements

### Requirement: Scan Actions Report Progress And Outcome

Every scan action SHALL give the user visible feedback that it started, that it
is running, and how it finished. A scan that produces no visible change MUST NOT
be indistinguishable from a control that did nothing.

#### Scenario: A family scan shows it is running
- **WHEN** a user triggers a family-scoped scan
- **THEN** the surface indicates within one interaction cycle that the scan started
- **AND** shows a running state until the scan settles.

#### Scenario: A scan reports how it finished
- **WHEN** a scan completes, fails, or is refused
- **THEN** the outcome is reported to the user
- **AND** a failure states the reason rather than silently reverting to the idle state.

### Requirement: Scans Handle Repos Absent From The Registry

The coverage matrix surfaces repos discovered by walking the family roots, which
may not be registered. A scan action on such a repo SHALL either succeed without
requiring registry membership, or be refused with a message naming registration
as the remedy. It MUST NOT fail opaquely.

#### Scenario: An unregistered but visible repo is handled explicitly
- **WHEN** a user triggers a per-repo scan on a repo present in the coverage matrix but absent from the registry
- **THEN** the scan either runs to completion or is refused with a message naming registration as the remedy
- **AND** the user is never left with an unexplained failure.
