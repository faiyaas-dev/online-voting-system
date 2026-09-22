# Proposal — UNITED24 Civic-Trust Redesign (`united24-redesign`)

## Problem statement

The platform works end-to-end (OTP → roster claim → ballot → results) but looks like an
unbranded admin scaffold: scattered hex values, no design tokens (`tailwind.config.js`
`extend` is empty), mixed radii, blue-only selection glow, muted proof stats (`🔒` placeholders),
and no persistent trust signal. For a voting product this is a legitimacy problem, not a
cosmetics problem — first-time student voters must trust the ballot in under 10 seconds.

## Proposal

Adapt the UNITED24 rebuild-tracker design language (dark civic base, neon-yellow primary
action, persistent transparency ticker, bite-snack-meal data presentation) across the
Next.js frontend using functional Tailwind only. Research-backed by UNITED24 live patterns,
Center for Civic Design election-dashboard guidance, and Vote.gov stepwise civic UX.

## MoSCoW

- **Must:** token system (§4 of design.md), global shell (§6), elections list, ballot,
  results + celebration (§7–8). Trust signals on every voter-facing screen.
- **Should:** candidates, nominate, auth stepwise indicators, admin card/chip language.
- **Could:** share strip, ticker marquee animation, `I VOTED` badge share.
- **Won't:** any schema/RLS/RPC change; new dependencies; light mode; UNITED24 gov branding.

## Out of scope

`institutions`, `profiles`, `roster`, `elections`, `candidates`, `votes` tables; all RLS
policies and RPCs (`claim_voter_profile`, `create_institution_and_admin`,
`get_election_results`, `get_platform_metrics`); election status transitions.

## Exit criteria

DESIGN.md §§1–12 implemented in rollout order; per-step build+lint gate; final AGENTS.md §5
quality gates green (double-vote, closed-election, tally math, cross-tenant leak).
