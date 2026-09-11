# SDLC × IDE Playbook — College Voting Platform

Companion to `AGENTS.md` and `CONTINGENCY_MATRIX.md`. You're running solo, one IDE open at a time — so this is a **serial** pipeline: finish a phase, review + commit, then move on. Don't run Antigravity and Trae simultaneously; there's no second set of hands to supervise both.

**Read `CONTINGENCY_MATRIX.md` before Phase 0 — it now opens with a §0 "One-Day Sprint Mode" section.** This build is targeting same-day delivery with zero spend and GUI-only tools (no CLI, no API credits), which changes the original playbook's "wait for the weekly reset" assumption for Phase 2 and Phase 6 — see §0 and §2's emergency protocol before you start. This file's original quota table below is kept for the prompts and phase structure, but for current numbers and sequencing, defer to `CONTINGENCY_MATRIX.md` §0–§1.

## 0. Why this IDE split

- **Antigravity** gets the high-stakes reasoning work: requirements, schema/RLS design, backend, testing, security, devops. Its Planning Mode forces a reviewable plan before code, its multi-model choice lets you reserve the strongest reasoning (Claude Opus 4.6 / Gemini 3.1 Pro High) for the two moments that actually need it, and its browser-verification artifacts (screenshots of before/after states) are a natural fit for the Evidence Collector / Reality Checker QA loop.
- **Trae** gets the frontend build-out. This app has a *lot* of screens (voter portal, 3 admin tiers, CSV uploader, photo upload) and Trae's SOLO/Builder loop is built exactly for "describe a screen, get scaffolded code, iterate fast." Its free tier's real constraint is SOLO run count, not raw chat volume, so the routing below treats SOLO as a scarce resource.

## 1. Free-tier quota budget — spend it deliberately

| Resource | Free-tier budget (subject to change — check in-app) | Spend it on |
|---|---|---|
| Antigravity — Gemini 3.1 Pro (High) | Weekly quota, slow responses | Nothing routine — reserve for Phase 2 if Opus is exhausted |
| Antigravity — Claude Opus 4.6 | Weekly quota, most scarce model | Phase 2 (schema+RLS design) and Phase 6 (security audit) only |
| Antigravity — Claude Sonnet 4.6 | Weekly quota, faster | Phases 0, 3, 5, 7 — the day-to-day implementation/QA/devops work |
| Antigravity — Gemini Flash | Weekly quota, fastest | Routine grunt work: repo setup, CI config, doc generation |
| Trae — SOLO Mode | ~10 fast + 50 slow runs/month | **One** well-specified full scaffold run at the start of Phase 4. Don't re-run SOLO per screen. |
| Trae — Builder/Chat Mode | Governed by Basic Usage token pool, 5,000 autocompletions/mo | All the iterative per-screen refinement after the SOLO scaffold |
| chat.z.ai — GLM-4.5-Flash / GLM-4.6V-Flash (free) | No repo access, no tool-calling, no test execution — plain web chat | **Emergency fallback only**, see §1a below |

Before every phase, check **Settings → Models** in Antigravity for your weekly refresh countdown and Trae's usage balance, so you're not caught mid-task. As of Sept 2026 both tools' quota mechanics have shifted from what the table above assumes — see `CONTINGENCY_MATRIX.md` §1 before trusting these numbers.

### 1a. Fallback ladder — see CONTINGENCY_MATRIX.md §2

The single chat.z.ai fallback tier this section used to describe is superseded by a five-tier ladder in `CONTINGENCY_MATRIX.md` §2, built around your actual access (DeepSeek + Gemini, no Kimi). Short version: try switching models *within* Antigravity or modes *within* Trae first; only reach for an external chat (Gemini Code Assist, then DeepSeek, then Gemini app) once the whole tool's quota — not just one model — is gone. The one rule that never changes: RLS policies and the `votes`/`elections` status-gating logic get Phase-2/6-grade review or they don't ship, regardless of which tier you're on.

---

