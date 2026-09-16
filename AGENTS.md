# AGENTS.md

A README for agents. Every AI tool working on this repo — Antigravity, Trae, chat.z.ai (manual), Claude Code, Cursor, DeepSeek, whatever comes next — reads this file first, every session. This file is 100% self-contained: all locked schemas, RLS policies, core logic workflows, the complete 9-phase SDLC playbook, quota and contingency fallback matrices, and technical error resolutions are consolidated directly within this document.

If any instruction here conflicts with what you're about to do, stop and surface the conflict instead of resolving it silently.

---

## 1. Project Overview

A multi-tenant SaaS platform for running college elections. Multiple institutions self-serve sign up; each institution uploads a voter roster by CSV; elections are scoped by department/year or institution-wide; candidates self-nominate and are admin-approved before appearing on the ballot; voters authenticate by OTP/magic-link (no passwords) and vote once per election, enforced at the database level, not just in application code.

Three admin tiers: Platform Admin (cross-institution, aggregate-only view) → Institution Admin (full control of one institution) → Department Admin (own department only). Voters see only elections matching their own department/year scope, or institution-wide elections.

### Administrative & User Role Hierarchy

```
institutions
  └─ profiles (auth.users + role + institution_id + department)
       ├─ platform_admin: cross-tenant aggregate oversight (no PII/ballot access)
       ├─ institution_admin: full control of one institution
       ├─ department_admin: scoped strictly to assigned department
       └─ voter: enrolled students claiming roster records
  └─ roster (authoritative student eligibility list)
  └─ elections (institution-wide or department/year scoped)
       ├─ candidates (self-nominated, pending → approved/rejected)
       └─ votes (one per voter per election, DB-enforced)
```

### Role Permission Matrix

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

## 2. Tech Stack

- **Database / Auth / Storage:** Supabase (PostgreSQL 15+ + Row Level Security + `auth.users` + Storage bucket for candidate photos).
- **Frontend:** Next.js 14 (App Router, TypeScript, Server & Client Components) + Tailwind CSS — kept functional and robust.
- **Spec Engine:** OpenSpec CLI (`openspec/changes/`, `openspec/specs/`) — every schema or policy change ships as a change folder (`proposal.md` → `design.md` → `tasks.md` → archive), not a bare migration.
- **Testing:** Jest, ts-jest, Playwright (E2E browser tests).
- **Hosting & CI/CD:** Netlify (Frontend) + GitHub Actions (automated test runner and Supabase migration deploy).
- **IDEs & Tooling:** Google Antigravity (primary for reasoning, DB/RLS, testing, security, devops), Trae (frontend scaffolding and UI iteration), plus a 5-tier fallback ladder (Gemini Code Assist, DeepSeek, Gemini app).

---

## 3. Dev Environment Setup

```bash
node -v                     # need 20.19+ for OpenSpec
npm install -g supabase     # Supabase CLI
npm install -g @fission-ai/openspec # OpenSpec CLI
openspec init
supabase login
supabase link --project-ref <your-dev-project-ref>
```

Copy `.env.local.example` to `.env.local` and fill in:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> [!CAUTION]
> **Service Role Key Hygiene**: The `service_role` key must **never** be placed in `.env.local` or any client-reachable file. It exists exclusively inside Supabase Edge Function secrets and protected CI/CD environments.
>
> **Data Protection Rule**: Never point local development at a Supabase project holding real student data. Use a throwaway/dev project.

---

## 4. Build & Run Commands

```bash
# Development server
npm run dev              # or: npm.cmd run dev (on Windows PowerShell)

# Production build validation
npm run build            # or: npm.cmd run build

# Code linting
npm run lint             # or: npm.cmd run lint

# Database migrations
supabase db push         # apply migrations to linked remote project
supabase db reset        # reset and re-apply local migrations (Docker stack)

# Deploy edge functions
supabase functions deploy roster-csv-validate
```

> [!NOTE]
> **Windows PowerShell Execution Policy**: If PowerShell blocks script execution (`npm.ps1`), invoke npm commands using `npm.cmd` (e.g., `npm.cmd run test`, `npm.cmd run build`).

---

## 5. Testing Instructions & Quality Gates

```bash
npm run test             # or: npm.cmd run test
npx playwright test      # browser E2E test suite
```

