# candidate-photos Specification

## Purpose
Stores and delivers candidate photographs via Supabase Storage with strict row-level security governing visibility across candidate nomination statuses.

## Requirements

### Requirement: Status-gated photo visibility
The system SHALL keep uploaded candidate photos private during pending status and publicly accessible once candidates are approved.

#### Scenario: Pending photo privacy
- **WHEN** an unauthenticated user or unrelated voter attempts to read a pending candidate photo
- **THEN** access is denied by the storage policy.

#### Scenario: Approved photo visibility
- **WHEN** any voter loads ballot details for an approved candidate
- **THEN** the candidate photo is publicly readable and displayed.
