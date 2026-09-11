# ARCHITECTURE.md — College Voting Platform (multi-tenant SaaS)

Idhu full-vision architecture doc — indha file AGENTS.md and GEMINI.md rendum
reference pannum. 3-hour sprint-la ellame build aagadhu; Section 6-la
MoSCoW-oda exact-a enna build pannanum nu kudukkiren.

---

## 1. Locked architecture decisions (discussion-la irundhu)

| Decision | Locked answer |
| --- | --- |
| Deployment model | Multi-tenant SaaS — pala institutions, data isolated per institution |
| Election model | Multi-level — palakerankum concurrent elections, voters dept/year/class scoped |
| Institution onboarding | Self-serve — yaaru vendraalum sign up pannitu oru institution create pannalam, avaru andha institution-oda Institution Admin aagiruvaru |
| Admin hierarchy | 3 tiers — Platform Admin → Institution Admin → Department Admin |
| Voter roster | Admin uploads CSV (roll_no, email, department, year) — self-declare illa |
| Voter auth | OTP / magic-link (email-kku), password edhuvum illa |
| Candidate nomination | Self-nomination, admin approve pannanum apparam mattum ballot-la varum |

---

## 2. Entities & roles

```
institutions
  └─ profiles (auth.users + role + institution_id + department)
       ├─ role: platform_admin | institution_admin | department_admin | voter
  └─ roster (uploaded CSV rows — source of truth for voter eligibility)
  └─ elections (scoped by department/year, or institution-wide if null)
       └─ candidates (self-nominated, pending → approved/rejected)
       └─ votes (one per voter per election, DB-enforced)
```

**Role permission matrix (summary):**

| Action | Platform Admin | Institution Admin | Department Admin | Voter |
| --- | --- | --- | --- | --- |
| Create institution | — (self-serve, no approval needed) | — | — | — |
| Upload roster | ❌ | ✅ (whole institution) | ❌ | ❌ |
| Invite Dept Admin | ❌ | ✅ | ❌ | ❌ |
| Create election (institution-wide) | ❌ | ✅ | ❌ | ❌ |
| Create election (own dept only) | ❌ | ✅ | ✅ | ❌ |
| Approve/reject candidates | ❌ | ✅ (any election in institution) | ✅ (own dept elections only) | ❌ |
| Self-nominate | ❌ | ❌ | ❌ | ✅ (if eligible for that election) |
| Cast vote | ❌ | ❌ | ❌ | ✅ (if eligible + not yet voted + election open) |
| View all institutions | ✅ | ❌ | ❌ | ❌ |

---

## 3. Database schema (Postgres / Supabase)

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
```

---

## 4. Row Level Security (RLS) — multi-tenant isolation, non-negotiable

Multi-tenant-la RLS mandatory — anon key rendaalum shared-a irukkum, so
tenant isolation database level-lame enforce pannanum, app code nambaadha.

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
-- RPC function (see Section 5), never raw votes table
create policy votes_own_read on votes
  for select using (voter_id = auth.uid());

-- Helper RPC: Secure Voter Profile Claim from Roster (avoids exposing roster table to client)
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

-- Helper RPC: Aggregated Results (solves RLS single-row count limitation for closed elections)
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

---

## 5. Core logic flows

**Voter first login (OTP):**

1. Voter enters email → Supabase `signInWithOtp`.
2. On magic-link callback, app calls `supabase.rpc('claim_voter_profile', { p_institution_id })`.
3. Database `claim_voter_profile` securely checks `roster` for `(institution_id, email)`
   and creates/updates `profiles` row (`role='voter'`, `department`, `year`, `roll_no`).
   If no roster match → raises exception ("un email indha institution roster-la illa").

**Institution self-serve signup:**

1. Person enters institution name + their own email → OTP.
2. On success, create `institutions` row + `profiles` row with
   `role='institution_admin'`, `institution_id` = new row.

**Election eligibility check (client + RLS both):**
`voter.department == election.scope_department OR election.scope_department IS NULL`
AND `voter.year == election.scope_year OR election.scope_year IS NULL`.
Client checks this to hide ineligible elections; RLS is the real enforcement (never trust client-only).

**Vote casting:**

1. App checks election.status == 'voting_open' AND voter eligible.
2. Insert into `votes`. UNIQUE(voter_id, election_id) is the DB backstop
   against double-vote even if app logic is bypassed.
3. Closed-election lock: RLS `votes_insert` policy checks
   `e.status = 'voting_open'` at insert time — a closed election rejects
   inserts at the database level, not just UI hiding.

**Results visibility:**
Results hidden from voters until `elections.status = 'closed'` (standard
election-integrity practice). Voters and admins query `supabase.rpc('get_election_results', { p_election_id })`.
The RPC checks `status = 'closed' OR my_role() = 'institution_admin'` and returns aggregated counts.
Voters never query raw `votes` table for results.

---

## 6. MoSCoW — what actually fits in a 3-hour sprint

Full architecture-a 3 hours-la mudikka mudiyaadhu — idhu solid product
scope. Keezha Must-have mattum build pannu, Section-1 to 5 ellame future
OpenSpec changes-a incrementally add pannalam.

| Priority | Item |
| --- | --- |
| **Must** | institutions + profiles + roster (CSV upload, simple form/paste, not a fancy uploader) tables + RLS; OTP auth (voter + institution-admin, same flow); one hardcoded/self-created institution for the demo; multi-level elections (dept/year scope); self-nomination + institution-admin approval (skip department_admin tier for now); vote cast with UNIQUE + status='voting_open' DB lock; results hidden-till-close |
| **Should** | Department Admin tier (3rd role) with dept-scoped election creation; basic Tailwind style pass; unit tests (double-vote reject, closed-election reject, tally match) |
| **Could** | Platform Admin dashboard (cross-institution view); nicer CSV uploader with validation errors shown; candidate photo |
| **Won't (this sprint)** | Multiple elections' UI polish beyond function; email notifications; analytics; audit log UI (DB still logs via created_at/approved_by, just no UI) |

**Cut order if 3 hours runs out:** Could → Should (keep the 3 unit tests,
cut style pass first) → if still tight, drop Department Admin tier
entirely and let Institution Admin approve everything for the demo.