A task touching `votes`, `elections`, or any RLS policy is **not done** until these requirements pass:
1. **Double-vote rejection**: Second vote for the same `(voter_id, election_id)` is rejected by `UNIQUE(voter_id, election_id)`.
2. **Closed-election rejection**: Vote insert is rejected by RLS when `elections.status != 'voting_open'`.
3. **Tally math accuracy**: `get_election_results()` tally matches a hand-computed expected count on a seeded test election.
4. **Cross-tenant leak prevention**: Confirm an authenticated user from Institution A cannot read, insert, or modify Institution B's roster, elections, candidates, or votes.

---

## 6. Database Schema (Locked)

Locked — reproduce exactly, do not alter without an OpenSpec change proposal first.

```sql
-- institutions: tenant root
create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- profiles: 1:1 with auth.users, adds role + tenant + department
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id), -- null for platform_admin
  role text not null check (role in ('platform_admin','institution_admin','department_admin','voter')),
  department text,
  year int,
  full_name text,
  roll_no text,
  created_at timestamptz default now()
);

-- roster: admin-uploaded eligibility source of truth
create table roster (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  roll_no text not null,
  email text not null,
  department text not null,
  year int not null,
  full_name text,
  imported_at timestamptz default now(),
  unique(institution_id, email)
);

-- elections: scope_department / scope_year null = institution-wide
create table elections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  title text not null,
  scope_department text,       -- null = all departments
  scope_year int,               -- null = all years
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','nomination_open','voting_open','closed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- candidates: self-nominated, admin-approved
create table candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid references elections(id) not null,
  user_id uuid references profiles(id) not null,
  manifesto text,
  photo_path text,             -- Supabase Storage path
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(election_id, user_id)
);

-- votes: one per voter per election, DB-enforced
create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid references profiles(id) not null,
  election_id uuid references elections(id) not null,
  candidate_id uuid references candidates(id) not null,
  cast_at timestamptz default now(),
  unique(voter_id, election_id)
);

-- roster_import_errors: row-level CSV validation failures
create table roster_import_errors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  row_number int not null,
  raw_row jsonb not null,
  error_reason text not null,
  imported_at timestamptz default now()
);
```

---

## 7. Row Level Security Policies & Helper Functions (Locked)

Non-negotiable on every table above — no table ships without its policy in the same change.

