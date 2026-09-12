# results Specification

## Purpose
Provides aggregate ballot tallies locked until election closure, preventing leakage of raw vote records and premature outcomes.

## Requirements

### Requirement: Locked results before closure
The system SHALL lock election tally results from public viewing while an election remains in draft, nomination_open, or voting_open status.

#### Scenario: Unauthorized results access during voting
- **WHEN** a voter requests tally results for an active election whose status is voting_open
- **THEN** the RPC raises an exception stating results are locked until closure.

### Requirement: Aggregated tally computation
The system SHALL return aggregate vote tallies per candidate via get_election_results RPC without exposing raw individual voter ballot rows.

#### Scenario: Results retrieval for closed election
- **WHEN** any authorized user queries get_election_results for a closed election
- **THEN** candidate IDs and their respective aggregated vote totals are returned.