## Phase 0 — Environment & Repo Setup

**IDE:** Antigravity · **Mode:** Agent Mode · **Model:** Claude Sonnet 4.6 (routine, no need for Pro/Opus)
**Agents:** DevOps Automator, Git Workflow Master
**One-day build note:** nothing is set up yet — this phase now includes creating the Supabase project and a synthetic CSV sample live, not just scaffolding. See `CONTINGENCY_MATRIX.md` §0c.

```text
You are acting as the DevOps Automator and Git Workflow Master agents
(personas at engineering/engineering-devops-automator.md and
engineering/engineering-git-workflow-master.md).

Read AGENTS.md and ARCHITECTURE.md in full before doing anything else.

Set up the repo:
1. Initialize a Next.js (App Router, TypeScript, Tailwind) project in this
   directory.
2. Run `npm install -g @openspec/cli` (or the current install method — check
   the OpenSpec README if this fails) and run `openspec init`.
3. Create this directory structure:
   openspec/changes/, openspec/specs/, supabase/migrations/,
   supabase/functions/, app/, components/, tests/.
4. Walk me through creating a free Supabase project via the dashboard (no
   card should be required for the free tier — flag it to me immediately
   if the flow asks for one). Once I paste in the project ref and keys,
   create `.env.local.example` with placeholders for
   NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, and a real
   `.env.local` (gitignored) with the actual values.
5. Generate a synthetic CSV roster sample (fake names/emails/departments,
   ~15-20 rows, matching the `roster` table shape in AGENTS.md) since no
   real institution data exists yet — save it as `sample-data/roster.csv`.
6. Initialize git with a conventional-commits-friendly `.gitignore` and an
   initial commit. Do not push anywhere yet.
7. Stop and summarize what you set up before doing anything else — do not
   start on Phase 1 work in this same run.
```

**Exit criteria:** `openspec init` succeeded, Next.js app boots, Supabase env vars wired, git initialized. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 1 — Requirements Lock (Planning)

**IDE:** Antigravity · **Mode:** Planning Mode · **Model:** Gemini 3.1 Pro (High) — this is the one phase where slow, deep reasoning across the *entire* MoSCoW scope pays for itself.
**Agents:** Workflow Architect, Software Architect

```text
Acting as Workflow Architect (specialized/specialized-workflow-architect.md)
and Software Architect (engineering/engineering-software-architect.md).

Read AGENTS.md and ARCHITECTURE.md completely. Do not write any code in
this session — Planning Mode only.

Task: produce an OpenSpec proposal for the full Must+Should+Could scope
defined in AGENTS.md's "MoSCoW scope for this build" section.

Run: /opsx:propose voting-platform-v1

In proposal.md, capture:
- Why we're building each MoSCoW tier now (not just Must)
- What's explicitly out of scope (the Won't tier)

In specs/, write requirements + Given/When/Then scenarios for every
Must and Should item, plus the three Could items (Platform Admin
dashboard, CSV validator with row-level errors, candidate photo upload).

In design.md, map every user-facing path: voter first login → roster
match → vote; institution self-serve signup; department admin
nomination approval; platform admin cross-tenant view. Flag any path
that isn't already covered by ARCHITECTURE.md §4/§5 RLS policies.

If anything here would require reinterpreting a locked decision in
ARCHITECTURE.md §1, stop and list it separately instead of quietly
deciding it yourself.

Do NOT run /opsx:apply yet. Stop after proposal + specs + design.md
exist, so I can review before any tasks.md/implementation work starts.
```

**Exit criteria:** `openspec/changes/voting-platform-v1/` has proposal.md, specs/, design.md — reviewed and approved by you before moving on. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 2 — System & Database Design (Schema + RLS)