```sql
-- helper: current user's institution_id
create or replace function my_institution_id() returns uuid as $$
  select institution_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

alter table institutions enable row level security;
alter table profiles enable row level security;
alter table roster enable row level security;
alter table elections enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;
alter table roster_import_errors enable row level security;

-- institutions: read own institution, or all institutions for platform_admin
create policy institutions_select on institutions
  for select using (
    id = my_institution_id() or my_role() = 'platform_admin'
  );

-- profiles: read own or same-institution profiles
create policy profiles_select on profiles
  for select using (
    id = auth.uid() or institution_id = my_institution_id()
  );

-- profiles: update own info without escalating role or tenant
create policy profiles_update_own on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles where id = auth.uid())
    and institution_id = (select institution_id from profiles where id = auth.uid())
  );

-- roster: only institution_admin of that institution can read/write
create policy roster_admin_access on roster
  for all using (
    institution_id = my_institution_id()
    and my_role() in ('institution_admin')
  );

-- roster_import_errors: same access pattern as roster
create policy roster_import_errors_admin_access on roster_import_errors
  for all using (
    institution_id = my_institution_id()
    and my_role() in ('institution_admin')
  );

-- elections: voters see matching dept/year in their institution; admins see all in institution
create policy elections_select on elections
  for select using (
    institution_id = my_institution_id()
    and (
      my_role() in ('institution_admin', 'platform_admin')
      or (
        (scope_department is null or scope_department = (select department from profiles where id = auth.uid()))
        and (scope_year is null or scope_year = (select year from profiles where id = auth.uid()))
      )
    )
  );

create policy elections_admin_insert on elections
  for insert with check (
    institution_id = my_institution_id()
    and (
      my_role() = 'institution_admin'
      or (my_role() = 'department_admin' and scope_department = (select department from profiles where id = auth.uid()))
    )
  );

create policy elections_admin_update on elections
  for update using (
    institution_id = my_institution_id()
    and (
      my_role() = 'institution_admin'
      or (my_role() = 'department_admin' and scope_department = (select department from profiles where id = auth.uid()))
    )
  );

-- candidates: view approved candidates (or own nomination, or all for admin)
create policy candidates_select on candidates
  for select using (
    exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
    )
    and (
      status = 'approved'
      or user_id = auth.uid()
      or my_role() in ('institution_admin', 'department_admin')
    )
  );

-- candidates: self-nomination during nomination_open if eligible
create policy candidates_nominate on candidates
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
        and (e.scope_department is null or e.scope_department = (select department from profiles where id = auth.uid()))
        and (e.scope_year is null or e.scope_year = (select year from profiles where id = auth.uid()))
    )
  );

-- candidates: admin approval / rejection
create policy candidates_admin_update on candidates
  for update using (
    my_role() in ('institution_admin', 'department_admin')
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and (
          my_role() = 'institution_admin'
          or (my_role() = 'department_admin' and e.scope_department = (select department from profiles where id = auth.uid()))
        )
    )
  );

-- votes: insert only if voter belongs to institution, election is voting_open, and eligibility matches
create policy votes_insert on votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from elections e
      where e.id = election_id
        and e.institution_id = my_institution_id()
        and e.status = 'voting_open'
        and (e.scope_department is null or e.scope_department = (select department from profiles where id = auth.uid()))
        and (e.scope_year is null or e.scope_year = (select year from profiles where id = auth.uid()))
    )
  );

-- votes: voters can't read others' ballots; results come from a separate RPC function, never raw votes table
create policy votes_own_read on votes
  for select using (voter_id = auth.uid());

-- create_institution_and_admin: server-side atomic institution and admin creation
create or replace function create_institution_and_admin(p_institution_name text, p_slug text)
returns jsonb as $$
declare
  v_institution_id uuid;
  v_user_email text;
begin
  v_user_email := auth.jwt()->>'email';
  if auth.uid() is null or v_user_email is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from profiles where id = auth.uid() and institution_id is not null) then
    raise exception 'User already assigned to an institution';
  end if;

  insert into institutions (name, slug)
  values (p_institution_name, p_slug)
  returning id into v_institution_id;

  insert into profiles (id, institution_id, role, full_name)
  values (auth.uid(), v_institution_id, 'institution_admin', coalesce(auth.jwt()->>'name', 'Admin'))
  on conflict (id) do update set
    institution_id = excluded.institution_id,
    role = 'institution_admin';

  return jsonb_build_object(
    'institution_id', v_institution_id,
    'role', 'institution_admin'
  );
end;
$$ language plpgsql security definer;

-- claim_voter_profile: securely matches roster on first login, prevents re-claims and tenant-hopping
create or replace function claim_voter_profile(p_institution_id uuid)
returns profiles as $$
declare
  r roster%rowtype;
  p profiles%rowtype;
begin
  -- Check if profile already claimed for an institution
  select * into p from profiles where id = auth.uid();
  if found and p.institution_id is not null then
    if p.institution_id != p_institution_id then
      raise exception 'Profile already associated with a different institution';
    end if;
    return p;
  end if;

  select * into r from roster
  where institution_id = p_institution_id and lower(email) = lower(auth.jwt()->>'email');
  if not found then
    raise exception 'Email not found in institution roster';
  end if;

  insert into profiles (id, institution_id, role, department, year, roll_no, full_name)
  values (auth.uid(), p_institution_id, 'voter', r.department, r.year, r.roll_no, r.full_name)
  on conflict (id) do update set
    institution_id = excluded.institution_id,
    department = excluded.department,
    year = excluded.year,
    roll_no = excluded.roll_no,
    full_name = excluded.full_name
  returning * into p;

  return p;
end;
$$ language plpgsql security definer;

-- get_election_results: aggregated tally only, never raw vote rows.
-- Locked until election is closed (or caller is an institution/platform admin).
create or replace function get_election_results(p_election_id uuid)
returns table (candidate_id uuid, vote_count bigint) as $$
begin
  if not exists (
    select 1 from elections e
    where e.id = p_election_id
      and e.institution_id = my_institution_id()
      and (e.status = 'closed' or my_role() in ('institution_admin', 'platform_admin'))
  ) then
    raise exception 'Results locked until election is closed';
  end if;

  return query
  select v.candidate_id, count(v.id)
  from votes v
  where v.election_id = p_election_id
  group by v.candidate_id;
end;
$$ language plpgsql security definer;

-- get_platform_metrics: cross-institution aggregate metrics for platform_admin
create or replace function get_platform_metrics()
returns jsonb as $$
declare
  v_metrics jsonb;
begin
  if my_role() != 'platform_admin' then
    raise exception 'Access denied: platform_admin role required';
  end if;

  select jsonb_build_object(
    'total_institutions', (select count(*) from institutions),
    'total_elections', (select count(*) from elections),
    'total_votes', (select count(*) from votes),
    'active_elections', (select count(*) from elections where status = 'voting_open')
  ) into v_metrics;

  return v_metrics;
end;
$$ language plpgsql security definer;
```

