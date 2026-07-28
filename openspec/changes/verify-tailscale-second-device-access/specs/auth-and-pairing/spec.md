## ADDED Requirements

### Requirement: Concurrent Multi-Device Pairing

A single daemon token SHALL support more than one browser retaining pairing at
the same time. Pairing state remains client-side: the daemon MUST NOT track a
device roster, as a deliberate stateless-token invariant, and one browser
storing the token MUST NOT invalidate another browser's stored token. Every
browser holding the current token SHALL read from the same registry source; this
does not promise byte-identical responses across cache or timing boundaries.

#### Scenario: Two browsers retain pairing independently
- **WHEN** two browsers independently store the same current daemon token
- **THEN** both can read the dashboard and the same registry
- **AND** clearing the pairing entry from one browser's local storage does not alter the other browser's storage or current-token access.

#### Scenario: No device roster is created
- **WHEN** one or more browsers pair using the current bearer token
- **THEN** structural inspection finds no daemon-side device identity, roster, or per-device revocation record
- **AND** authorisation remains a check of the presented current token.

#### Scenario: Rotation re-pairs every device
- **WHEN** the token is rotated while several devices are paired
- **THEN** every paired device shows the re-pair prompt on its next request
- **AND** no device continues to read data with the superseded token.

#### Scenario: An offline browser observes rotation when it returns
- **WHEN** a browser is offline while the daemon token is rotated
- **THEN** no daemon-side device update is required
- **AND** its first later request with the superseded token receives the same re-pair response as any other stale browser.

#### Scenario: A current token restores access after rotation
- **WHEN** a device invalidated by rotation receives a newly generated current-token pair URL
- **THEN** it pairs successfully.
