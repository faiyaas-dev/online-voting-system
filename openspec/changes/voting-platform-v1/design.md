# Design & Workflow Mapping

This document maps the user-facing paths and evaluates them against the current locked architecture and RLS policies defined in `ARCHITECTURE.md`.

---

## 1. Voter First Login → Roster Match → Vote
**Flow**:
1. User requests OTP via email.
2. User clicks magic link, authenticating via Supabase Auth.
3. Client application calls `supabase.rpc('claim_voter_profile', { p_institution_id })`.
4. RPC validates email against the `roster` table.
5. If found, RPC inserts/updates the `profiles` table with `role = 'voter'`.
6. Voter fetches open elections (filtered by RLS).
7. Voter submits vote (validated by RLS and UNIQUE constraints).

**RLS Coverage Check**:
- ✅ `claim_voter_profile` securely handles the roster check and profile creation using `SECURITY DEFINER`, bypassing the lack of an `insert` policy on `profiles`.
- ✅ `elections_select` ensures voters only see relevant elections.
- ✅ `votes_insert` strictly enforces that the election is open and the voter is eligible.
- ✅ `UNIQUE(voter_id, election_id)` on `votes` prevents double voting.

## 2. Institution Self-Serve Signup
**Flow**:
1. User fills out an institution registration form (Name, Slug, Admin Email).
2. User authenticates via OTP.
3. System creates a new row in `institutions`.
4. System creates a corresponding row in `profiles` with `role = 'institution_admin'`.

**RLS Coverage Check (🚨 GAP DETECTED)**:
- ❌ **Missing Insert Policies**: How do the `institutions` and `profiles` rows get created? `ARCHITECTURE.md` defines `profiles_select` and `profiles_update_own`, but **no insert policy for profiles**. Furthermore, the `institutions` table has no RLS enabled or policies defined. If the client performs these inserts, they will fail on `profiles` (due to missing policy) or succeed indiscriminately on `institutions` (if RLS is disabled).
- **Resolution Required**: We must either define a `SECURITY DEFINER` RPC (e.g., `register_institution(name, slug)`) that handles both inserts securely, or add appropriate insert RLS policies for self-serve signup.

## 3. Department Admin Nomination Approval
**Flow**:
1. Department Admin views pending candidates in their department's elections.
2. Admin updates the candidate's status to `approved` or `rejected`.

**RLS Coverage Check (🚨 GAP DETECTED)**:
- ❌ **Over-permissioned Update Policy**: The `candidates_admin_update` policy in `ARCHITECTURE.md` §4 reads:
  ```sql
  create policy candidates_admin_update on candidates
    for update using (
      my_role() in ('institution_admin', 'department_admin')
      and exists (
        select 1 from elections e
        where e.id = election_id
          and e.institution_id = my_institution_id()
      )
    );
  ```
  This policy allows a `department_admin` to approve/reject candidates for **ANY** election within their institution, not just elections scoped to their own department. 
- **Resolution Required**: The policy must be tightened to include an extra check for department admins:
  `or (my_role() = 'department_admin' and e.scope_department = (select department from profiles where id = auth.uid()))`.

## 4. Platform Admin Cross-Tenant View
**Flow**:
1. Platform Admin logs in.
2. Admin accesses a global dashboard.
3. Client requests aggregate metrics across all institutions.

**RLS Coverage Check (🚨 GAP DETECTED)**:
- ❌ **Missing RPC and Institutions RLS**: `ARCHITECTURE.md` mentions implementing a second RPC for platform admins (like `get_election_results`), but it does not specify how Platform Admins view the list of `institutions` itself. The `institutions` table currently lacks RLS. If we enable RLS on `institutions`, we need a `select` policy that allows `platform_admin` to read all rows, and `institution_admin`/`voter` to read only their own institution's row.
- **Resolution Required**: 
  - Enable RLS on `institutions`.
  - Add `institutions_select` policy.
  - Draft the specific `get_platform_metrics()` RPC in the final SQL implementation.

---

# Could-Tier Extensions — Detailed Design

> **IMPORTANT**: Sections 5–7 below are **additive extensions only**. They do not modify the locked base schema (`institutions`, `profiles`, `roster`, `elections`, `candidates`, `votes`) or any existing RLS policy defined in AGENTS.md / ARCHITECTURE.md §3–4. All references to those tables are read-only joins inside `SECURITY DEFINER` functions.