**IDE:** Antigravity · **Mode:** Agent Mode · **Model:** Claude Opus 4.6 (highest stakes phase — multi-tenant RLS mistakes are the single most expensive bug class in this app)
**Agents:** Backend Architect, Database Optimizer, Security Architect (recommended addition)
**Do this phase as early in the day as possible** — see `CONTINGENCY_MATRIX.md` §0b. **If Opus 4.6's quota is gone:** switch to Gemini 3.1 Pro (High) inside Antigravity, don't leave the tool. If the whole Antigravity pool is dead and today's deadline won't allow waiting, this is the pipeline's one real single point of failure — see the emergency protocol in `CONTINGENCY_MATRIX.md` §2, which trades increased risk for same-day delivery deliberately, not by accident.

```text
Acting as Backend Architect, Database Optimizer, and Security Architect
(engineering/engineering-backend-architect.md,
engineering/engineering-database-optimizer.md,
security/security-architect.md).

Read AGENTS.md's "Database schema" and "Row Level Security policies"
sections (this is the authoritative, current version — ARCHITECTURE.md
§3-4 is the same content, kept only as the original decision record)
and openspec/changes/voting-platform-v1/design.md.

The base schema and RLS policies in AGENTS.md are LOCKED — reproduce
them exactly, do not "improve" them. Your job is to EXTEND them for
the Could-tier items only:

1. Platform Admin cross-institution view: design a read-only RPC
   (following the same pattern as get_election_results — never a raw
   table grant) that lets platform_admin see aggregate stats across
   institutions without exposing individual votes or roster PII.
2. CSV roster validator: design a `roster_import_errors` table (or
   equivalent) that captures row-level validation failures (bad email,
   missing department, duplicate roll_no) from an upload attempt, scoped
   by institution_id with RLS matching the existing roster_admin_access
   policy.
3. Candidate photo storage: design a Supabase Storage bucket policy —
   candidates can upload their own photo during nomination, approved
   photos are publicly readable, pending/rejected ones are not, and
   file size/type are constrained server-side, not just client-side.

Write this as design.md updates + a new tasks.md under
openspec/changes/voting-platform-v1/, with SQL in code blocks. Call out
explicitly, for each new policy, which cross-tenant leak scenario it's
meant to prevent — this becomes the test case list for Phase 6.

Do not touch votes, elections, candidates, or profiles table
definitions from ARCHITECTURE.md — those are locked.
```

**Exit criteria:** design.md extended, tasks.md exists, every new RLS policy has a named leak scenario attached. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 3 — Backend Implementation

**IDE:** Antigravity · **Mode:** Agent Mode · **Model:** Claude Sonnet 4.6
**Agents:** Backend Architect, Database Optimizer, Autonomous Optimization Architect, Minimal Change Engineer

```text
Acting as Backend Architect, Database Optimizer, Autonomous Optimization
Architect (for the CSV-parsing Edge Function's model/cost routing if it
uses AI-assisted validation), and Minimal Change Engineer as a guardrail
against scope creep.

Read openspec/changes/voting-platform-v1/tasks.md — implement ONLY
what's listed there. If you think something extra is needed, add it to
tasks.md first and ask before implementing it.

1. Write all Postgres migrations under supabase/migrations/, in the
   order: institutions → profiles → roster → elections → candidates →
   votes → roster_import_errors → storage policies. Include every RLS
   policy from AGENTS.md's "Row Level Security policies" section
   verbatim plus the Phase 2 extensions.
2. Implement claim_voter_profile and get_election_results exactly as
   specified in AGENTS.md.
3. Implement the CSV roster upload Edge Function: parse, validate
   row-by-row (roll_no, email, department, year present and
   well-formed), write failures to roster_import_errors, bulk-insert
   valid rows to roster.
4. Run the migrations locally against a Supabase dev instance and
   confirm no errors.

After each migration file, state in plain text which non-negotiable
from the RLS policies section it upholds.
```

**Exit criteria:** migrations apply cleanly, RPCs callable, CSV Edge Function returns per-row validation results. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 4 — Frontend Implementation

