# voting Specification

## Purpose
Guarantees election integrity by enforcing single-vote casting per voter per election at the database level during active voting windows.

## Requirements

### Requirement: Single vote uniqueness
The system SHALL strictly prohibit double-voting through a database UNIQUE constraint on (voter_id, election_id).

#### Scenario: Rejection of double vote attempt
- **WHEN** a voter who has already cast a ballot attempts to submit a second vote in the same election
- **THEN** the database rejects the insert with a unique constraint violation error.

### Requirement: Active voting window enforcement
The system SHALL reject vote inserts unless the target election is in voting_open status.

#### Scenario: Rejection of vote on non-open election
- **WHEN** a voter attempts to cast a vote on an election in draft, nomination_open, or closed status
- **THEN** the Row Level Security policy rejects the vote insert.
