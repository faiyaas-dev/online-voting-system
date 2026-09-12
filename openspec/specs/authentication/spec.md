# authentication Specification

## Purpose
Enables secure passwordless OTP authentication and roster profile verification, binding authenticated users to tenant profiles.

## Requirements

### Requirement: Passwordless OTP login
The system SHALL authenticate users via passwordless one-time password (OTP) or magic links without passwords.

#### Scenario: OTP authentication dispatch
- **WHEN** a user enters their email address on the login page
- **THEN** an OTP magic link is dispatched to their verified email.

### Requirement: Secure voter profile claiming
The system SHALL match authenticated users against the institution roster on initial login and refuse subsequent re-claims to prevent privilege escalation.

#### Scenario: Successful profile claiming
- **WHEN** an authenticated user whose email exists on the roster invokes claim_voter_profile
- **THEN** their profile is populated with their department, year, roll number, and voter role.

#### Scenario: Unregistered email rejection
- **WHEN** an authenticated user whose email is not on the roster invokes claim_voter_profile
- **THEN** an exception is raised stating the email is not found on the roster.

#### Scenario: Profile re-claim rejection
- **WHEN** a user with an existing profile attempts to re-claim a profile
- **THEN** the RPC raises an exception refusing to overwrite the profile.