**IDE:** Trae · **Mode:** SOLO Mode for the initial scaffold (one run), then Builder Mode for iteration · **Model:** Claude 4.6 Sonnet
**Agents:** Frontend Developer, Rapid Prototyper, Senior Developer

**Step 4a — one SOLO run, scaffold everything:**

```text
Acting as Frontend Developer and Rapid Prototyper
(engineering/engineering-frontend-developer.md,
engineering/engineering-rapid-prototyper.md).

Read AGENTS.md and openspec/changes/voting-platform-v1/specs/ before
starting. This is a Next.js + Tailwind app connecting to an existing
Supabase backend (schema and RLS already implemented — do not modify
supabase/migrations/).

Scaffold the full frontend in one pass:
1. Voter flow: email entry → OTP → claim_voter_profile call → eligible
   elections list → candidate list (approved only) → self-nomination
   form (when nomination_open) → vote casting (when voting_open,
   disabled after voting) → results view (locked until closed).
2. Institution self-serve signup: institution name + admin email → OTP
   → institution + institution_admin profile created.
3. Institution Admin dashboard: roster CSV upload with per-row error
   display, invite Department Admin, create institution-wide or
   dept-scoped elections, approve/reject candidates across the
   institution.
4. Department Admin dashboard: create dept-scoped elections only,
   approve/reject candidates for own dept elections only.
5. Platform Admin dashboard: cross-institution aggregate view via the
   Phase 2 RPC — no per-vote or per-voter data, aggregates only.
6. Candidate self-nomination form: manifesto text + photo upload to the
   Supabase Storage bucket from Phase 2, with client-side size/type
   check (server already enforces the real limit).

Use Supabase client SDK directly from the app — do not invent a custom
backend layer. Styling: default Tailwind utility classes only, no
custom design tokens, no component library, no polish pass — this
build only needs to be correct and usable, not good-looking. Don't
spend agent turns on visual refinement. Stop and list every screen you
built when done, so I can review before we refine anything.
```

**Step 4b — iterative refinement in Builder/Chat Mode, one screen at a time**, e.g.:

```text
Refine the CSV uploader screen only. Show validation errors from
roster_import_errors grouped by error type, with a "download error
report" CSV export. Don't touch any other screen or any backend file.
```

**Exit criteria:** every screen in AGENTS.md's MoSCoW table renders and talks to Supabase correctly; election eligibility and vote-once enforcement visibly work in the UI (even though the DB is the real gate). Visual polish is explicitly out of scope for this pass — don't gate this phase on "looks good." Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 5 — Testing & QA

**IDE:** Antigravity · **Mode:** Agent Mode with browser verification enabled · **Model:** Claude Sonnet 4.6
**Agents:** Evidence Collector, Reality Checker, Test Automation Engineer (recommended additions)

```text
Acting as Test Automation Engineer, Evidence Collector, and Reality
Checker (testing/testing-test-automation-engineer.md,
testing/testing-evidence-collector.md, testing/testing-reality-checker.md).

Write and run:
1. The 3 required unit tests from ARCHITECTURE.md §6 (Should tier):
   double-vote rejected by UNIQUE(voter_id, election_id), vote insert
   rejected when election.status != 'voting_open', and tally from
   get_election_results matches a hand-computed expected count for a
   seeded test election.
2. A cross-tenant leak test for each policy flagged in Phase 2's
   design.md: confirm a user from Institution A cannot read Institution
   B's roster, elections, candidates, or aggregate results.
3. Using browser verification, walk through the full voter journey
   (signup → OTP → vote → locked results) and the institution-admin
   journey (CSV upload → approve candidate → close election → view
   results), capturing a screenshot artifact at each major step.

Do not mark anything as passing without either a green test run or a
screenshot artifact as evidence — Reality Checker should refuse to
certify otherwise.
```

**Exit criteria:** all unit + leak tests green, screenshot walkthrough attached to the OpenSpec change. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 6 — Security Review