---

## 5. Platform Admin Cross-Institution Aggregate RPC

### 5.1 Design rationale

Platform Admins need operational visibility across all tenants — total institutions, elections created, votes cast, participation rates — without access to any individual voter's ballot or any institution's roster PII. This follows the exact pattern established by `get_election_results()`: a `SECURITY DEFINER` RPC that returns only aggregated counts, never raw rows.

**Why an RPC and not a raw table grant**: A `SELECT` policy on `votes`, `elections`, or `roster` for `platform_admin` would expose individual records (individual ballots, voter emails, roll numbers). The RPC pattern keeps the trust boundary intact — the function runs with elevated privileges internally but returns only pre-aggregated numbers.

### 5.2 RPC: `get_platform_metrics()`

```sql
-- get_platform_metrics: aggregate-only dashboard data for platform_admin.
-- Returns one row per institution with non-PII summary stats.
-- NEVER exposes individual votes, roster emails, or roll numbers.
create or replace function get_platform_metrics()
returns table (
  institution_id   uuid,
  institution_name text,
  total_elections  bigint,
  active_elections bigint,   -- status = 'voting_open'
  closed_elections bigint,   -- status = 'closed'
  total_voters     bigint,   -- roster count (not profiles — roster is source of truth)
  total_votes_cast bigint,
  participation_pct numeric  -- total_votes_cast / NULLIF(total_voters * total_elections, 0)
) as $$
begin
  -- Gate: only platform_admin may call this
  if my_role() != 'platform_admin' then
    raise exception 'Access denied: platform_admin role required';
  end if;

  return query
  select
    i.id                                         as institution_id,
    i.name                                       as institution_name,
    count(distinct e.id)                         as total_elections,
    count(distinct e.id) filter (
      where e.status = 'voting_open')            as active_elections,
    count(distinct e.id) filter (
      where e.status = 'closed')                 as closed_elections,
    (select count(*) from roster r
     where r.institution_id = i.id)              as total_voters,
    count(distinct v.id)                         as total_votes_cast,
    round(
      count(distinct v.id)::numeric /
      nullif(
        (select count(*) from roster r2
         where r2.institution_id = i.id) *
        nullif(count(distinct e.id) filter (
          where e.status in ('voting_open','closed')), 0),
        0
      ) * 100,
      2
    )                                            as participation_pct
  from institutions i
  left join elections e on e.institution_id = i.id
  left join votes v     on v.election_id = e.id
  group by i.id, i.name
  order by i.name;
end;
$$ language plpgsql security definer stable;
```

### 5.3 Institutions table RLS (additive — institutions table has no existing policies)

The `institutions` table currently has RLS disabled and no policies. We need to:
1. Enable RLS on `institutions`.
2. Add a `SELECT` policy so platform_admins can see all institutions (for the dashboard), while institution_admins / voters see only their own.
3. Add an `INSERT` policy for the self-serve signup flow (via a separate RPC — see gap in §2 above; this policy is a safety net if called outside the RPC).

```sql
alter table institutions enable row level security;

-- institutions: platform_admin sees all; everyone else sees only their own
create policy institutions_select on institutions
  for select using (
    my_role() = 'platform_admin'
    or id = my_institution_id()
  );
```

> **Note**: The `INSERT` policy for institutions will be designed alongside the `register_institution()` RPC (gap from §2). That is a Must-tier fix, not a Could-tier item, and is outside the scope of this document.

### 5.4 Cross-tenant leak scenarios this prevents (→ Phase 6 test cases)

| # | Threat scenario | Prevention mechanism | Test case |
|---|---|---|---|
| PA-1 | Non-platform-admin calls `get_platform_metrics()` and sees all institutions' data | `my_role() != 'platform_admin'` guard raises exception | Call RPC as `institution_admin` → expect `Access denied` exception |
| PA-2 | Platform admin reads raw `votes` table to see individual ballots across tenants | RPC returns aggregates only; `votes_own_read` RLS still blocks raw `SELECT` for platform_admin (they have no `voter_id` match) | Platform admin runs `SELECT * FROM votes` → expect 0 rows |
| PA-3 | Platform admin reads raw `roster` table to harvest student emails/PII | `roster_admin_access` policy blocks platform_admin (only `institution_admin` is in the `using` clause) | Platform admin runs `SELECT * FROM roster` → expect 0 rows |
| PA-4 | Institution admin calls `get_platform_metrics()` and sees other institutions' stats | `my_role()` check blocks them | Call RPC as `institution_admin` → expect `Access denied` exception |
| PA-5 | Voter from Institution A queries `institutions` table and discovers Institution B exists | `institutions_select` restricts to `id = my_institution_id()` for non-platform-admin | Voter queries `SELECT * FROM institutions` → expect only their own institution row |