### Candidate Photos Storage Policy
- **Bucket**: `candidate-photos` in Supabase Storage.
- **Upload Rule**: Candidates upload their own photo during nomination (`folder = {institution_id}/{election_id}/{user_id}.ext`).
- **Read Rule**: Photos of candidates whose status is `approved` are publicly readable; pending/rejected photos are restricted to admins and the candidate.
- **Validation**: File size (<= 2MB) and MIME type (image/jpeg, image/png, image/webp) are validated server-side.

---

## 8. Core Logic Flows & Workflows

### Voter First Login (OTP)
1. Voter enters email → `supabase.auth.signInWithOtp`.
2. On magic-link callback, app calls `supabase.rpc('claim_voter_profile', { p_institution_id })`.
3. `claim_voter_profile` matches `roster` on `(institution_id, email)`. If matched, assigns `voter` role, `department`, `year`, `roll_no`. If missing, raises exception surfaced as "Your email is not on this institution's roster."

### Institution Self-Serve Signup
1. User enters institution name and email → authenticates via OTP.
2. App calls `supabase.rpc('create_institution_and_admin', { p_institution_name, p_slug })`.
3. Atomically creates `institutions` row and assigns the user `role = 'institution_admin'` server-side.

### Election Eligibility Evaluation
- **Formula**: `(election.scope_department IS NULL OR voter.department = election.scope_department) AND (election.scope_year IS NULL OR voter.year = election.scope_year)`.
- Client evaluates this to filter visible ballots for UX; PostgreSQL RLS policies enforce it upon insert.

### Vote Casting
1. Client checks `elections.status == 'voting_open'` and eligibility.
2. Insert ballot into `votes` table.
3. Database `UNIQUE(voter_id, election_id)` constraint blocks double-votes; RLS policy verifies status is `voting_open` at the moment of insert.

### Results Visibility
- Hidden from voters until `elections.status = 'closed'`.
- Tallies retrieved via `get_election_results(p_election_id)`. Raw vote rows are never queried.

---

## 9. SDLC × IDE Multi-Phase Playbook

Solo engineer workflow — one IDE open at a time in a serial pipeline: finish a phase, review diff, verify quality gates, and commit before advancing.

### IDE Division of Labor
- **Antigravity**: Handles high-stakes reasoning, requirements locking, database & RLS design, testing, security review, and DevOps. Planning Mode enforces reviewable specifications before code modification.
- **Trae**: Handles rapid frontend screen generation and iterative component scaffolding (SOLO for initial pass, Builder/Chat for screen-by-screen iteration).

---

### Phase 0 — Environment & Repo Setup
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Claude Sonnet 4.6 / Gemini 3.8 Flash
- **Agents**: DevOps Automator, Git Workflow Master
- **Prompt**:
  ```text
  You are acting as DevOps Automator and Git Workflow Master.
  Read AGENTS.md in full.
  Set up the repo:
  1. Initialize Next.js 14 App Router, TypeScript, Tailwind.
  2. Install and initialize OpenSpec CLI.
  3. Ensure directory structure: openspec/changes/, openspec/specs/, supabase/migrations/, supabase/functions/, app/, components/, tests/.
  4. Configure .env.local with Supabase dev credentials.
  5. Generate synthetic CSV roster sample (15-20 rows) at sample-data/roster.csv.
  6. Verify clean initial git status with conventional commit config.
  ```
- **Exit Criteria**: Next.js app boots, Supabase credentials wired, OpenSpec initialized, synthetic CSV ready.

---

### Phase 1 — Requirements Lock & Planning
- **IDE**: Antigravity · **Mode**: Planning Mode · **Model**: Gemini 3.1 Pro (High)
- **Agents**: Workflow Architect, Software Architect
- **Prompt**:
  ```text
  Acting as Workflow Architect and Software Architect.
  Read AGENTS.md completely. Do not write implementation code in this session — Planning Mode only.
  Task: produce OpenSpec proposal for the Must+Should+Could scope in AGENTS.md.
  Run: /opsx:propose voting-platform-v1
  In proposal.md: define problem statement, MoSCoW tier rationale, and explicit out-of-scope items.
  In specs/: document requirements and Given/When/Then scenarios for all tiers.
  In design.md: map user-facing flows (voter OTP, institution signup, eligibility, voting lock, platform metrics).
  ```
- **Exit Criteria**: `openspec/changes/voting-platform-v1/` contains reviewed `proposal.md`, `specs/`, and `design.md`.

---

