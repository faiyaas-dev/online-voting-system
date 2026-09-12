## Purpose
Parses uploaded voter CSV files and captures row-level import errors without failing entire valid batch ingestions.

## ADDED Requirements

### Requirement: Row-level error isolation
The system SHALL insert valid CSV voter rows into the roster table while routing invalid or malformed rows into roster_import_errors.

#### Scenario: Malformed row isolation
- **WHEN** an admin uploads a CSV where a row is missing a required department field
- **THEN** valid rows are imported into roster and the malformed row is logged in roster_import_errors with the failure reason.