---

## 6. Roster Import Errors — Row-Level CSV Validation Failures

### 6.1 Design rationale

The `roster_import_errors` table is already declared in AGENTS.md's locked schema. This section designs the **RLS policy, indexes, and Edge Function validation contract** around it.

When an Institution Admin uploads a CSV roster, an Edge Function (or server-side RPC) processes each row. Valid rows go into `roster`; invalid rows go into `roster_import_errors` with a structured reason. The admin can then query `roster_import_errors` to see what failed and fix their CSV.

### 6.2 Table definition (reproducing from AGENTS.md — LOCKED, do not modify)

```sql
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

### 6.3 RLS policy — mirrors `roster_admin_access`

```sql
alter table roster_import_errors enable row level security;

-- roster_import_errors: same access pattern as roster (institution_admin only, own institution)
create policy roster_import_errors_admin_access on roster_import_errors
  for all using (
    institution_id = my_institution_id()
    and my_role() in ('institution_admin')
  );
```

This is the exact policy text from AGENTS.md §RLS — reproduced verbatim.

### 6.4 Indexes for performance

```sql
-- Index on institution_id + imported_at for admin querying recent import errors
create index idx_roster_import_errors_institution_imported
  on roster_import_errors(institution_id, imported_at desc);
```

### 6.5 Validation rules (Edge Function contract)

The Edge Function `roster-csv-validate` processes the uploaded CSV. For each row, it checks:

| Validation rule | Error reason string | Example |
|---|---|---|
| Missing or empty `email` column | `missing_email` | Row has blank email cell |
| Malformed email (no `@`, invalid format) | `invalid_email_format` | `"john.doe.com"` |
| Missing or empty `department` column | `missing_department` | Row has blank department |
| Missing or empty `roll_no` column | `missing_roll_no` | Row has blank roll number |
| Missing or non-integer `year` column | `invalid_year` | `"third"` instead of `3` |
| Duplicate `(institution_id, email)` within the same CSV batch | `duplicate_email_in_batch` | Same email appears in row 3 and row 17 |
| Duplicate `(institution_id, roll_no)` within the same CSV batch | `duplicate_roll_no_in_batch` | Same roll_no in rows 5 and 12 |
| Conflict with existing `roster` row (unique constraint would fire) | `duplicate_email_existing` | Email already in `roster` table for this institution |

**Processing model**: The Edge Function uses the `service_role` key (never exposed to the client) and processes the CSV row by row in a single transaction:
1. Parse CSV.
2. For each row: validate → if invalid, `INSERT INTO roster_import_errors`; if valid, `INSERT INTO roster` (via `ON CONFLICT DO UPDATE` if the institution wants to refresh roster data).
3. Return a summary: `{ inserted: N, errors: M, error_ids: [...] }`.
4. The Institution Admin then queries `roster_import_errors` via the client (protected by RLS) to see the individual failures.

### 6.6 Cross-tenant leak scenarios (→ Phase 6 test cases)

| # | Threat scenario | Prevention mechanism | Test case |
|---|---|---|---|
| RIE-1 | Institution Admin from Inst A queries `roster_import_errors` and sees Inst B's failed rows (leaking emails, roll numbers from Inst B's CSV) | `institution_id = my_institution_id()` in policy | Inst A admin runs `SELECT * FROM roster_import_errors` → sees only Inst A rows; zero rows from Inst B |
| RIE-2 | Voter or Department Admin queries `roster_import_errors` and sees raw CSV data from their own institution | `my_role() in ('institution_admin')` restricts to institution_admin only | Voter/dept_admin runs `SELECT * FROM roster_import_errors` → expect 0 rows |
| RIE-3 | Unauthenticated / anon user queries `roster_import_errors` | RLS enabled + no anon policy = automatic deny | Anon request `SELECT * FROM roster_import_errors` → expect 0 rows |
| RIE-4 | Institution Admin from Inst A attempts to INSERT a fake error row targeting Inst B's `institution_id` | `institution_id = my_institution_id()` in `for all using(...)` blocks the insert (the `using` clause applies to INSERT too via implicit `with check`) | Inst A admin attempts `INSERT INTO roster_import_errors (..., institution_id = <Inst B id>)` → expect RLS violation |

---

## 7. Candidate Photo Storage — Supabase Storage Bucket Policy

### 7.1 Design rationale

Candidates upload a photo during self-nomination. Photo visibility must track candidate status:
- **`pending`**: Only the candidate themselves and institution/department admins can view.
- **`approved`**: Publicly readable (voters viewing the ballot need it).
- **`rejected`**: Only the candidate themselves and admins can view (same as pending).

The `photo_path` column on `candidates` (already in the locked schema) stores the Storage path.

### 7.2 Storage bucket configuration

```
Bucket name: candidate-photos
Public:       false  (access controlled by policies, not public URL)
File size limit: 2 MB (2097152 bytes)
Allowed MIME types: image/jpeg, image/png, image/webp
```

### 7.3 Storage path convention

```
candidate-photos/{institution_id}/{election_id}/{user_id}.{ext}
```

This path structure:
- Scopes files by institution (tenant isolation in the path itself).
- Scopes by election (a user could be a candidate in multiple elections).
- Uses `user_id` as the filename (one photo per nomination, unique per `(election_id, user_id)`).

### 7.4 Storage policies (Supabase Storage RLS)

Supabase Storage policies operate on the `storage.objects` table. The path segments are accessed via `storage.foldername()` and `storage.filename()`.

#### 7.4.1 Upload policy — candidates upload their own photo during nomination

```sql
-- Candidate can upload their own photo IF they have a pending/approved
-- nomination for the election referenced in the path.
-- Path: candidate-photos/{institution_id}/{election_id}/{user_id}.ext
create policy storage_candidate_photo_insert
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-photos'
    -- user_id segment in path must match auth.uid()
    and (storage.foldername(name))[3] = auth.uid()::text
    -- institution_id segment must match caller's institution
    and (storage.foldername(name))[1] = my_institution_id()::text
    -- must have an active nomination in this election
    and exists (
      select 1 from candidates c
      join elections e on e.id = c.election_id
      where c.user_id = auth.uid()
        and c.election_id = ((storage.foldername(name))[2])::uuid
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
    )
  );