### Phase 2 — System & Database Design (Schema + RLS)
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Claude Opus 4.6 (or Gemini 3.1 Pro High)
- **Agents**: Backend Architect, Database Optimizer, Security Architect
- **Schedule**: Execute early in the day when reasoning quota is fresh.
- **Prompt**:
  ```text
  Acting as Backend Architect, Database Optimizer, and Security Architect.
  Read AGENTS.md's "Database schema" and "Row Level Security policies" sections and design.md.
  Base schema and RLS policies are LOCKED. Extend them for Could-tier items:
  1. Platform Admin cross-institution RPC (get_platform_metrics) with aggregate counts only.
  2. CSV roster import error tracking table (roster_import_errors) with institution-scoped RLS.
  3. Candidate photo Supabase Storage bucket policy (public read for approved candidates only).
  Write design updates and tasks.md with SQL blocks. Name specific cross-tenant leak scenarios prevented by each policy.
  ```
- **Exit Criteria**: `design.md` and `tasks.md` updated with exact SQL definitions and named leak scenarios.

---

### Phase 3 — Backend Implementation
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Claude Sonnet 4.6
- **Agents**: Backend Architect, Database Optimizer, Autonomous Optimization Architect, Minimal Change Engineer
- **Prompt**:
  ```text
  Acting as Backend Architect, Database Optimizer, and Minimal Change Engineer.
  Read tasks.md and implement ONLY what is specified:
  1. Apply all Postgres migrations in supabase/migrations/ with RLS on every table.
  2. Implement create_institution_and_admin, claim_voter_profile, get_election_results, and get_platform_metrics RPCs.
  3. Implement CSV roster upload parser Edge Function (logging errors to roster_import_errors).
  4. Verify migrations apply cleanly without errors.
  ```
- **Exit Criteria**: Migrations apply cleanly (`supabase db push`), all RPCs callable, edge function validates rows.

---

### Phase 4 — Frontend Implementation
- **IDE**: Trae · **Mode**: SOLO Mode (1 run) for full scaffold, Builder Mode for iterative refinements · **Model**: Claude Sonnet 4.6
- **Agents**: Frontend Developer, Rapid Prototyper, Senior Developer
- **Step 4a (SOLO scaffold)**:
  ```text
  Acting as Frontend Developer and Rapid Prototyper.
  Read AGENTS.md. Connect Next.js frontend to existing Supabase backend:
  1. Voter flow: OTP login → roster claim → eligible elections list → candidate list → self-nomination form → voting booth → locked results.
  2. Institution Admin portal: CSV uploader with row errors, election creator, candidate approval table.
  3. Department Admin portal: department-scoped election creator and candidate approval view.
  4. Platform Admin dashboard: global metrics view (total tenants, total votes, active elections).
  Use default Tailwind classes; functional and correct beats polished design.
  ```
- **Step 4b (Builder iteration)**: Refine components screen-by-screen (e.g., CSV error reporting table, photo upload previews).
- **Exit Criteria**: All screens render, interact with Supabase, and reflect database-level RLS gates.

---

### Phase 5 — Testing & QA
- **IDE**: Antigravity · **Mode**: Agent Mode with browser verification · **Model**: Claude Sonnet 4.6
- **Agents**: Evidence Collector, Reality Checker, Test Automation Engineer
- **Prompt**:
  ```text
  Acting as Test Automation Engineer, Evidence Collector, and Reality Checker.
  Write and execute:
  1. The 3 required integrity tests: double-vote rejection, closed-election rejection, tally math accuracy.
  2. Cross-tenant leak tests: verify Institution A user cannot read Institution B data.
  3. End-to-end browser walkthrough of voter and admin journeys with screenshot artifacts.
  Do not mark passing without green test output or visual proof.
  ```
- **Exit Criteria**: `npm.cmd run test` passes, cross-tenant isolation verified, screenshot artifacts saved.

---

### Phase 6 — Security Review
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Claude Opus 4.6 (or Gemini 3.1 Pro High)
- **Agents**: Security Architect, AI-Generated Code Security Auditor, Identity & Access Engineer
- **Schedule**: Execute immediately after Phases 3–5.
- **Prompt**:
  ```text
  Acting as Security Architect, AI-Generated Code Security Auditor, and Identity & Access Engineer.
  Audit codebase for:
  1. Hardcoded secrets or service_role key leaked to client.
  2. RLS policy verification against named cross-tenant leak scenarios.
  3. Privilege escalation prevention in profiles_update_own and claim_voter_profile.
  4. Multi-tenant registration abuse and slug collisions in create_institution_and_admin.
  5. Server-enforced candidate photo storage policies.
  Rank findings by severity. Flag all Critical/High issues.
  ```
