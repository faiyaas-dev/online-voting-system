# department-admin Specification

## Purpose
Enables decentralized election governance by empowering department administrators to manage elections and candidates within their specific department.

## Requirements

### Requirement: Department-scoped election management
The system SHALL authorize department administrators to create and manage elections only when scoped to their assigned department.

#### Scenario: Authorized department election creation
- **WHEN** a department admin for Mathematics creates an election with scope_department set to Mathematics
- **THEN** the election record is successfully created.

#### Scenario: Unauthorized cross-department election attempt
- **WHEN** a department admin for Mathematics attempts to create an election for Physics
- **THEN** the RLS insert policy rejects the operation.
