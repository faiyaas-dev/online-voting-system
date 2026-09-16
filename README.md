# Online Voting System (Multi-Tenant College Elections SaaS)

> A secure, multi-tenant SaaS platform built for universities, colleges, and academic departments to run decentralized, tamper-proof student elections.

The system guarantees election integrity by enforcing tenant boundaries, voter eligibility scoping, and single-vote constraints directly at the database layer using PostgreSQL Row Level Security (RLS) and constraints—never trusting application code alone.

---

## Table of Contents

- [Overview & Why This Exists](#overview--why-this-exists)
- [Locked Architectural Decisions](#locked-architectural-decisions)
- [Administrative & User Role Hierarchy](#administrative--user-role-hierarchy)
- [Role Permission Matrix](#role-permission-matrix)
- [Tech Stack](#tech-stack)
- [Prerequisites & System Requirements](#prerequisites--system-requirements)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Running Tests & Quality Gates](#running-tests--quality-gates)
- [Database Schema & Security Principles](#database-schema--security-principles)
- [Production Operations & Runbook](#production-operations--runbook)
  - [Deployment Architecture](#deployment-architecture)
  - [Configuring CI/CD Secrets](#configuring-cicd-secrets)
  - [Netlify Deployment & Secrets](#netlify-deployment--secrets)
  - [Safe Migration Rollback Procedures](#safe-migration-rollback-procedures)
  - [Auditing Live Election Statuses (SQL)](#auditing-live-election-statuses-sql)
  - [Troubleshooting Missing or Rejected Votes](#troubleshooting-missing-or-rejected-votes)
- [OpenSpec Living Specifications](#openspec-living-specifications)
- [Agent Governance & Developer Directives](#agent-governance--developer-directives)

---

## Overview & Why This Exists

Student elections across universities and departments frequently struggle with physical paper ballots (slow tallying, high manual overhead) or unvetted web forms (vulnerable to ballot stuffing, lack of tenant separation, and zero cryptographic or database-level guarantees).

This platform provides an out-of-the-box, institutional-grade election solution featuring:

- **Self-Serve Multi-Tenant Onboarding**: Any institution can register independently. All data is isolated by `institution_id` enforced via PostgreSQL RLS.
- **Roster-Driven Voter Verification**: Institution Admins upload an authoritative student roster via CSV (`roll_no`, `email`, `department`, `year`). Row-level parsing failures are captured in `roster_import_errors` without dropping valid records.
- **Passwordless Authentication**: Zero stored passwords. Voters and admins authenticate strictly via one-time magic links/OTPs.
- **Atomic Profile Claiming**: On first login, the `claim_voter_profile` RPC matches the authenticated email to the institution roster, locking the user's role and department to prevent tenant-hopping or privilege escalation.
- **Multi-Level Election Scoping**: Contests can be institution-wide or granularly restricted to specific academic departments (`scope_department`) and student years (`scope_year`).
- **Nomination & Ballot Governance**: Candidates self-nominate with a manifesto and optional photo (Supabase Storage); administrators must approve nominations before candidates appear on ballots.
- **Engine-Level Vote Integrity**:
  - `UNIQUE(voter_id, election_id)` prevents double-voting at the database engine level.
  - RLS insert policies reject votes if `elections.status != 'voting_open'`.
- **Cryptographic Tally Secrecy**: Aggregated results are accessed through the `get_election_results()` RPC, strictly locked from voter access until an election reaches `closed` status. Raw vote rows are never exposed.

---

## Locked Architectural Decisions

| Decision | Implementation Detail |
|---|---|
| **Deployment Model** | Multi-tenant SaaS — multiple institutions coexist; data is strictly isolated per institution via Postgres RLS. |
| **Election Model** | Multi-level — concurrent elections can run across different departments, years, or campus-wide. |
| **Institution Onboarding** | Self-serve — any user can register an institution and automatically become its Institution Admin via atomic RPC. |
| **Admin Hierarchy** | 3 tiers — Platform Admin (aggregate health metrics) → Institution Admin (tenant control) → Department Admin (department scope). |
| **Voter Roster** | Admin-uploaded CSV is the source of truth for student eligibility; no open self-declaration. |
| **Voter Authentication** | OTP / magic-link sent to email via Supabase Auth; zero passwords stored in the database. |
| **Candidate Nominations** | Self-nomination during `nomination_open`; requires admin approval before appearing on the ballot. |
| **Voting Enforcement** | Database-level `UNIQUE(voter_id, election_id)` constraint + RLS status check `elections.status = 'voting_open'`. |

---

## Administrative & User Role Hierarchy

```
institutions
  └─ profiles (auth.users + role + institution_id + department)
       ├─ platform_admin: cross-tenant aggregate oversight
       ├─ institution_admin: tenant-wide authority
       ├─ department_admin: scoped to specific department
       └─ voter: students claiming roster profiles
  └─ roster (authoritative student eligibility list)
  └─ elections (institution-wide or dept/year scoped)
       ├─ candidates (self-nominated, pending → approved/rejected)
       └─ votes (one per voter per election, DB-enforced)
```

1. **Platform Admin**: Cross-institution operational oversight. Can call `get_platform_metrics()` for global aggregate counts (total tenants, elections, votes cast). Has **zero** access to student PII, roster rows, or individual ballots.
2. **Institution Admin**: Tenant-level authority. Can upload voter rosters, create institution-wide elections, approve/reject candidates across all departments, and invite Department Admins.
3. **Department Admin**: Scoped authority. Can create elections and approve candidates strictly within their assigned `scope_department`. Cannot access other departments.
4. **Voter**: Enrolled student. Claims their roster profile via OTP, browses elections matching their department/year, self-nominates during open nomination windows, and casts exactly one ballot per election.

---

## Role Permission Matrix

| Action | Platform Admin | Institution Admin | Department Admin | Voter |
|---|:---:|:---:|:---:|:---:|
| **Create Institution** | — *(self-serve)* | — | — | — |
| **Upload Roster CSV** | ❌ | ✅ *(own institution)* | ❌ | ❌ |
| **Invite Dept Admin** | ❌ | ✅ | ❌ | ❌ |
| **Create Election (Institution-Wide)** | ❌ | ✅ | ❌ | ❌ |
| **Create Election (Own Dept Only)** | ❌ | ✅ | ✅ | ❌ |
| **Approve / Reject Candidates** | ❌ | ✅ *(all dept elections)* | ✅ *(own dept elections only)* | ❌ |
| **Self-Nominate for Ballot** | ❌ | ❌ | ❌ | ✅ *(if eligible & open)* |
| **Cast Ballot** | ❌ | ❌ | ❌ | ✅ *(if eligible & open)* |
| **View Election Results** | ✅ *(audit RPC)* | ✅ *(audit RPC)* | ❌ *(locked till close)* | ❌ *(locked till close)* |
| **Cross-Tenant Aggregate Metrics** | ✅ *(RPC only)* | ❌ | ❌ | ❌ |

---

## Tech Stack

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router, TypeScript, Server & Client Components)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database, Auth & Storage**: [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security, Supabase Auth OTP, Supabase Storage)
- **Specification Engine**: [OpenSpec CLI](https://github.com/fission-ai/openspec) (Spec-driven contract governance)
- **Testing**: [Jest](https://jestjs.io/), [ts-jest](https://kulshekhar.github.io/ts-jest/), [Playwright](https://playwright.dev/)
- **Hosting & CI/CD**: [Netlify](https://www.netlify.com/) (Frontend continuous deployment) + [GitHub Actions](https://github.com/features/actions) (Automated test runner & migration deployment)

---

## Prerequisites & System Requirements

Ensure you have the following installed on your host machine:

- **Node.js**: `20.19.0+` (or [Bun](https://bun.sh/) `1.0+`)
- **Docker**: Required if running the local Supabase stack (`supabase start`)
- **Supabase CLI**:
  ```bash
  npm install -g supabase
  ```
- **OpenSpec CLI**:
  ```bash
  npm install -g @fission-ai/openspec
  ```

> [!NOTE]
> **Windows PowerShell Users**: If PowerShell restricts script execution (`.ps1`), invoke npm commands using `npm.cmd` (e.g., `npm.cmd run dev`, `npm.cmd run test`).

---

## Environment Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/faiyas-dev/online-voting-system.git
   cd online-voting-system
   ```

2. **Configure Environment Variables**:
   Copy `.env.local.example` to create your local `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

   Populate your `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   > [!CAUTION]
   > **CRITICAL SECURITY RULE**: Never put the `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or any client-reachable file. The service role key bypasses all Row Level Security policies and must only exist in protected CI/CD environments or Supabase Edge Function secrets.

---

## Running Locally

### 1. Install Dependencies
```bash
npm.cmd install
# or on Linux/macOS:
npm install
```

### 2. Provision Database & Apply Migrations

#### Option A: Local Supabase Stack (Docker required)
```bash
supabase start
supabase db reset   # Applies all migrations in supabase/migrations/
```

#### Option B: Remote Supabase Development Project
```bash
supabase login
supabase link --project-ref <your-dev-project-ref>
supabase db push
```

### 3. Start Development Server
```bash
npm.cmd run dev
# or on Linux/macOS:
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests & Quality Gates

A build or PR is **not ready to ship** unless all database integrity, RLS boundary, and TypeScript checks pass.

### Running Test Suites
```bash
# Unit & database integrity tests
npm.cmd run test

# End-to-end browser tests
npx playwright test

# Production build validation
npm.cmd run build

# Code style & lint verification
npm.cmd run lint
```

### The Three Golden Rules of Testing
Any pull request touching `votes`, `elections`, or RLS policies must satisfy:
1. **Double-Vote Rejection**: The database engine rejects any second vote for the same `(voter_id, election_id)` tuple.
2. **Closed-Election Rejection**: Vote inserts are rejected at the database level if `elections.status != 'voting_open'`.
3. **Tally Math Accuracy**: `get_election_results()` tally matches the hand-computed expected count on seeded test elections.
4. **Cross-Tenant Isolation**: A user authenticated under Institution A cannot read, insert, or update any record belonging to Institution B.

> [!TIP]
> **Jest & Playwright Isolation**: Jest is scoped via `jest.config.js` to `tests/unit` and `tests/integration`. Playwright E2E suites reside in `tests/e2e` to prevent module-parsing conflicts between Jest and ES-module browser runners.

---

## Database Schema & Security Principles

All tables reside in `supabase/migrations/` and have Row Level Security enabled:

- **`institutions`**: Tenant root (`id`, `name`, `slug`, `created_at`).
- **`profiles`**: 1:1 with `auth.users`, storing `role`, `institution_id`, `department`, and `year`.
- **`roster`**: Admin-uploaded student eligibility list (`unique(institution_id, email)`).
- **`elections`**: Election definitions with lifecycle states (`draft`, `nomination_open`, `voting_open`, `closed`).
- **`candidates`**: Nominations linked to an election (`unique(election_id, user_id)`), reviewed by admins.
- **`votes`**: Cast ballots (`unique(voter_id, election_id)`). Direct select queries return only a user's own vote; tallies are strictly accessed via RPC.
- **`roster_import_errors`**: Audit log capturing malformed CSV rows during student roster uploads.

### Core Security Definer RPCs
- **`create_institution_and_admin(p_institution_name, p_slug)`**: Atomically provisions an institution and assigns the caller the `institution_admin` role securely on the server side, preventing client-side role tampering.
- **`claim_voter_profile(p_institution_id)`**: Securely matches the authenticated user's email against the institution roster, assigning voter credentials and rejecting re-claims or tenant-hopping.
- **`get_election_results(p_election_id)`**: Calculates aggregated vote tallies; locked from public view until election status is `closed`.
- **`get_platform_metrics()`**: Computes cross-institution aggregate platform health metrics for `platform_admin` without exposing raw tenant data.

---

## Production Operations & Runbook

### Deployment Architecture

- **Frontend & APIs**: Hosted on **Netlify**, utilizing native GitHub integration for automated builds and previews on push to `main`.
- **Database, Auth & Storage**: Hosted on **Supabase**. Migrations are deployed via **GitHub Actions**.

### Configuring CI/CD Secrets

To enable automatic database migration deployment via GitHub Actions (`.github/workflows/deploy-migrations.yml`), configure these repository secrets in GitHub (**Settings > Secrets and variables > Actions > Repository secrets**):

| Secret Name | How to Obtain |
|---|---|
| `SUPABASE_PROJECT_ID` | Go to Supabase Dashboard > **Project Settings** > **General** > Copy **Reference ID**. |
| `SUPABASE_ACCESS_TOKEN` | Go to Supabase Account Settings > **Access Tokens** > Generate new token. |
| `SUPABASE_DB_PASSWORD` | Database password configured when creating the Supabase project. |

### Netlify Deployment & Secrets

Add the following environment variables to your Netlify site (**Site Settings > Environment Variables**) or via the Netlify CLI:

```bash
netlify link # Link local repository to Netlify site

netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://your-project-ref.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-anon-key"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-service-role-key"
netlify env:set WEBHOOK_SECRET "your-generated-webhook-secret"
```

### Safe Migration Rollback Procedures

If an erroneous migration is deployed to production, **do not manually alter production tables via the SQL editor**. Follow this procedure:

1. **Revert the PR**: Revert the offending commit on GitHub.
2. **Handle Forward Migrations**: Supabase's `supabase db push` does not automatically downgrade schemas. Create a new forward migration under `supabase/migrations/` that drops or reverses the unwanted schema changes, or run `supabase db reset` on local/staging to verify history before deploying.
3. **Point-in-Time Recovery (PITR)**: If schema changes resulted in data loss or corruption, navigate to Supabase Dashboard > **Database** > **Backups** and initiate a Point-in-Time Recovery to the state immediately preceding the bad migration.

### Auditing Live Election Statuses (SQL)

To inspect election lifecycle states, dates, and total ballots without relying on the web dashboard, run this query in the Supabase SQL Editor:

```sql
SELECT 
  id, 
  title, 
  status, 
  opens_at, 
  closes_at, 
  (SELECT count(*) FROM votes WHERE votes.election_id = elections.id) AS total_votes
FROM elections
ORDER BY created_at DESC;
```

### Troubleshooting Missing or Rejected Votes

If a voter reports that their ballot was not accepted, verify these checkpoints in order:

1. **Election Lifecycle Status**: Check if `elections.status` is exactly `'voting_open'`. The database RLS policy explicitly rejects vote inserts if the status is `draft`, `nomination_open`, or `closed`.
2. **Eligibility Scope Match**: Verify if the voter's `department` and `year` in `profiles` match the election's `scope_department` and `scope_year`. (If scope fields are `NULL`, the election is campus-wide).
3. **Duplicate Vote Constraint**: Check if the voter has already submitted a ballot. The database enforces `UNIQUE(voter_id, election_id)` on the `votes` table.
4. **Inspect RLS Logs**: Navigate to Supabase Dashboard > **Logs** > **Postgres** and filter for `policy violations` or `permission denied` to identify dropped queries.

---

## OpenSpec Living Specifications

This repository uses [OpenSpec](https://github.com/fission-ai/openspec) to ensure system requirements, architecture designs, and tasks remain synchronized with code.

- Living specifications reside in [`openspec/specs/`](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/openspec/specs/):
  - `authentication`: OTP authentication and roster profile claiming.
  - `candidate-photos`: Supabase Storage upload policies for candidate media.
  - `department-admin`: Department-scoped administrative governance.
  - `elections`: Multi-level election lifecycle states and scoping.
  - `nominations`: Candidate self-nomination and approval workflows.
  - `platform-admin`: Cross-institution platform metrics RPC.
  - `results`: Tally calculation and results visibility gating.
  - `roster-import`: CSV upload parsing and row-level error logging.
  - `tenant-management`: Multi-tenant institution creation and isolation.
  - `voting`: Single-vote database constraints and status locks.

### OpenSpec Commands
```bash
# Validate existing specifications
openspec validate --specs

# Propose a new system capability or change
openspec change new <change-name>
```

---

## Agent Governance & Developer Directives

For AI coding agents (Google Antigravity, Trae, Claude Code, Cursor) and engineers pair-programming with agents, consult the primary operating directive:

👉 **[AGENTS.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/AGENTS.md)**: **MANDATORY READING**. Contains:
- Complete locked SQL database schemas and PostgreSQL RLS policy source code.
- Detailed step-by-step logic workflows.
- The 9-phase SDLC × IDE multi-agent execution playbook.
- Free-tier quota management, five-tier contingency fallback ladder, and emergency RLS review protocol.
- Technical error resolutions, compiler gotchas, and repository changelogs.
