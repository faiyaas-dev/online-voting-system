# AGENTS.md

A README for agents. Every AI tool working on this repo — Antigravity, Trae, chat.z.ai (manual), Claude Code, Cursor, whatever comes next — reads this file first, every session. This file is self-contained: you should not need to open `ARCHITECTURE.md` to get to work, though it remains in the repo as the original human-approved decision record if you want the discussion context behind a rule.

If any instruction here conflicts with what you're about to do, stop and surface the conflict instead of resolving it silently.

## Project overview

A multi-tenant SaaS platform for running college elections. Multiple institutions self-serve sign up; each institution uploads a voter roster by CSV; elections are scoped by department/year or institution-wide; candidates self-nominate and are admin-approved before appearing on the ballot; voters authenticate by OTP/magic-link (no passwords) and vote once per election, enforced at the database level, not just in app code.

Three admin tiers: Platform Admin (cross-institution, aggregate-only view) → Institution Admin (full control of one institution) → Department Admin (own department only). Voters see only elections matching their own department/year scope, or institution-wide elections.

## Tech stack

- **Database / Auth / Storage:** Supabase (Postgres + Row Level Security + `auth.users` + Storage bucket for candidate photos)
- **Frontend:** Next.js (App Router, TypeScript) + Tailwind — kept intentionally minimal/functional for this build, not a polished design pass
- **Spec engine:** OpenSpec CLI (`openspec/changes/`, `openspec/specs/`) — every schema or policy change ships as a change folder (proposal → design → tasks → archive), not a bare migration
- **IDEs used on this project:** Google Antigravity (primary, now Generally Available at $0/individual as of Sept 2026 — no longer preview-gated), Trae (frontend scaffolding, free tier), plus a fallback ladder covering Gemini Code Assist, DeepSeek, and the Gemini app for when both primaries are quota-exhausted — see "IDE routing & fallback" below and `CONTINGENCY_MATRIX.md` for full detail.

## Dev environment setup

```bash
node -v                     # need 20.19+ for OpenSpec
npm install -g supabase     # Supabase CLI
# install OpenSpec CLI per its current README — command changes across releases
openspec init
supabase login
supabase link --project-ref <your-dev-project-ref>
```

Copy `.env.local.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
The `service_role` key is never placed in `.env.local` or any client-reachable file — it exists only inside Supabase Edge Function secrets.

**Never point local dev at a Supabase project holding real student data.** Use a throwaway/dev project until the Phase 6 security review (see playbook) has passed.

## Build & run commands

```bash
npm run dev              # local dev server
npm run build             # production build
npm run lint               # lint
supabase db push           # apply migrations to linked project
supabase functions deploy roster-csv-validate   # deploy an Edge Function
```

## Testing instructions

```bash
npm run test               # unit tests
```

A task touching `votes`, `elections`, or any RLS policy is **not done** until these three unit tests pass:
1. Double-vote is rejected (`UNIQUE(voter_id, election_id)` fires).
2. A vote insert is rejected when `elections.status != 'voting_open'`.
3. `get_election_results()`'s tally matches a hand-computed expected count on a seeded test election.

Any change touching an RLS policy must also include a cross-tenant leak test: confirm a user from Institution A cannot read Institution B's roster, elections, candidates, or results through that policy.

## Database schema

Locked — reproduce exactly, do not "improve" without an OpenSpec change first.

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
  photo_path text, -- Supabase Storage path, Could-tier
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

-- roster_import_errors: Could-tier — row-level CSV validation failures
create table roster_import_errors (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) not null,
  row_number int not null,
  raw_row jsonb not null,
  error_reason text not null,
  imported_at timestamptz default now()
);
```

## Row Level Security policies

Non-negotiable on every table above — no table ships without its policy in the same change.

```sql
-- helper: current user's institution_id
create or replace function my_institution_id() returns uuid as $$
  select institution_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

alter table profiles enable row level security;
alter table roster enable row level security;
alter table elections enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;
alter table roster_import_errors enable row level security;

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

-- roster_import_errors: same access pattern as roster (Could-tier)
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
    )
  );

-- votes: insert only if voter belongs to institution, election is
-- voting_open, and eligibility matches
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

-- votes: voters can't read others' ballots; results come from a separate
-- RPC function, never raw votes table
create policy votes_own_read on votes
  for select using (voter_id = auth.uid());

-- claim_voter_profile: securely matches roster on first login, avoids
-- exposing the roster table directly to the client
create or replace function claim_voter_profile(p_institution_id uuid)
returns profiles as $$
declare
  r roster%rowtype;
  p profiles%rowtype;
begin
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
```

