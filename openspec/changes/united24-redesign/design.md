# DESIGN.md — UNITED24 Civic-Trust Redesign (`united24-redesign`)

> OpenSpec change design document. Status: approved for implementation.
> Scope: frontend/visual layer ONLY. No schema, RLS, RPC, or voting-status logic changes.
> Research basis: UNITED24 platform (u24.gov.ua), Center for Civic Design election-dashboard
> guidance, Vote.gov civic UX analysis, 2026 SaaS dark-mode / token-system best practices.

---

## 1. Vision & Non-Goals

**Vision:** Every screen of the college election platform should feel like a civic institution
voters already trust — the way UNITED24 feels like an official government platform: dark,
high-contrast, live numbers, audit reports one click away. A first-time student voter must
be able to answer in under 10 seconds: *is this legitimate, what do I do next, where is my vote counted?*

**Non-goals (explicitly out of scope):**

1. No database, RLS, RPC, or `elections.status` transition changes (locked by AGENTS.md).
2. No new runtime dependencies (no chart lib, no animation lib, no UI kit).
3. No light-mode theme, no theme toggle — dark-first is the product identity.
4. No copy of UNITED24 government branding, map, donation flow, or `.gov.ua` trust marks.
5. No bespoke marketing polish pass (AGENTS.md Won't-tier) — functional Tailwind only.

## 2. Source Analysis — What UNITED24 Does and Why It Works

Studied live: `u24.gov.ua/en`, `u24.gov.ua/reports/rebuild`, `u24.gov.ua/projects`,
`u24.gov.ua/news/united24_lun`, plus Eleken's design teardown.

| # | UNITED24 pattern | Mechanism of trust | Our adaptation |
|---|---|---|---|
| 2.1 | Persistent `Total collected: $X` ticker in header | Live aggregate number = proof the system is real and active | Transparency strip: total votes cast + active elections (aggregate RPCs only) |
| 2.2 | Map / List view toggle on rebuild tracker | Same data, two lenses; user chooses their mental model | Elections list keeps list rhythm; filter chips (All / Live / Nominations / Closed) act as the toggle |
| 2.3 | Per-direction reports (`Defense`, `Medical Aid`, `Rebuild`) with monthly bar data and Deloitte/BDO audit downloads | Bite-snack-meal: headline number → chart → full audited report | Results page: winner banner (bite) → share bars (snack) → mono audit table + total row (meal) |
| 2.4 | LUN 3D monitoring: same-angle site photos over time | Independent visual proof of progress | Candidate photos via signed URLs + `I VOTED` receipt pattern in `VoteCelebration` |
| 2.5 | `.gov.ua` ownership banner + presidential-site link | Institutional anchoring: *this belongs to someone accountable* | Institution name in `GlobalNav` + `How voting works` + locked-results explainer with countdown |
| 2.6 | Sticky glass nav, yellow pill Donate CTA, dark map with neon-green project pins | One primary action, always visible, high contrast on dark | One primary action per screen (`Vote Now` / `Submit Ballot`), solid yellow pill, sticky glass `GlobalNav` |

## 3. Civic-UX Principles (from Center for Civic Design + Vote.gov research)

These are load-bearing requirements, not decoration:

1. **Transparency builds confidence (NASS/SOE 2025):** show how ballots are cast, counted,
   and certified *in the interface itself* — locked-results explainer with unlock countdown,
   `Sealed · Counted in public tally` ledger lines, mono audit tables.
2. **Bite-snack-meal (CCD Michigan Voting Dashboard):** every data screen ships three depths —
   headline stat, expandable visual, full detail. Never a bare number, never a wall of numbers.
3. **Stepwise over forms (Vote.gov):** OTP login, nomination, and ballot flows progress one
   decision per screen with visible step state (`Step 1/2` progress bar on ballot).
4. **Status is never color alone (WCAG + Speyer UI):** every status pairs color with icon +
   uppercase text label (`● LIVE`, `◷ NOMINATIONS`, `■ CLOSED`). Color-blind safe by construction.
5. **44px minimum touch targets, mobile-first (Vote.gov: most first-time voters are on phones).**
   Every CTA/chip keeps `min-h-[44px]`. Layouts are single-column at 375px, enhanced upward.
6. **Plain language (CCD field guides):** `Vote Now`, `Ballot sealed`, `Results unlock at …` —
   no `Execute franchise transaction` jargon anywhere.

## 4. Design Tokens (single source of truth)

All tokens live in `tailwind.config.js:theme.extend`. No hardcoded hex in components —
hardcoded values are a defect (saas-dark system rule).

| Token group | Tokens | Values / notes |
|---|---|---|
| Brand | `united.yellow` `#FFD700`, `united.yellowHover` `#FFDE33`, `united.blue` `#0057B7` | Yellow = primary action + live accents; blue = secondary/info + institutional anchor |
| Surface | `united.ink` `#0A0A0B`, `united.panel` `#131316` | Charcoal over pure black: reduces eye strain in long sessions (2026 dark-mode research) |
| Status | `live` green-400, `nominations` yellow-400, `closed` zinc-400, `danger` red-400 | Each with `/10` bg tint + border + glow; always paired with icon + label per §3.4 |
| Type | `display: Oswald, Archivo Black, sans`, `sans: Inter, system-ui`, `mono: JetBrains Mono, monospace` | Display ≥24px with negative tracking; mono ONLY for numbers/hashes/tallies |
| Elevation | `shadow-neon-yellow`, `shadow-neon-blue`, `shadow-card` | Dark-mode rule: lift via lighter surface + visible border; shadows only as neon glow, never drop shadows |
| Radius | chips/CTAs `rounded-full` (9999px); cards `rounded-2xl`; inputs `rounded-xl` | Mixed radii are banned — audit flags any `rounded-lg`/`rounded` on new code |
| Motion | `ticker` (30s linear), `float-up` (celebration), `pulse-glow`, existing `select-pop`/`civic-ping` | GPU-only (transform + opacity); all covered by `prefers-reduced-motion` kill-switch |

## 5. Typography & Color Usage Rules

1. Hero H1: `display`, `text-6xl md:text-8xl`, `uppercase`, `tracking-tighter`, white with one
   `text-yellow-400` accent word + soft glow. Never more than one accent word.
2. Eyebrows: `text-xs font-bold uppercase tracking-[0.2em] text-yellow-400` for section kicks;
   `text-gray-500` eyebrows are deprecated (fail contrast on `#0A0A0B`).
3. Body: `text-zinc-300` (not `text-gray-400`) — re-verified contrast against dark surfaces.
4. Numbers/tallies/hashes: `font-mono` always; tabular numerals prevent layout shift in tickers.
5. Focus: `outline: 2px solid #FFD700; outline-offset: 3px` — white focus is invisible on
   yellow CTAs, so yellow is the only focus color.
6. Selection: `selection:bg-yellow-400 selection:text-black` — civic highlight on copy.

## 6. Global Shell (layout, nav, ticker)

1. `app/layout.tsx`: `body` becomes `bg-[#0A0A0B] text-white antialiased`. Metadata title
   shortens to civic voice; `themeColor #000000` prevents white flash on mobile.
2. Transparency ticker: thin strip directly under `GlobalNav`, `bg-yellow-400 text-black`,
   mono numbers (`12,408 votes sealed · 6 elections live`). Marquee on desktop, static wrap on
   mobile. Data from aggregate RPCs only — never raw vote rows.
3. `components/GlobalNav.tsx`: `sticky top-0 z-50 bg-black/80 backdrop-blur-md
   border-b border-white/10 h-16`. Logo `Vote` + yellow `.`. Persistent links
   (`Elections / How it works / Transparency`), institution truncated to `max-w-[30vw]` on
   mobile, role pills become `rounded-full` with bg tint. No auth-logic changes.
4. `CivicEasterEgg` stays as the share/delight slot (future: `I VOTED` badge share).

## 7. Component Specifications

| Component | Spec |
|---|---|
| Filter chips (`ElectionFilters` island) | `rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-wider min-h-[44px]`; active `bg-yellow-400 text-black border-yellow-400 font-bold`; `aria-pressed` on each |
| Status pills | §3.4 triple (dot/icon + color + label) + bg tint + subtle glow; `LIVE` reuses `.live-pulse-dot` in status color |
| Countdown chip | Self-styled `rounded-full font-mono uppercase`; urgency tiers: `>24h` zinc, `<24h` yellow, `<1h` red + pulse; `MM:SS` precision under 1h; `role=status aria-live=polite` |
| Election card | `rounded-2xl border-white/10 bg-white/[0.03] backdrop-blur p-6`; hover `border-yellow-400/50 + shadow-neon-yellow`; live cards carry 4px left accent bar; CTA hierarchy: one solid yellow primary, rest ghost |
| Ballot radio card | Keeps `.candidate-card-interactive`; selected state recolored blue→yellow glow; radio `accent-[#FFD700]`; `Selected` badge `bg-yellow-400 text-black`; `fieldset` + `legend` semantics preserved |
| Primary CTA | `rounded-full bg-yellow-400 text-black font-bold uppercase tracking-widest min-h-[44px] hover:bg-yellow-300 shadow-neon-yellow`; disabled `opacity-40` (no layout shift) |
| Results bars | Track `h-4 rounded-full bg-white/10`; winner fill gradient `yellow-400→amber-500` + glow; others `blue-500/70`; `role=progressbar` + `aria-valuenow/min/max/text` kept |
| Audit table | `font-mono`, header `bg-white/5`, zebra `odd:bg-white/[0.02]`, winner row `bg-yellow-400/10 text-yellow-300`, footer `Total · N · 100%` |
| Avatar (`PhotoThumb`) | `h-20 w-20 rounded-full border-2 border-white/15 ring-2 ring-yellow-400/20`; signed-URL logic untouched |
| Celebration (`VoteCelebration`) | Card border/glow yellow; particles restricted to `🗳️💙💛✨` with `float-up`; badge gradient yellow; ledger line `Sealed at {ts} · Counted in public tally · No identity linked` |

## 8. Page-by-Page Adaptation Map

| Page | UNITED24 pattern applied | Key changes (no data-logic changes) |
|---|---|---|
| `/` landing | Hero + stats bar + fund cards | Accent-word hero, yellow primary CTA, live proof row (aggregate RPCs), bordered `Built for both sides` cards |
| `/elections` | List-view tracker + filter toggle | `ElectionFilters` chip bar, neon status pills, prominent mono turnout pill, yellow `Vote Now` |
| `/elections/[id]/vote` | Focused checkout | `Step 1/2` progress bar, yellow countdown chip, yellow ballot selection, yellow pill submit, ballot receipt copy |
| `/elections/[id]/results` | Direction report page | Victory panel (gradient + glow), glow bars, audit ledger table + total row, share strip, locked-with-countdown error |
| `/elections/[id]/candidates` | Ambassador cards | Circular avatars with verified ring, rounded status pills, sticky search bar, remapped footer CTAs |
| `/elections/[id]/nominate` | Fundraiser application | Stepwise form with step indicator, yellow primary submit, photo guidelines inline |
| `/login`, `/signup` | Minimal civic entry (Vote.gov) | Step indicator (`1 Email → 2 Code → 3 Done`), mono OTP input, institution context line |
| Admin portals (3) | Back-office tables | Card/chip language only; CSV error table keeps row-level detail; platform metrics as UNITED24 stat panels |

## 9. Data Visualization Rules

(From Atlassian chart-color + CCD dashboard guidance.)

1. One hue per meaning: winner yellow, others blue; status greens/reds never reused for vote share.
2. Never color alone: bars carry `%` labels; tables carry absolute counts; status carries icons.
3. Chart contrast meets WCAG AA 3:1 on dark surfaces; gridlines `border-white/10`, labels `text-zinc-300`.
4. Totals always shown: every chart/table ends with a `Total` row — dangling shares are a defect.
5. No chart library: hand-built div bars + tables only (zero-dependency constraint).

## 10. Accessibility Contract (WCAG 2.1 AA, non-negotiable)

1. Contrast re-verified in dark mode: body `zinc-300` on `#0A0A0B`, secondary never `gray-500`-on-dark.
2. Keyboard: full ballot/OTP/filter flows operable; visible yellow focus everywhere; no `outline: none` without replacement.
3. Screen readers: `fieldset/legend` on ballot, `progressbar` semantics on results, `status` live region on countdown, `aria-pressed` on chips.
4. Reduced motion: ticker, glow, float-up, bounce all disabled under `prefers-reduced-motion`.
5. Touch: `min-h-[44px]` on all interactive elements; 375px single-column baseline.

## 11. Performance Budget (Core Web Vitals)

1. LCP < 2.5s, CLS < 0.1, no layout shift from chips/ticker (reserved heights, tabular numerals).
2. No web-font blocking: `next/font` with `display: swap`; system-stack fallback.
3. Animations GPU-only; marquee is transform-based; images via `next/image` with fixed sizes.
4. Zero new dependencies — bundle size must not regress vs. pre-redesign baseline.

## 12. Rollout & Verification

**Order:** tokens → globals → layout/nav → landing → elections list → ballot → results/celebration → candidates → nominate → auth → admin → verify.

**Per-step gate:** `npm.cmd run build` + `lint` clean; visual check at 375px + 1440px; keyboard-only pass of touched flow.

**Final gate (AGENTS.md §5):** double-vote rejection, closed-election rejection, tally-math
accuracy, cross-tenant leak tests all green; `npm.cmd run test` passes; no secrets in diff;
commit as `feat(ui): united24 civic-trust redesign` after user review.