- **Exit Criteria**: Zero Critical/High findings; all Medium/Low risks documented and addressed.

---

### Phase 7 — DevOps & Deployment
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Gemini 3.8 Flash / Claude Sonnet 4.6
- **Agents**: DevOps Automator, SRE, Git Workflow Master
- **Prompt**:
  ```text
  Acting as DevOps Automator, SRE, and Git Workflow Master.
  1. Verify GitHub Actions CI pipeline (.github/workflows/ci.yml) testing local Supabase stack on PRs.
  2. Verify GitHub Actions CD pipeline (.github/workflows/deploy-migrations.yml) applying migrations on push to main.
  3. Verify Netlify production environment secrets configuration.
  4. Ensure operational runbook procedures are documented in README.md.
  ```
- **Exit Criteria**: CI passes on PRs, deployment secrets documented, zero credentials tracked in git.

---

### Phase 8 — Documentation & Governance Handoff
- **IDE**: Antigravity · **Mode**: Agent Mode · **Model**: Technical Writer, Workflow Architect
- **Prompt**:
  ```text
  Acting as Technical Writer and Workflow Architect.
  1. Consolidate developer guidance and operational runbooks into README.md.
  2. Consolidate locked specifications, playbooks, fallback matrices, and error resolutions into AGENTS.md.
  3. Archive completed OpenSpec changes via openspec validate --specs.
  4. Update AGENTS.md Changelog.
  ```
- **Exit Criteria**: Documentation 100% synchronized, OpenSpec living specs verified, changelog updated.

---

## 10. Quota Governance, Contingency Fallbacks & Clarity Checkpoints

### 10.1. One-Day Sprint Mode (Zero-Spend, GUI-Only)
- **Hard Constraints**: Delivery in one day. Zero spend (no paid tiers, no credit cards). GUI-only tools (Antigravity, Trae, browser).
- **Check Quota First**: Before sequencing, open Antigravity → Settings → Models and inspect the actual refresh countdowns.
- **Front-Load Reasoning**: Schedule Phase 2 (schema/RLS) and Phase 6 (security review) early when Opus/Pro quota is fresh.
- **Conserve Frontier Quotas**: Route routine phases (0, 1, 3, 5, 7, 8) to Claude Sonnet 4.6 or Gemini 3.8 Flash.

### 10.2. Five-Tier Fallback Ladder

```
[Tier 1: Antigravity Model Switch]
   ↓ (if Opus exhausted, switch to Gemini 3.1 Pro High or Gemini 3.8 Flash in same window)
[Tier 2: Trae Mode Switch]
   ↓ (if SOLO runs exhausted, drop to Builder / Chat mode)
[Tier 3: Gemini Code Assist]
   ↓ (free GUI extension in editor panel, repo-aware, non-RLS tasks)
[Tier 4: DeepSeek Web Chat]
   ↓ (chat.deepseek.com, large context paste, human acts as test runner)
[Tier 5: Gemini App / Canvas]
     (browser canvas with live code execution pane)
```

### 10.3. Emergency RLS Compensating Protocol
If Antigravity is completely unavailable mid-Phase 2 or Phase 6, you may draft RLS policies in Tier 4 (DeepSeek) **strictly** under these guardrails:
1. Paste the locked schema and RLS sections from `AGENTS.md` verbatim — never allow the model to rewrite table structures.
2. Require the model to name the exact cross-tenant leak scenario prevented by every generated policy.
3. Do not commit code until you run the complete test suite locally:
   ```bash
   npm.cmd run test
   ```
4. Perform an explicit line-by-line manual code audit of all generated SQL before applying.

### 10.4. Context Continuity Template (for External Browser Chats)
```text
Context (from AGENTS.md):
[paste locked schema table or RLS policy]

Current file (path/to/file.ext):
[paste current content]

Task: [single file, single concern, narrow scope]

Constraints: Functional Tailwind styling only, no new dependencies, do not touch RLS or voting status logic without emergency protocol. Output the complete updated file.
```

### 10.5. Per-Phase Contingency Matrix