**Could-tier extension — Platform Admin cross-institution view:** implement as a second RPC following the exact same pattern as `get_election_results`: aggregates only (e.g. total elections, total votes cast, participation rate per institution), gated to `role = 'platform_admin'`, never a raw grant on any table. Design this RPC in the Phase 2 OpenSpec change before writing it — see `SDLC_IDE_PLAYBOOK.md`.

**Could-tier extension — candidate photos:** Supabase Storage bucket policy — candidates upload their own photo during nomination; approved candidates' photos are publicly readable; pending/rejected photos are not; file size/type limits are enforced server-side (storage policy + Edge Function check), never client-only.

## Core logic flows

**Voter first login (OTP):**
1. Voter enters email → `supabase.auth.signInWithOtp`.
2. On magic-link callback, app calls `supabase.rpc('claim_voter_profile', { p_institution_id })`.
3. `claim_voter_profile` checks `roster` for `(institution_id, email)` and creates/updates the `profiles` row. No roster match → exception, surfaced to the voter as "your email isn't on this institution's roster."

**Institution self-serve signup:**
1. Person enters institution name + their own email → OTP.
2. On success: create `institutions` row + `profiles` row with `role='institution_admin'`.

**Election eligibility (checked client-side for UX, enforced server-side for real):**
`voter.department == election.scope_department OR election.scope_department IS NULL` AND `voter.year == election.scope_year OR election.scope_year IS NULL`. The client check only hides ineligible elections from the UI — RLS is the actual gate.

**Vote casting:**
1. App checks `election.status == 'voting_open'` and voter eligibility (UX only).
2. Insert into `votes`. `UNIQUE(voter_id, election_id)` is the real backstop against double-vote.
3. `votes_insert` RLS policy re-checks `status = 'voting_open'` at insert time — a closed election rejects the insert at the database level, not just via UI hiding.

**Results visibility:**
Hidden from voters until `elections.status = 'closed'`. Both voters and admins call `get_election_results(p_election_id)` — never a raw `votes` query.

## MoSCoW scope for this build

Full scope for this pass: **Must + Should + Could**. This is genuinely a multi-day build by default — if you're compressing it into one day, **decide your cut line before Phase 1, not when a session runs long.** Must + Should is the realistic one-day target; treat Could as a stretch to attempt only if Phase 4 finishes with real time left, not something to discover you're out of time for mid-build.

| Tier | Items |
|---|---|
| **Must** | institutions + profiles + roster tables + RLS · OTP auth (voter + institution-admin) · multi-level elections (dept/year scope) · self-nomination + institution-admin approval · vote cast with UNIQUE + `voting_open` DB lock · results hidden-till-close |
| **Should** | Department Admin tier (3rd role, dept-scoped election creation) · unit tests (double-vote reject, closed-election reject, tally match) |
| **Could** | Platform Admin dashboard (cross-institution, aggregate RPC only) · CSV uploader with row-level validation errors (`roster_import_errors`) · candidate photo (Supabase Storage, signed access, server-enforced limits) |
| **Won't (this build)** | Email notifications beyond auth OTP · analytics · audit log UI (DB already logs via `created_at`/`approved_by`) · custom design system / visual polish pass — frontend stays minimal and functional |
| **Cut order if a session runs long** | Could → Should (keep the 3 unit tests, cut nothing else) → if still tight, Institution Admin approves everything and Department Admin tier is deferred |

## Code conventions

- Migrations: one file per logical change under `supabase/migrations/`, named `<timestamp>_<snake_case_description>.sql`.
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `test:`).
- Frontend: default Tailwind utility classes, no custom design tokens or component library work in this build — working and correct beats polished.
- Every schema/policy change is proposed as an OpenSpec change before implementation: `/opsx:propose <name>` → review `proposal.md`/`design.md`/`tasks.md` → `/opsx:apply` → `/opsx:archive`.
- Service-role Supabase key never appears outside `supabase/functions/` secrets.

## Agent roster (installed via agency-agents)

`./scripts/install.sh --tool antigravity` for Antigravity. Trae isn't a listed install target — point Trae's rules file at the same generated Cursor-style output (`./scripts/convert.sh` then `--tool cursor`) since Trae reads AGENTS.md/Cursor-style rule files.

