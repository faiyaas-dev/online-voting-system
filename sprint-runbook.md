# Sprint Runbook — College Voting Platform (AI-SDLC buckets)

**Team:** Faiyaas (core build), Aathi (DB/RLS), Salih (frontend/auth)
**Start:** 09:15 IST · **Realistic end:** ~12:35 IST
**Primary:** Antigravity IDE (built-in Git VCS, Planning/Fast modes) · **Backup:** Trae (only if Antigravity fails/quota runs out)
**Structure:** 4 SDLC buckets — **PLAN → BUILD → VERIFY → DEPLOY** — this mirrors Antigravity's own native agent modes (Planning / Execution / Verification) and Trae's SOLO-Code pipeline (Plan → Code → Test → Deploy), so it's not an invented framework, it's how both tools already think about work.

**How every step is written, no exceptions:**
`Bucket · Time · Who · Mode (Planning/Fast) · Model priority (use the strongest available in your picker, top to bottom) · Skill (if any, as a bare /slash-command) · Prompt · Verify`

**Model tiers used below** (per Antigravity's own model roster, late Aug 2026 — your free-tier picker may not show all of these, that's why it's a priority list, not one name):

- **CRITICAL:** `Claude Opus 4.6 (Thinking) → Claude Sonnet 4.6 (Thinking) → Gemini 3.7 → Gemini 3.1 Pro`
- **STANDARD:** `Gemini 3.1 Pro → Gemini 3.6 → Gemini 3.5 Flash`
- **FAST:** `Gemini 3.5 Flash → Gemini 3.1 Pro`
- If your best available model for a CRITICAL step is still weak, use `/boost` (multi-agent reasoning pipeline, Antigravity Aug-2026 feature) instead of downgrading the task's rigor.

**Git/Deploy flow (confirmed):** Everything in PLAN/BUILD/VERIFY stays **local** — Antigravity's Source Control panel, stage + commit as you go, AI-generated commit messages, no GitHub involved yet. GitHub and Netlify are touched exactly once, in DEPLOY, at the end.

**Cut order if tight:** DEPLOY's live Netlify hosting (local demo is the real Must-have) → the two skipped-by-design agents noted at the bottom → style polish. Never cut RLS review, vote-lock review, or the 3 unit tests.

---

## Bucket 0 — Verify your setup (5 min, do this first, once)

**0.1 · 09:15 · Ellarum · Fast · STANDARD**
Resolve the AGENTS.md-vs-GEMINI.md question for your actual install instead of guessing:

```
List every project-context file you loaded when this workspace opened —
exact filenames and paths (AGENTS.md, GEMINI.md, .antigravity.md,
.agents/rules/*, anything else). Don't summarize, just list what you
actually read.
```

If it lists `GEMINI.md` or `.antigravity.md`, keep those files (this runbook assumes only `AGENTS.md` exists — add a one-line pointer to whichever extra file it names: `See AGENTS.md for project context.`). If it lists only `AGENTS.md`, you're already correctly set up — no `GEMINI.md` needed, safe to delete the one from an earlier round.

**0.2 · 09:15–09:20 · Ellarum · Planning · STANDARD**
`/engineering-software-architect` `/specialized-workflow-architect`

```
Paste ARCHITECTURE.md and this runbook. Sanity-check in under 5 minutes —
flag only show-stoppers, not style nitpicks. We start building right
after this.
```

**Verify:** No blocking issue, or issue raised + resolved.

---

## Bucket 1 — PLAN (09:20–09:40)

**1.1 · 09:20–09:23 · Salih · n/a (Antigravity Source Control panel)**
Source Control icon → **Initialize Repository** (local only — do NOT click Publish to GitHub yet).
**Verify:** Local `.git` exists, first commit made ("initial scaffold").

**1.2 · 09:20–09:25 · Aathi · n/a (Supabase dashboard)**
Create Supabase project, save URL + anon key.
**Verify:** Project shows "Active".

**1.3 · 09:25–09:30 · Faiyaas · Fast · FAST**
`/engineering-prompt-engineer`

```
I'm about to run /opsx:propose for the Must-have slice in
ARCHITECTURE.md Section 6. Tighten this into a clean propose prompt —
keep every Must-have item, cut nothing.
```

**1.4 · 09:30–09:40 · Faiyaas · Planning · STANDARD**

```bash
openspec init
```

```
/opsx:propose college-voting-mvp

Build the Must-have slice of a multi-tenant college voting platform, per
ARCHITECTURE.md Section 6. Exactly this, nothing from Should/Could/Won't:
- One institution (self-created via signup flow)
- Roster upload (CSV paste/upload: roll_no, email, department, year)
- OTP/magic-link auth for voters and institution admin (same flow)
- Multi-level elections: scope_department + scope_year (null = all)
- Self-nomination by voters, institution-admin approve/reject
- One vote per voter per election, enforced at DB level
- Closed-election vote lock, enforced at DB level
- Results hidden from voters until election closed
Reference schema and RLS: ARCHITECTURE.md Sections 3–4. Do not add
Department Admin tier or Platform Admin dashboard in this pass.
```

**Verify:** `openspec/changes/college-voting-mvp/` has `proposal.md`, `specs/`, `tasks.md`. Commit locally.

---

## Bucket 2 — BUILD (09:40–11:45, commit locally after each numbered step)

**2.1 · 09:40–09:45 · Aathi · Planning · STANDARD**
`/engineering-database-optimizer`

```
Review the schema SQL in ARCHITECTURE.md Section 3 (institutions,
profiles, roster, elections, candidates, votes) for missing indexes on
foreign keys and the (voter_id, election_id) lookup path.
```

**2.2 · 09:45–10:00 · Aathi · Fast · FAST (direct SQL execution)**
Run ARCHITECTURE.md Section 3 SQL (+ Step 2.1 fixes) in Supabase SQL editor.
**Verify:** `select table_name from information_schema.tables where table_schema='public';` — 6 tables. Commit locally.

**2.3 · 09:40–09:45 · Salih · Fast · FAST (parallel with 2.1)**
`/engineering-frontend-developer`

```
About to scaffold /login, /elections, /vote/:id, /results/:id, /admin —
static layout only. Sprint speed, Tailwind defaults are fine.
```

**2.4 · 09:45–10:03 · Salih · Fast · FAST**

```
Context: React + Vite + Tailwind, voting-system, no data logic yet.
Task: Scaffold routes: /login (OTP form), /elections (static list),
/vote/:electionId (static), /results/:electionId (static), /admin
(tabs: roster upload, election create, candidate approval).
Output: code only, list files changed/created. No Supabase calls yet.
```

**Verify:** `npm run dev` — 5 routes render 200, console clean. Commit locally.

**2.5 · 10:00–10:07 · Aathi · Planning · CRITICAL**
`/engineering-backend-architect`

```
Multi-tenant system — RLS is the ONLY real tenant-isolation boundary.
Review ARCHITECTURE.md Section 4 policies (my_institution_id(),
my_role(), roster/elections/votes policies, plus the candidates-table
pattern) for any gap letting one institution read/write another's data.
```

**2.6 · 10:07–10:25 · Aathi · Planning · CRITICAL**
Run ARCHITECTURE.md Section 4 SQL (+ Step 2.5 fixes) in Supabase SQL editor.
**Verify:** `select tablename, rowsecurity from pg_tables where schemaname='public';` — all `true`. Commit locally.

**2.7 · 10:03–10:23 · Salih · Planning · STANDARD (parallel with 2.5–2.6)**

```
Context: React + Vite + Supabase, voting-system, pages scaffolded, schema
ready. No passwords anywhere — OTP/magic-link only.
Task:
1. src/lib/supabaseClient.js using VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
2. /login: email → supabase.auth.signInWithOtp({ email }).
3. On callback: call RPC supabase.rpc('claim_voter_profile', { p_institution_id }).
   If success → redirect to /elections (role='voter'). If roster mismatch/error →
   "create your institution" flow (new institution + role='institution_admin').
4. Auth guard on all routes except /login.
Output: code only, list files changed/created.
```

**Verify:** Magic-link arrives, roster-matched login creates correct `profiles` row via claim_voter_profile. Commit locally.

*(Faiyaas free 09:30–10:25 — sits in on Step 2.5, the highest-stakes review in the sprint.)*

**2.8 · 10:25–10:30 · Faiyaas · Fast · STANDARD**
`/engineering-senior-developer` `/engineering-rapid-prototyper`

```
3-hour timeboxed academic sprint, Must-have only (ARCHITECTURE.md
Section 6). Production-quality code at sprint speed for Steps 2.9–2.11 —
no gold-plating, no premature abstraction.
```

**2.9 · 10:30–10:50 · Faiyaas · Planning · STANDARD**

```
Context: React + Vite + Supabase voting-system. Schema/RLS/auth ready —
do not alter schema. Logged-in institution_admin only for this pass.
Task: /admin election-create tab:
1. Form: title, scope_department, scope_year, opens_at, closes_at.
2. Insert into `elections` status='draft'. Button: draft →
   nomination_open → voting_open → closed (sequential, no skip-back).
3. /elections (voter-facing): only elections matching voter's
   institution/department/year, status in
   ('nomination_open','voting_open').
Output: code only, list files changed. Reuse existing supabaseClient.js.
```

**Verify:** Create election, voter side only shows it if dept/year matches. Commit locally.

**2.10 · 10:50–11:15 · Faiyaas · Planning · STANDARD**

```
Context: React + Vite + Supabase voting-system, election-create done.
Task:
1. Voter-facing: on nomination_open election they're eligible for,
   "Nominate myself" — inserts `candidates` status='pending' + manifesto.
2. Admin (/admin candidates tab): approve/reject per election.
3. /vote/:electionId only shows status='approved' candidates.
Output: code only, list files changed.
```

**Verify:** Self-nominate → pending → approve → appears on /vote. Commit locally.

**2.11 · 11:15–11:45 · Faiyaas · Planning · CRITICAL (highest-stakes build step — do not downgrade the model here)**

```
Context: React + Vite + Supabase voting-system, candidates approved,
election can be status='voting_open'.
Task:
1. /vote/:electionId: cast one vote (insert `votes`). Handle
   UNIQUE(voter_id, election_id) gracefully ("already voted"). Handle
   closed-election insert rejection gracefully ("voting is closed").
2. /results/:electionId: call supabase.rpc('get_election_results', { p_election_id }).
   RPC handles status check (rejects before close unless institution_admin).
   Display tally breakdown per candidate.
Output: code only, list files changed. Reuse existing supabaseClient.js.
```

**Verify:** Vote once (success) → vote again (blocked) → admin close → vote after close (blocked, DB-level) → results hidden until close, then correct count via get_election_results RPC. Commit locally.

*(Parallel, 11:15–11:25, Aathi/Salih, optional — `/engineering-devops-automator` — prep Netlify env vars ahead of Bucket 4.)*

---

## Bucket 3 — VERIFY (11:45–12:15)

**3.1 · 11:45–11:52 · Aathi · Fast · STANDARD (parallel, doesn't block Faiyaas)**
`/engineering-minimal-change-engineer`

```
Paste the diff from Steps 2.9–2.11 and ARCHITECTURE.md Section 6
Must-have list. Flag anything Should/Could/Won't that shouldn't be here
yet — not cutting working code, just flagging scope creep.
```

**3.2 · 11:45–11:52 · Salih · Fast · FAST (parallel)**
`/engineering-sre`

```
Review the vote-cast and auth flows (2.7, 2.11) for ungraceful failure
modes — network drop mid-vote, expired magic link, double-submit on slow
connection. One-paragraph findings, fix only what's a 2-minute change.
```

**3.3 · 11:52–12:02 · Faiyaas · Planning · CRITICAL**
`/testing-reality-checker`

```
Find 3-5 real issues before I trust this is done — specifically: does
the closed-election lock actually reject at the DB level (not just hide
the button)? Does double-vote actually fail via the UNIQUE constraint?
Does any results view leak before close? Require visual/query proof for
each check, not "looks fine."
```

**3.4 · 12:02–12:05 · Faiyaas · Fast · FAST**

```
/opsx:verify
```

**Verify:** "no mismatches" in output.

**3.5 · 12:05–12:15 · Faiyaas · Planning · STANDARD**
`/testing-evidence-collector` (runs alongside)

```
Write unit tests (Vitest):
1. Second vote insert for same voter+election is rejected.
2. Vote insert after election.status='closed' is rejected.
3. Tally count for a candidate matches raw row count in votes.
Output: test file only.
```

```
Capture proof alongside the test run — test output plus a
screenshot/SQL query result showing both rejections happened at the
database level. Package as submission evidence.
```

**Verify:** `npm run test` — 3 tests green. Commit locally.

*(Parallel, 12:05–12:12, optional — Aathi/Salih — `/testing-test-results-analyzer` — plain-language read of the test output for submission notes.)*

---

## Bucket 4 — DEPLOY (12:15–12:35, GitHub/Netlify touched for the first time here)

**4.1 · 12:15–12:20 · Aathi/Salih · Fast · FAST**
`/engineering-technical-writer`

```
Paste AGENTS.md and ARCHITECTURE.md. Tighten wording for submission — no
new sections, just make sure a professor reading this in 5 minutes
understands what was built and why.
```

**4.2 · 12:20–12:23 · Salih · n/a (Antigravity Source Control panel)**
Source Control → **Publish to GitHub**. First time the repo leaves local.
**Verify:** Repo visible on github.com, all local commit history intact.

**4.3 · 12:23–12:32 · Aathi · n/a (Netlify dashboard or CLI) · stretch, skip if tight**
Connect the new GitHub repo to Netlify (auto-deploy on push) or:

```bash
netlify init
netlify env:set VITE_SUPABASE_URL "<project-url>"
netlify env:set VITE_SUPABASE_ANON_KEY "<anon-key>"
netlify deploy --prod
```

**Verify:** Live URL loads, one real end-to-end flow (vote cast) works in production.

**4.4 · 12:32–12:35 · Ellarum**
Screenshots/clip of the local (or live) demo, save repo + live link (if deployed) where all three can access.

---

## Skipped by design

`/testing-workflow-optimizer` and `/engineering-autonomous-optimization-architect` — retro/roadmap passes, zero build impact if skipped. Run later against ARCHITECTURE.md Section 5, outside this window.