| Phase | Primary Tool & Model | If Model Quota Gone | If Tool Fully Locked Out |
|---|---|---|---|
| **0 — Setup** | Antigravity, Sonnet 4.6 | Gemini 3.8 Flash | Perform manually in Supabase / GitHub dashboards |
| **1 — Requirements** | Antigravity, Gemini 3.1 Pro High | Claude Sonnet 4.6 | Draft prose in DeepSeek, migrate into OpenSpec later |
| **2 — Schema & RLS** | Antigravity, Opus 4.6 | Gemini 3.1 Pro High | Emergency RLS Compensating Protocol in DeepSeek |
| **3 — Backend** | Antigravity, Sonnet 4.6 | Gemini 3.8 Flash | Tier 3 (Gemini Code Assist) for non-RLS files |
| **4 — Frontend** | Trae, SOLO scaffold | Trae Builder / Chat | Tier 3 (Gemini Code Assist) screen-by-screen |
| **5 — Testing & QA** | Antigravity, Sonnet 4.6 | Gemini 3.8 Flash | Run `npm.cmd run test` locally by hand |
| **6 — Security Review** | Antigravity, Opus 4.6 | Gemini 3.1 Pro High | Emergency Protocol in DeepSeek + manual audit |
| **7 — DevOps** | Antigravity, Gemini Flash | Any Antigravity model | Tier 3/4 for isolated CI config snippets |
| **8 — Documentation** | Antigravity, Flash / Sonnet | Any Antigravity model | Tier 4 (DeepSeek) / Tier 5 (Gemini Canvas) |

### 10.6. Discrete Clarity Checkpoints

#### §10.6a. Pre-Flight Checkpoint (Before Starting)
1. Did you inspect Antigravity's real countdown in Settings → Models?
2. Is Phase 2 scheduled early in the day?
3. Which Could-tier items are confirmed for today vs. deferred?
4. Are dev Supabase credentials and sample CSV data confirmed?

#### §10.6b. Mid-Work Phase Gates (Before Moving to Next Phase)
1. Did you read the actual git diff, especially for RLS, migrations, and auth?
2. Do all exit criteria hold via verified test executions, not model assertions?
3. If an external fallback was used, did it follow the Emergency Compensating Protocol?
4. Are you conserving Opus / Pro quotas for security and schema phases?

#### §10.6c. Delivery Gate (Phase 8 Completion)
1. Does every Must + Should item have a passing automated test or screenshot?
2. Are all Phase 6 Critical/High security findings resolved?
3. Is git history clean of all API keys, database passwords, and secrets?
4. Are `README.md` and `AGENTS.md` 100% up to date with no dangling links?

---

## 11. Technical Gotchas & Error Resolutions

This section records resolved environment, compiler, and framework gotchas to prevent regression:

### 1. Untyped Supabase Cookie Callbacks
- **Symptom**: `Parameter 'cookiesToSet' implicitly has an 'any' type.` in `app/auth/callback/route.ts`, `lib/supabase/server.ts`, and `middleware.ts`.
- **Cause**: `@supabase/ssr` callback handlers missing explicit type annotations under strict TypeScript settings.
- **Resolution**: Import `CookieOptions` from `@supabase/ssr` and type the parameter explicitly:
  ```typescript
  cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
    cookieStore.set(name, value, options);
  });
  ```

### 2. Next.js Type-Checking Deno Edge Functions
- **Symptom**: `Cannot find module 'https://deno.land/std@0.192.0/http/server.ts' or its corresponding type declarations.`
- **Cause**: Next.js TypeScript compiler evaluated `supabase/functions/`, which are Deno modules, not Node modules.
- **Resolution**: Exclude `supabase/functions` in `tsconfig.json`:
  ```json
  "exclude": ["node_modules", "supabase/functions"]
  ```

### 3. Jest Discovery Collision with Playwright E2E Suites
- **Symptom**: `Cannot use import statement outside a module` when running `npm run test`.
- **Cause**: Jest discovered Playwright browser test files in `tests/e2e/`, which require ES module execution.
- **Resolution**: Scope Jest discovery in `jest.config.js` to unit and integration suites only:
  ```javascript
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],
  ```

### 4. React Hooks `exhaustive-deps` Warnings
- **Symptom**: Non-fatal build warnings in `app/elections/[id]/nominate/page.tsx` and `app/elections/[id]/vote/page.tsx`.
- **Status**: Documented as non-blocking. Do not modify dependency arrays without targeted regression tests to avoid re-triggering authentication loops.

