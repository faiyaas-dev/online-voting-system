# AGENTS.md — voting-system

Read `ARCHITECTURE.md` first for the full schema/RLS/logic — idhu file
short-a irukkanum nu intentional-a vechirukken (AGENTS.md convention:
short, commands-first). Antigravity, Trae, Claude Code, Cursor — ellame
indha file-a root-la irundhu automatic-a padikkum (Trae `AGENTS.md`
natively reads pannum, `.trae/rules/` folder venaam).

## Project
Multi-tenant college election SaaS — pala institutions, ovvoru institution-
kkum multiple concurrent elections, dept/year-scoped voters. Full vision:
`ARCHITECTURE.md`. **This sprint builds Must-have only — see
ARCHITECTURE.md Section 6.**

## Stack
React + Vite + Tailwind · Supabase (Postgres + Auth, RLS mandatory) ·
Netlify (host) · OpenSpec (spec-driven workflow, `openspec/`)

## Commands
```bash
npm run dev
npm run build
npm run test          # Vitest
netlify deploy --prod
```

## Conventions
- One Supabase client: `src/lib/supabaseClient.js`.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never hardcode.
- Auth is OTP/magic-link only — no password fields anywhere.
- Every table except `institutions` MUST have RLS enabled. If you add a
  table without a corresponding RLS policy, the task is not done.

## Database
Fixed schema in `ARCHITECTURE.md` Section 3 — `institutions`, `profiles`,
`roster`, `elections`, `candidates`, `votes`. Do not alter without an
OpenSpec change first.

## Correctness-critical rules (do not relax)
- Tenant isolation: every query implicitly scoped to the caller's
  `institution_id` via RLS (`my_institution_id()`), never via app-level
  filtering alone.
- One vote per voter per election — `UNIQUE(voter_id, election_id)` +
  RLS check on `elections.status='voting_open'` at insert time. Never
  remove either layer.
- Closed election locks votes at the DATABASE level, not UI-only.
- Voters never read the raw `votes` table for results — only an
  admin-only live view or a `results_public_view` gated on
  `status='closed'`.

## Boundaries
- Schema changes go through `openspec/` first.
- Never commit `.env` or a Supabase `service_role` key.
- Don't build Should/Could/Won't items (ARCHITECTURE.md Section 6) before
  every Must-have is done and verified.

## Workflow
OpenSpec for change management: `/opsx:propose <change-name>` before
building, `/opsx:verify` before calling a task done. See
`openspec/changes/` for active work.
