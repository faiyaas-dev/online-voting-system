# platform-admin Specification

## Purpose
Delivers cross-institution system oversight via aggregate metrics RPC while preventing platform admin access to raw voter ballots or sensitive personal identifiable information.

## Requirements

### Requirement: Cross-tenant aggregate metrics
The system SHALL provide a get_platform_metrics RPC returning tenant counts, total elections, and vote totals exclusively to platform_admin users.

#### Scenario: Platform admin views global metrics
- **WHEN** a user with role platform_admin calls get_platform_metrics
- **THEN** aggregate cross-tenant statistics are returned without leaking raw table rows.

#### Scenario: Non-platform admin access denied
- **WHEN** an institution_admin or voter calls get_platform_metrics
- **THEN** the RPC raises an access denied exception.