### 5. Windows PowerShell Script Execution Policy
- **Symptom**: `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Resolution**: Invoke npm commands via `npm.cmd` (e.g., `npm.cmd run build`, `npm.cmd run test`).

---

## 12. MoSCoW Scope & Proactive Cut Order

| Tier | Capabilities Included |
|---|---|
| **Must** | Multi-tenant core (`institutions`, `profiles`, `roster`) + RLS · Passwordless OTP auth · Multi-level elections (dept/year scope) · Self-nomination + Admin approval · Voting with `UNIQUE` + status lock · Results hidden until close. |
| **Should** | Department Admin role (`department_admin`) with department-scoped election governance · Unit test suite (double-vote rejection, closed-election rejection, tally math accuracy). |
| **Could** | Platform Admin dashboard with cross-institution aggregate RPC (`get_platform_metrics`) · CSV uploader with row-level error logging (`roster_import_errors`) · Candidate photo upload with Supabase Storage policies. |
| **Won't (This Pass)** | Push notifications/SMS beyond auth OTP · Deep voter turnout analytics · Public audit log UI (DB preserves audit timestamps) · Bespoke design systems / visual polish pass. |

**Proactive Cut Order (if time is compressed)**:
Could tier (photos, CSV errors) → Should tier (retain 3 unit tests at all costs) → Defer Department Admin to Institution Admin approvals.

---

## 13. Code Conventions & Agent Roster

### Conventions
- **Migrations**: One file per logical change under `supabase/migrations/`, named `<timestamp>_<snake_case_description>.sql`.
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- **OpenSpec Protocol**: Every schema/policy modification starts with an OpenSpec proposal: `/opsx:propose <name>` → review `proposal.md`/`design.md`/`tasks.md` → `/opsx:apply` → `/opsx:archive`.
- **Secrets Rule**: Service role key never appears in client-accessible code.

### Agent Persona Roster

| Agent Persona | Role Description | Used in Phases |
|---|---|:---:|
| **Workflow Architect** | Maps user journeys, state transitions, and failure recoveries | 1, 8 |
| **Software Architect** | System structure, tenant boundaries, and modular interfaces | 1, 2 |
| **Backend Architect** | Supabase database, Edge Functions, and server APIs | 2, 3 |
| **Database Optimizer** | PostgreSQL schema indexes, query performance, and constraints | 2, 3 |
| **Frontend Developer** | Next.js App Router, React hooks, and component logic | 4 |
| **Senior Developer** | High-reliability code implementation and component patterns | 4 |
| **Rapid Prototyper** | Fast end-to-end screen scaffolding and interface wireframing | 4 |
| **Minimal Change Engineer** | Guardrail against scope creep and speculative refactoring | 3, 4 |
| **Evidence Collector** | Visual verification, test execution logs, and proof capture | 5 |
| **Reality Checker** | Objective quality gatekeeper; rejects unproven assertions | 5 |
| **Test Automation Engineer** | Automated unit, integration, and E2E test suites | 5 |
| **Security Architect** | Threat modeling, RLS boundary audits, and leak prevention | 2, 6 |
| **AI-Generated Code Auditor** | Reviews AI-written code for hardcoded secrets and flaws | 6 |
| **Identity & Access Engineer** | Auth flows, session lifecycle, and multi-tenant authorization | 6 |
| **DevOps Automator** | CI/CD pipelines, Docker environments, and cloud infrastructure | 0, 7 |
| **Git Workflow Master** | Branching strategy, conventional commits, and clean history | 0, 7 |
| **SRE** | Production reliability, incident response, and runbooks | 7 |
| **Technical Writer** | Clear, runnable, developer-first documentation | 8 |

---

## 14. Changelog

- `v6` — **Full Documentation & Playbook Consolidation:**
  - Consolidated `ARCHITECTURE.md`, `CONTINGENCY_MATRIX.md`, `ERROR_RESOLUTION.md`, `RUNBOOK.md`, and `SDLC_IDE_PLAYBOOK.md` into `AGENTS.md` and `README.md`.
  - Dissipated redundant standalone files to establish two authoritative sources of truth: `README.md` (developer overview, architecture, runbook) and `AGENTS.md` (complete agent instructions, locked schemas, 9-phase playbook, quota matrices, error resolution knowledge base).
  - Validated all build, test, and lint commands with Windows PowerShell compatibility (`npm.cmd`).
- `v5` — **Full V1 Implementation Shipped (Phases 0–8 complete):**
  - Shipped Must, Should, and Could tiers.
  - Hardened security with `create_institution_and_admin` atomic RPC and re-claim prevention in `claim_voter_profile`.
  - Configured GitHub Actions CI/CD pipelines, Netlify hosting, and OpenSpec living specs across 10 capability domains.
- `v4` — Recompressed for same-day, zero-spend, GUI-only sprint mode with emergency RLS protocol.
- `v3` — Integrated quota reality checks and 5-tier fallback ladder.
- `v2` — Absorbed base architecture inline and added Could-tier error tables and candidate photo specifications.
- `v1` — Initial multi-tenant voting system architecture.
