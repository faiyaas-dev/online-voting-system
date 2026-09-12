## Purpose
Manages multi-level election lifecycles with granular department and academic year eligibility scoping.

## ADDED Requirements

### Requirement: Scoped election creation
The system SHALL support creating institution-wide elections as well as elections scoped to specific departments and academic years.

#### Scenario: Department and year scoped election
- **WHEN** an admin creates an election specifying department and year limits
- **THEN** only voters matching both department and year criteria are granted view and vote access.

### Requirement: Election lifecycle states
The system SHALL restrict elections to defined lifecycle states: draft, nomination_open, voting_open, and closed.

#### Scenario: Status transition enforcement
- **WHEN** an election status is transitioned by an authorized admin
- **THEN** downstream capabilities (nominations, voting, results) dynamically adapt based on the active state.
