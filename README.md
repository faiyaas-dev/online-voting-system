# Online Voting System (Multi-Tenant College Elections SaaS)

A secure, multi-tenant SaaS platform built for universities and colleges to administer decentralized student elections.

The system guarantees election integrity by enforcing tenant boundaries, eligibility scoping, and single-vote constraints directly at the database layer using Postgres Row Level Security (RLS) and constraints—not merely within application code.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Administrative & User Hierarchy](#administrative--user-hierarchy)
- [Tech Stack](#tech-stack)
- [Prerequisites & System Requirements](#prerequisites--system-requirements)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Running Tests](#running-tests)
- [Database Schema & Security Principles](#database-schema--security-principles)
- [OpenSpec Living Specifications](#openspec-living-specifications)
- [CI/CD & Production Runbook](#cicd--production-runbook)
- [Governance & Agent Directives](#governance--agent-directives)

---

## Overview & Architecture

Colleges and departments frequently struggle with physical ballots or vulnerable third-party web forms. This platform addresses this by providing:

- **Self-Serve Institution Onboarding**: Colleges sign up independently; each institution is isolated by tenant ID (`institution_id`).
- **CSV Roster Uploads with Error Logging**: Admins upload student rosters (`roll_no`, `email`, `department`, `year`). Malformed rows are isolated in `roster_import_errors` without dropping valid entries.
- **Passwordless Authentication**: Zero passwords. Voters and admins authenticate exclusively via one-time magic links/OTPs.
- **Roster Matching on First Login**: The server-side `claim_voter_profile` RPC automatically links authenticated emails to their roster record and permanently locks the profile to prevent tenant-hopping or privilege tampering.
- **Multi-Level Scoped Elections**: Elections can be institution-wide or restricted to specific academic departments and years.
- **Candidate Nominations & Approvals**: Candidates self-nominate with a manifesto (and optional profile photo via Supabase Storage), requiring administrative approval before appearing on the ballot.
- **Database-Enforced Voting Integrity**:
  - `UNIQUE(voter_id, election_id)` prevents double-voting at the database engine level.
  - RLS insert policies reject votes if `elections.status != 'voting_open'`.
- **Locked Tallies**: Aggregated results are retrieved through the secure `get_election_results()` RPC, which remains locked from public access until an election reaches `closed` status. Raw vote records are never directly queried.

---

## Administrative & User Hierarchy

| Role | Scope & Permissions |
|---|---|
| **Platform Admin** | System-wide operational oversight. Can call `get_platform_metrics()` for cross-institution aggregate tallies (total tenants, elections, votes cast). Has **zero** raw table access to student PII or individual ballots. |
| **Institution Admin** | Tenant-level control. Can upload voter rosters, create institution-wide elections, review candidates across all departments, and manage institution settings. |
| **Department Admin** | Department-level delegation. Can create and manage elections and approve candidate nominations strictly for their assigned department (`scope_department`). Cannot touch other departments. |
| **Voter** | Student voter. Can claim their profile from the institution roster, self-nominate in open elections matching their department/year, view ballots, and cast exactly one vote per election. |

---

## Tech Stack

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router, TypeScript) + [Tailwind CSS](https://tailwindcss.com/)
- **Database, Auth & Storage**: [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security, Supabase Auth OTP, Supabase Storage)
- **Specification Engine**: [OpenSpec CLI](https://github.com/fission-ai/openspec) (`spec-driven` workflow)
- **Testing**: [Jest](https://jestjs.io/), [ts-jest](https://kulshekhar.github.io/ts-jest/), [Playwright](https://playwright.dev/)
- **Hosting & CI/CD**: [Netlify](https://www.netlify.com/) (Frontend continuous deployment) + [GitHub Actions](https://github.com/features/actions) (Automated test suite & Supabase database migrations)

---

## Prerequisites & System Requirements

Before running the project, ensure you have:

- **Node.js**: `20.19.0+` (or [Bun](https://bun.sh/) `1.0+`)
- **Docker**: Required if running local Supabase development stack (`supabase start`)
- **Supabase CLI**: Install globally via npm:
  ```bash
  npm install -g supabase
  ```
- **OpenSpec CLI**: Install globally for specification management:
  ```bash
  npm install -g @fission-ai/openspec
  ```

---

## Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/faiyas-dev/online-voting-system.git
   cd online-voting-system
   ```

2. **Configure Environment Variables**:
   Copy `.env.local.example` to create your local `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

   Fill in your Supabase project credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   > [!CAUTION]
   > **CRITICAL SECURITY RULE**: Never place the `service_role` key in `.env.local` or any client-accessible file. The `service_role` key bypasses all Row Level Security and must only exist in Supabase Edge Function secrets or protected CI/CD environments.

---

## Running Locally

### 1. Install Dependencies
Using npm:
```bash
npm install
```
Or using Bun:
```bash
bun install
```

### 2. Start Database & Apply Migrations

**Option A: Local Supabase Stack (Docker required)**
```bash
supabase start
supabase db reset   # Applies all migrations in supabase/migrations/
```

**Option B: Remote Supabase Development Project**
```bash
supabase login
supabase link --project-ref <your-dev-project-ref>
supabase db push
```

### 3. Start Development Server
```bash
npm run dev
# or
bun dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

Testing is non-negotiable on this platform. A build is not complete unless all database integrity and RLS boundary tests pass.

### Unit & Database Integrity Tests
```bash
npm run test
# or
bun run test
```

### End-to-End (E2E) Browser Tests
```bash
npx playwright test
```

### The Three Golden Rules of Testing
Any changes touching `votes`, `elections`, or RLS policies must verify:
1. **Double-vote rejection**: The database rejects any second vote for the same `(voter_id, election_id)`.
2. **Closed-election rejection**: Vote inserts are rejected if `elections.status != 'voting_open'`.
3. **Tally math accuracy**: `get_election_results()` matches the exact expected tally on seeded test elections.
4. **Cross-tenant isolation**: A user authenticated under Institution A cannot read or write to Institution B's roster, elections, candidates, or votes under any circumstances.

---

## Database Schema & Security Principles

All primary data tables reside in `supabase/migrations/` and have RLS enabled:

- **`institutions`**: Tenant root (`id`, `name`, `slug`, `created_at`).
- **`profiles`**: 1:1 with `auth.users`, storing `role`, `institution_id`, `department`, and `year`.
- **`roster`**: Source-of-truth eligibility list uploaded by institution admins (`unique(institution_id, email)`).
- **`elections`**: Election definitions with lifecycle states (`draft`, `nomination_open`, `voting_open`, `closed`).
- **`candidates`**: Nominations linked to an election (`unique(election_id, user_id)`), reviewed by admins.
- **`votes`**: Cast ballots (`unique(voter_id, election_id)`). Direct select queries return only a user's own vote; tallies are strictly accessed via RPC.
- **`roster_import_errors`**: Audit log of invalid CSV records during roster imports.

### Security Definer RPCs
- `create_institution_and_admin`: Atomically creates an institution and assigns the `institution_admin` role securely on the server side, eliminating client-side privilege tampering.
- `claim_voter_profile`: Matches the authenticated user's email against the institution roster, assigning voter credentials and rejecting re-claims.
- `get_election_results`: Calculates aggregated vote tallies; locked until election closure.
- `get_platform_metrics`: Calculates global cross-tenant platform health metrics for `platform_admin` without exposing raw tables.

---

## OpenSpec Living Specifications

This repository utilizes [OpenSpec](https://github.com/fission-ai/openspec) to maintain living specifications synchronized with code changes.

- Living specifications are located in [`openspec/specs/`](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/openspec/specs/):
  - `authentication`
  - `candidate-photos`
  - `department-admin`
  - `elections`
  - `nominations`
  - `platform-admin`
  - `results`
  - `roster-import`
  - `tenant-management`
  - `voting`
- Validate system specifications:
  ```bash
  openspec validate --specs
  ```
- Propose a new feature change:
  ```bash
  openspec change new <change-name>
  ```

---

## CI/CD & Production Runbook

- **Continuous Integration (`.github/workflows/ci.yml`)**: Executes on every push and pull request to `main`. Automatically runs linter, TypeScript type checking, boots a temporary local Supabase Docker stack, and executes the full test suite.
- **Continuous Deployment (`.github/workflows/deploy-migrations.yml`)**: Deploys database migrations to production via `supabase db push` upon merging into `main`.
- **Hosting**: Netlify auto-deploys frontend changes on commit.
- **Production Operations**: See [RUNBOOK.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/RUNBOOK.md) for step-by-step procedures on:
  - Setting up production secrets (`SUPABASE_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`).
  - Safe database migration rollback strategies.
  - Querying live election statuses via SQL Editor.
  - Diagnosing and troubleshooting missing or dropped votes.

---

## Governance & Agent Directives

For developers and AI coding agents (Antigravity, Trae, Claude, etc.) working on this repository, consult these essential companion documents:

- [AGENTS.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/AGENTS.md): **MANDATORY READING**. Contains locked database schemas, RLS policy code, core workflow trees, MoSCoW scoping rules, and release changelogs.
- [SDLC_IDE_PLAYBOOK.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/SDLC_IDE_PLAYBOOK.md): The step-by-step 9-phase playbook for human-agent pair programming.
- [CONTINGENCY_MATRIX.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/CONTINGENCY_MATRIX.md): Detailed guidance on free-tier quota budgets, fallback ladders (Sonnet, Gemini Pro, DeepSeek), and delivery checkpoints.
- [RUNBOOK.md](file:///c:/Users/faiya/OneDrive/Desktop/online-voting-system/RUNBOOK.md): Operational guide for production deployments and incident response.