**IDE:** Antigravity · **Mode:** Agent Mode · **Model:** Claude Opus 4.6 (second and final scarce-quota use)
**Agents:** Security Architect, AI-Generated Code Security Auditor, Identity & Access Engineer (recommended additions)
**Do this as soon as Phases 3-5 are done, not saved for the day's end** when quota is most depleted. **If Opus 4.6's quota is gone:** same rule as Phase 2 — switch models inside Antigravity first. If the whole pool is dead, this audit is exactly what has to catch anything Phase 2's emergency protocol let through — don't skip its rigor even under time pressure; see `CONTINGENCY_MATRIX.md` §2-§3.

```text
Acting as Security Architect, AI-Generated Code Security Auditor, and
Identity & Access Engineer (security/security-architect.md,
security/security-ai-generated-code-auditor.md,
engineering/engineering-identity-access-engineer.md).

Audit the full codebase generated in Phases 3-4 for:
1. Any hardcoded secrets, API keys, or service-role keys leaked into
   client-side code (the anon key is fine client-side; the service
   role key must never appear outside Edge Functions/server code).
2. Every RLS policy against its stated leak scenario from Phase 2 —
   confirm the policy actually blocks it, don't just confirm it exists.
3. profiles_update_own: confirm a voter genuinely cannot self-escalate
   role or institution_id through any code path, including the
   claim_voter_profile RPC's upsert logic.
4. The self-serve institution signup flow for abuse: can someone spam
   institutions, or claim an institution name that collides/squats on
   an existing one?
5. Candidate photo upload: confirm the storage policy from Phase 2 is
   enforced server-side, not just in the Trae-generated client code.

Produce a findings list ranked by severity. For anything Critical or
High, stop and flag it — do not auto-fix without confirming the fix
first.
```

**Exit criteria:** no Critical/High findings outstanding; any accepted-risk Medium/Low findings documented. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 7 — DevOps & Deployment

**IDE:** Antigravity · **Mode:** Agent Mode · **Model:** Gemini 3.1 Pro (Flash) — routine work
**Agents:** DevOps Automator, SRE, Git Workflow Master

```text
Acting as DevOps Automator, SRE, and Git Workflow Master.

1. Set up a GitHub Actions (or equivalent) CI pipeline: lint, type
   check, run the Phase 5 test suite, on every PR.
2. Set up Supabase migration deployment (via `supabase db push` or CLI
   migration deploy) gated behind CI passing.
3. Deploy the Next.js app to Vercel (or confirm my actual target if
   different), with environment secrets set in the platform's secret
   manager, never committed to the repo.
4. Write a short runbook: how to roll back a bad migration, how to
   check current election statuses in prod, who/what to check first if
   votes aren't being recorded.

Confirm no secret ever appears in a git-tracked file before finishing.
```

**Exit criteria:** CI green on a test PR, app reachable at a live URL, secrets confirmed out of git history. Before saying "continue," run the §4b checklist in `CONTINGENCY_MATRIX.md`.

---

## Phase 8 — Documentation & Governance Handoff

**IDE:** Either (Antigravity recommended for consistency with the rest of this pipeline) · **Mode:** Agent Mode · **Model:** Gemini Flash / Claude Sonnet 4.6
**Agents:** Technical Writer, Workflow Architect

```text
Acting as Technical Writer and Workflow Architect.

1. Write README.md: setup instructions, env vars needed, how to run
   locally, how to run tests, link to AGENTS.md and
   SDLC_IDE_PLAYBOOK.md for anyone (human or agent) picking this up
   later.
2. Run /opsx:archive on the voting-platform-v1 change — confirm specs/
   now reflects the merged, living state of the system.
3. Update AGENTS.md's Changelog section with what shipped in this pass and
   what's still open (the Won't tier, plus anything deferred out of
   Phase 6 findings).

Do not modify any code in this phase — documentation and OpenSpec
archival only.
```

**Exit criteria:** README complete, OpenSpec change archived, AGENTS.md changelog current. Before calling this done, run the §4c delivery checklist in `CONTINGENCY_MATRIX.md`.