| Agent | Source path | Used in phase |
|---|---|---|
| Workflow Architect | `specialized/specialized-workflow-architect.md` | 1 |
| Software Architect | `engineering/engineering-software-architect.md` | 1, 2 |
| Backend Architect | `engineering/engineering-backend-architect.md` | 2, 3 |
| Database Optimizer | `engineering/engineering-database-optimizer.md` | 2, 3 |
| Frontend Developer | `engineering/engineering-frontend-developer.md` | 4 |
| Senior Developer | `engineering/engineering-senior-developer.md` | 4 |
| Rapid Prototyper | `engineering/engineering-rapid-prototyper.md` | 4 |
| Autonomous Optimization Architect | `engineering/engineering-autonomous-optimization-architect.md` | 3 |
| Evidence Collector | `testing/testing-evidence-collector.md` | 5 |
| Reality Checker | `testing/testing-reality-checker.md` | 5 |
| Test Automation Engineer | `testing/testing-test-automation-engineer.md` | 5 |
| Minimal Change Engineer | `engineering/engineering-minimal-change-engineer.md` | 3, 4 |
| Security Architect | `security/security-architect.md` | 2, 6 |
| AI-Generated Code Security Auditor | `security/security-ai-generated-code-auditor.md` | 6 |
| Identity & Access Engineer | `engineering/engineering-identity-access-engineer.md` | 6 |
| Git Workflow Master | `engineering/engineering-git-workflow-master.md` | 0, 7 |
| DevOps Automator | `engineering/engineering-devops-automator.md` | 0, 7 |
| SRE | `engineering/engineering-sre.md` | 7 |
| Technical Writer | `engineering/engineering-technical-writer.md` | 8 |

## IDE routing & fallback

**Constraints for this build: same-day delivery, zero spend, GUI-only** (no CLI AI tools, no API credits). Full phase-by-phase prompts live in `SDLC_IDE_PLAYBOOK.md`; the full current-state comparison, one-day sequencing strategy, and fallback ladder live in `CONTINGENCY_MATRIX.md`. Summary:

| Priority | Tool | Role | Constraint |
|---|---|---|---|
| 1st | Antigravity (GA, $0/individual) | planning, DB/RLS design, backend, testing, security, devops | free-tier refresh mechanic is reported inconsistently across sources (5-hour rolling vs. weekly) — check Settings → Models yourself before sequencing the day, see `CONTINGENCY_MATRIX.md` §0a |
| 2nd | Trae (free tier) | frontend scaffold (SOLO once) + iteration (Builder) | 5,000 autocompletions/mo, 2 concurrent cloud tasks; exact free-tier SOLO run count is not confirmed current — check Settings → Usage in Phase 0 |
| 3rd (external, GUI extension) | Gemini Code Assist (free, installed via Extensions panel — no terminal) | routine edits, iteration, non-RLS bug fixes when both above are quota-exhausted | repo-aware context; reported daily limits vary by source — verify in the extension itself |
| 4th (external, browser) | DeepSeek (chat.deepseek.com, free) | isolated components, doc drafting, debugging pasted errors | plain web chat, no repo access, no tool-calling, no test execution |
| 5th (external, browser, last resort) | Gemini app / Canvas (free) | same as DeepSeek, plus live code execution via Canvas | plain chat otherwise; free-tier context figures conflict across sources |

Never let any external fallback (3rd–5th) touch RLS policies or the `votes`/`elections` status-gating logic without the same review rigor as Antigravity's Phase 2/Phase 6 — none of them can run your tests for you. **Because this build can't wait for a quota reset, `CONTINGENCY_MATRIX.md` §2 defines a narrow, explicit emergency exception** for Phase 2/6 if Antigravity is completely dead — it trades increased risk for same-day delivery deliberately and requires immediately re-running the full leak-test suite against anything produced that way. It is not a casual substitute for the primary path.

## Changelog

- `v4` — Recompressed for a same-day, zero-spend, GUI-only build: added `CONTINGENCY_MATRIX.md` §0 "One-Day Sprint Mode" (check real quota countdown first, front-load Phase 2/6 early in the day, proactive MoSCoW cut-before-Phase-1 instead of emergency-only); removed CLI-based tools (Gemini CLI) and the Anthropic API credit route from the fallback ladder per confirmed constraints; replaced "wait for the weekly reset" with an explicit, risk-acknowledged emergency protocol for Phase 2/6 if Antigravity is fully exhausted; Phase 0 now includes live Supabase project creation and synthetic CSV generation since no real groundwork exists yet.
- `v3` — Added `CONTINGENCY_MATRIX.md`: Sept 2026 reality check (Antigravity now GA with shared weekly quota pool, not per-model; Trae restructured into 5 paid tiers); replaced the single chat.z.ai fallback with a five-tier ladder (in-tool model/mode switch → Gemini Code Assist → DeepSeek → Gemini app) scoped to actual confirmed access (DeepSeek + Gemini, no Kimi, Antigravity free/preview account, Trae free tier); added discrete pre-work/mid-work/delivery clarity checkpoints (§4a/4b/4c) referenced from each phase gate in `SDLC_IDE_PLAYBOOK.md`.
- `v2` — Restructured to match the agents.md open-format convention; absorbed ARCHITECTURE.md schema/RLS/flows inline; added Could-tier `roster_import_errors` table and candidate photo storage notes; frontend scope reduced to minimal/functional; added chat.z.ai emergency fallback tier.
- `v1` — Initial version, referenced ARCHITECTURE.md externally instead of absorbing it.
