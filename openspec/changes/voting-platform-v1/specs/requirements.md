# Requirements and Scenarios

## 1. Must-Have Requirements

### 1.1 Multi-Tenant Foundation & Roster
**Requirement**: The system must support multiple institutions, with voters mapped to institutions via a pre-uploaded CSV roster.
- **Scenario**: Roster verification
  - **Given** an institution admin has uploaded a roster containing voter V
  - **When** voter V logs in via OTP
  - **Then** their profile is created/linked securely and their department/year is populated from the roster.

### 1.2 Authentication
**Requirement**: Users must authenticate via passwordless OTP/magic links.
- **Scenario**: Unregistered voter attempts login
  - **Given** a user whose email is not on any institution's roster
  - **When** they attempt to log in
  - **Then** the OTP succeeds but the `claim_voter_profile` RPC rejects them with an "Email not found" error.

### 1.3 Multi-Level Elections
**Requirement**: Elections can be institution-wide or scoped by department/year.
- **Scenario**: Voter views elections
  - **Given** an active institution-wide election and a department-scoped election for "Computer Science"
  - **When** a "Mechanical Engineering" voter logs in
  - **Then** they see the institution-wide election but NOT the "Computer Science" election.

### 1.4 Nominations
**Requirement**: Candidates self-nominate and admins approve them.
- **Scenario**: Candidate self-nomination
  - **Given** an election is in `nomination_open` state
  - **When** an eligible voter submits a self-nomination
  - **Then** a candidate record is created with `status = 'pending'`.

### 1.5 Voting Integrity
**Requirement**: One vote per voter per election, enforced by the DB. Votes only allowed when `voting_open`.
- **Scenario**: Double voting attempt
  - **Given** a voter has already cast a vote in an open election
  - **When** they attempt to vote again
  - **Then** the database rejects the insert due to a UNIQUE constraint violation.
- **Scenario**: Voting in a closed election
  - **Given** an election is in `closed` state
  - **When** an eligible voter attempts to cast a vote
  - **Then** the database RLS policy rejects the insert.

### 1.6 Results Visibility
**Requirement**: Results are hidden until the election is closed.
- **Scenario**: Viewing open election results
  - **Given** an election is in `voting_open` state
  - **When** a voter attempts to query `get_election_results`
  - **Then** the RPC raises an exception "Results locked until election is closed".

---

## 2. Should-Have Requirements

### 2.1 Department Admin Tier
**Requirement**: Department Admins can manage elections and candidates for their specific department.
- **Scenario**: Department Admin creates election
  - **Given** a Department Admin for "Physics"
  - **When** they create an election
  - **Then** the election is successfully created IF its `scope_department` is "Physics", but rejected otherwise.

### 2.2 Unit Tests
**Requirement**: Critical DB constraints must be unit tested.
- **Scenario**: Test double-vote rejection
  - **Given** a test environment
  - **When** the test runner attempts to insert two votes for the same voter/election
  - **Then** the test asserts a constraint violation error.
- **Scenario**: Test closed-election rejection
  - **Given** a test environment
  - **When** the test runner attempts to insert a vote for a closed election
  - **Then** the test asserts an RLS violation error.
- **Scenario**: Test tally math
  - **Given** a test election seeded with known votes
  - **When** the test runner calls `get_election_results`
  - **Then** the returned counts exactly match the seeded vote counts.

---

## 3. Could-Have Requirements

### 3.1 Platform Admin Dashboard
**Requirement**: Platform admins can view cross-tenant aggregate metrics.
- **Scenario**: Platform admin queries metrics
  - **Given** a user with `role = 'platform_admin'`
  - **When** they call the platform analytics RPC
  - **Then** they receive aggregate counts of institutions, elections, and total votes cast across all tenants.

### 3.2 CSV Validator with Row-Level Errors
**Requirement**: Invalid roster CSV rows fail gracefully and are logged for the admin to fix.
- **Scenario**: Uploading a malformed roster
  - **Given** an institution admin uploads a CSV where row 5 is missing a department
  - **When** the upload edge function processes the file
  - **Then** valid rows are inserted into `roster`, and row 5 is inserted into `roster_import_errors` with the reason "Missing department".

### 3.3 Candidate Photo Upload
**Requirement**: Candidates can upload photos to Supabase Storage; access is controlled.
- **Scenario**: Candidate photo visibility
  - **Given** a candidate who uploaded a photo
  - **When** their status is `pending`
  - **Then** the photo is only accessible to admins and the candidate.
  - **When** their status becomes `approved`
  - **Then** the photo becomes publicly readable for voters viewing the ballot.
