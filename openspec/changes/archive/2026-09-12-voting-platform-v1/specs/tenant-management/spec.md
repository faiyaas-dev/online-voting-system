## Purpose
Provides multi-tenant institution registration and maintains voter eligibility rosters with strict cross-tenant data isolation.

## ADDED Requirements

### Requirement: Institution self-serve onboarding
The system SHALL allow institution administrators to create new institution tenants with unique slugs via server-side RPC.

#### Scenario: Successful institution creation
- **WHEN** an administrator submits an institution name, slug, and admin email
- **THEN** an institution record and associated institution_admin profile are created atomically.

### Requirement: Voter roster maintenance
The system SHALL maintain a tenant-scoped eligibility roster mapping roll numbers, emails, departments, and academic years.

#### Scenario: Roster record isolation
- **WHEN** an institution admin views the voter roster
- **THEN** only roster entries belonging to their specific institution_id are returned.
