# Proposal — Archetype-Driven UX Revival (`archetype-ux-revival`)

## Problem statement

Post-UNITED24-reskin audit (finish-gate reviewer + UX architect lenses, CCD ballot
guidance, GlitchLabs/Stripe operational-dashboard research) found the site visually
themed but generically structured: three equal CTAs diluted the voter fast-path, the
ballot implied 2 steps but submitted in 1, results declared false winners on ties,
both admin dashboards were card galleries with daily queues buried under one-time
setup, `CreateElectionForm` allowed typo-scoped elections, approvals were blind
(no photo), and focus states were missing repo-wide.

## Archetype lenses

- **Voter** (seconds, mobile): next action first, linear stepper, zero learning.
- **Department admin** (minutes, episodic): own-dept queue first, scope always visible.
- **Institution admin** (daily driver): Stripe-style table-first ops console with an
  exception strip; density is a feature.

## Scope

Frontend only. No schema/RLS/RPC/status-transition changes. Ballot confirm step is
a client-state gate before the same single `votes.insert` — UNIQUE + RLS semantics
unchanged.

## Exit criteria

Per-phase finish evidence (see tasks.md); build + lint clean; 33-test suite green.
