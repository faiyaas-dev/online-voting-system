# nominations Specification

## Purpose
Handles candidate self-nomination submissions and administrator approval workflows prior to ballot publication.

## Requirements

### Requirement: Candidate self-nomination
The system SHALL permit eligible voters to self-nominate with a manifesto when an election is in nomination_open status.

#### Scenario: Eligible candidate self-nominates
- **WHEN** an eligible voter submits a self-nomination while status is nomination_open
- **THEN** a candidate record is created in pending status.

### Requirement: Admin nomination review
The system SHALL require institution or department administrators to approve or reject candidate nominations before they appear on ballots.

#### Scenario: Admin approves candidate
- **WHEN** an admin approves a pending candidate
- **THEN** candidate status transitions to approved and candidate becomes visible on the voter ballot.
