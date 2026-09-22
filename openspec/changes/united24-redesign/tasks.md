# Tasks — UNITED24 Civic-Trust Redesign (`united24-redesign`)

> Rollout order per DESIGN.md §12. Each task: implement → `npm.cmd run build` + lint →
> 375px/1440px visual check → keyboard pass. Final: full §5 quality gates.

- [x] 1. Tokens — extend `tailwind.config.js` (united palette, display/sans/mono, neon shadows, ticker/float-up keyframes)
- [x] 2. Globals — `app/globals.css` (yellow focus, yellow selection, yellow card glow, `.glass-panel`, `.text-glow-yellow`, reduced-motion coverage)
- [x] 3. Shell — `app/layout.tsx` (ink bg, antialiased, themeColor) + ticker strip + `GlobalNav` sticky glass / yellow dot / pill roles / persistent links
- [x] 4. Landing — `app/page.tsx` (accent hero, yellow CTAs, live proof row, bordered cards)
- [x] 5. Elections list — `app/elections/page.tsx` + `LiveCountdown` chip tiers (neon status, turnout pill, yellow Vote Now; filter-chip bar deferred — RLS server list kept)
- [x] 6. Ballot — `app/elections/[id]/vote/page.tsx` (step bar, yellow countdown chip, yellow selection, pill submit, receipt copy)
- [x] 7. Results + celebration — `results/page.tsx` (victory panel, glow bars, ledger table, share strip, locked-with-countdown) + `VoteCelebration` (yellow theme, constrained particles, ledger line)
- [x] 8. Candidates + nominate — circular avatars, rounded pills, stepwise nominate form (search bar deferred — server list kept)
- [ ] 9. Auth — login/signup step indicators, mono OTP, institution context line (shell unified to ink; indicators follow-up)
- [x] 10. Admin portals — shell unified to ink on all three dashboards + auth pages (deep table restyle follow-up)
- [ ] 11. Verify — build, lint, `npm.cmd run test` (4 quality gates), 375/1440 + keyboard audit, commit `feat(ui): united24 civic-trust redesign`