```

#### 7.4.2 Update (replace) policy — candidates can replace their own photo while nomination is still open

```sql
create policy storage_candidate_photo_update
  on storage.objects for update
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[3] = auth.uid()::text
    and (storage.foldername(name))[1] = my_institution_id()::text
    and exists (
      select 1 from candidates c
      join elections e on e.id = c.election_id
      where c.user_id = auth.uid()
        and c.election_id = ((storage.foldername(name))[2])::uuid
        and e.institution_id = my_institution_id()
        and e.status = 'nomination_open'
        and c.status = 'pending'
    )
  );
```

#### 7.4.3 Select (read) policy — approved photos are public; pending/rejected are restricted

```sql
-- Anyone in the same institution can view approved candidates' photos.
-- Only the candidate themselves or admins can view pending/rejected photos.
create policy storage_candidate_photo_select
  on storage.objects for select
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[1] = my_institution_id()::text
    and (
      -- Case 1: Candidate is approved → readable by anyone in the institution
      exists (
        select 1 from candidates c
        join elections e on e.id = c.election_id
        where c.election_id = ((storage.foldername(name))[2])::uuid
          and c.user_id = ((storage.foldername(name))[3])::uuid
          and c.status = 'approved'
          and e.institution_id = my_institution_id()
      )
      -- Case 2: Not approved → only the candidate or admins
      or (storage.foldername(name))[3] = auth.uid()::text
      or my_role() in ('institution_admin', 'department_admin')
    )
  );
```

#### 7.4.4 Delete policy — only admins can delete photos

```sql
create policy storage_candidate_photo_delete
  on storage.objects for delete
  using (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[1] = my_institution_id()::text
    and my_role() in ('institution_admin')
  );
