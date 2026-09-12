# Proposal: Voting Platform V1

## Why
Educational institutions need a secure, multi-tenant SaaS platform to run decentralized student elections without the operational overhead of managing physical ballots or insecure third-party forms. Currently, institutions lack self-serve tooling that enforces strict eligibility (by department and year), prevents double-voting at the database level, and maintains verifiable isolation across colleges.

## What Changes
- Implement multi-tenant institution onboarding and CSV roster import with row-level error logging.
- Provide passwordless OTP authentication matching users against uploaded rosters.
- Enable multi-level elections (institution-wide or scoped by department/year) with status lifecycle controls (`draft`, `nomination_open`, `voting_open`, `closed`).
- Implement candidate self-nomination and admin approval workflows with optional candidate photo uploads.
- Enforce strict voting integrity: exactly one vote per voter per election enforced by database unique constraints and RLS status gating.
- Implement encrypted/locked tally results via secure RPC (`get_election_results`), preventing early leaks until election closure.
- Establish three-tier administrative hierarchy (Platform Admin, Institution Admin, Department Admin).

## Capabilities

### New Capabilities
- `tenant-management`: Multi-tenant institution registration and voter roster management.
- `authentication`: Passwordless OTP authentication and roster profile claiming.
- `elections`: Multi-level election creation and lifecycle status management.
- `nominations`: Candidate self-nomination and administrative review.
- `voting`: Tamper-proof vote casting with database-enforced integrity.
- `results`: Aggregated tally retrieval locked until election closure.
- `department-admin`: Department-scoped administrative governance.
- `platform-admin`: Cross-institution aggregate operational metrics RPC.
- `roster-import`: CSV parsing with row-level validation error tracking.
- `candidate-photos`: Candidate photo storage with status-gated public visibility.

### Modified Capabilities

## Impact
- Core database schema and RLS policies on Supabase Postgres (`institutions`, `profiles`, `roster`, `elections`, `candidates`, `votes`, `roster_import_errors`).
- Supabase Storage bucket `candidate-photos` with row-level security.
- Frontend Next.js App Router application and automated test suites.