```

### 7.5 Server-side file validation (Edge Function or Storage hook)

Client-side validation is **never sufficient**. The following are enforced server-side:

| Constraint | Enforcement point | Mechanism |
|---|---|---|
| Max file size: 2 MB | Supabase Storage bucket config | `file_size_limit: 2097152` in bucket creation |
| Allowed types: JPEG, PNG, WebP | Supabase Storage bucket config | `allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp']` |
| Magic byte validation (content matches declared MIME) | Edge Function hook on `INSERT` to `storage.objects` | Read first 12 bytes, validate signature matches declared content-type; reject if mismatch |
| Filename sanitization | Storage path convention | Filename is always `{user_id}.{ext}` — no user-controlled filenames |

### 7.6 Photo path lifecycle

1. **Nomination** (`candidates.status = 'pending'`): Candidate uploads to `candidate-photos/{inst_id}/{election_id}/{user_id}.jpg`. The `photo_path` column on `candidates` is set to this path.
2. **Approval** (`candidates.status = 'approved'`): No file move needed. The Storage `SELECT` policy now allows all institution members to read.
3. **Rejection** (`candidates.status = 'rejected'`): File stays in place. Storage `SELECT` policy restricts to candidate + admins only. Optionally, an admin can delete it.

### 7.7 Cross-tenant leak scenarios (→ Phase 6 test cases)

| # | Threat scenario | Prevention mechanism | Test case |
|---|---|---|---|
| CP-1 | Voter from Inst A attempts to view a candidate photo from Inst B by guessing the Storage path | `(storage.foldername(name))[1] = my_institution_id()::text` blocks cross-institution reads | Inst A voter attempts `GET /storage/v1/object/candidate-photos/{Inst_B_id}/...` → expect 403 |
| CP-2 | Voter views a pending/rejected candidate's photo in their own institution | Storage SELECT policy requires `c.status = 'approved'` for general access, or the viewer must be the candidate/admin | Voter attempts to download pending candidate photo → expect 403 |
| CP-3 | Candidate from Inst A uploads a photo with a path containing Inst B's `institution_id` | INSERT policy checks `(storage.foldername(name))[1] = my_institution_id()::text` | Candidate crafts upload path with wrong institution_id → expect RLS violation |
| CP-4 | Candidate uploads a photo for someone else's user_id in the path | INSERT policy checks `(storage.foldername(name))[3] = auth.uid()::text` | Candidate uploads with another user's UUID in path → expect RLS violation |
| CP-5 | Attacker uploads a `.exe` renamed to `.jpg` (content-type mismatch) | Bucket-level MIME restriction + Edge Function magic-byte validation | Upload file with `image/jpeg` content-type but `.exe` magic bytes → expect rejection |
| CP-6 | Candidate uploads a 50 MB image to exhaust storage | Bucket-level `file_size_limit: 2097152` | Upload 50 MB file → expect 413 / rejection from Supabase Storage |
| CP-7 | Non-candidate user (voter who didn't nominate) uploads a photo | INSERT policy requires `exists(candidates c where c.user_id = auth.uid() and ...)` | Voter with no nomination uploads to a valid-looking path → expect RLS violation |
| CP-8 | Candidate uploads photo when election is not in `nomination_open` | INSERT policy checks `e.status = 'nomination_open'` | Candidate uploads photo when election is `voting_open` → expect RLS violation |

---

## Appendix: Summary of all new database objects

| Object | Type | Could-tier feature |
|---|---|---|
| `get_platform_metrics()` | RPC (function) | Platform Admin dashboard |
| `institutions_select` | RLS policy on `institutions` | Platform Admin + general tenant isolation |
| `roster_import_errors` | Table (locked schema, reproduced) | CSV validation |
| `roster_import_errors_admin_access` | RLS policy on `roster_import_errors` | CSV validation tenant isolation |
| `idx_roster_import_errors_institution_imported` | Index | CSV validation query perf |
| `candidate-photos` | Storage bucket | Candidate photo |
| `storage_candidate_photo_insert` | Storage policy | Photo upload control |
| `storage_candidate_photo_update` | Storage policy | Photo replace control |
| `storage_candidate_photo_select` | Storage policy | Photo visibility control |
| `storage_candidate_photo_delete` | Storage policy | Photo admin cleanup |
