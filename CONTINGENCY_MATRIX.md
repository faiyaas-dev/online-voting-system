# CONTINGENCY_MATRIX.md — Platform Reality Check & Fallback Ladder

Companion to `AGENTS.md` and `SDLC_IDE_PLAYBOOK.md`. Read this before Phase 0.

**Hard constraints confirmed:** the whole build must land in **one day** — no waiting for a weekly quota reset. **Zero spend** — no API credits, no paid tier, nothing that touches a card, even a "free" $5 credit route is off the table. **GUI-only** — no CLI tools (Gemini CLI, Claude Code, etc.); everything runs through Antigravity, Trae, or a browser tab. Your confirmed platform access: Antigravity (free/preview personal Google account), Trae (free tier), DeepSeek and Gemini as browser fallbacks (no Kimi). Nothing is set up yet for Phase 0 — Supabase project, CSV sample, and deploy target all get built from scratch today.

Everything below is written against those four constraints, not the general case.

---

## 0. One-Day Sprint Mode — read this first, before opening any tool

### 0a. Check your real refresh window before you plan anything
Reports on Antigravity's free-tier refresh cycle **conflict directly** across current sources: some say free-tier agent quota refreshes every ~5 hours with a larger weekly ceiling as backstop; others say free tier is weekly-only with a small daily request cap; Google itself has changed this mechanic multiple times in 2026 and the in-product copy has lagged the actual behavior more than once. **Don't plan your day around any number in this document or anywhere else.** Open Antigravity → Settings → Models right now and read the actual countdown next to each model. That number — not any external report — is what your day's sequencing is built around. Screenshot it; you'll want to compare it after Phase 2.

### 0b. Sequencing for a one-day, zero-spend, GUI-only build
1. **Do Phase 2 (schema/RLS) as early as possible**, ideally your very first working block, while Antigravity's quota is fully fresh. This is the phase gated on Opus 4.6 and the one true single point of failure — give it first crack at the day's quota, not last.
2. Route every routine phase (0, 1, 3, 5, 7, 8) to **Sonnet 4.6 or Gemini 3.8 Flash** inside Antigravity — never Opus — to conserve the scarce-model slice of the shared pool for Phase 2 and Phase 6 specifically.
3. If Phase 2 burns through Opus 4.6's slice: switch to **Gemini 3.1 Pro (High)** in the same Antigravity session before considering anything external — same repo context, same review workflow, still a frontier reasoning model. This should cover the vast majority of cases.
4. If the *entire* Antigravity pool reads zero after that: check the countdown from §0a. If it's a genuinely short window (hours, not days), do Phase 3/4 frontend work in Trae while it refills, then come back. If it's showing a multi-day lockout, you no longer have the option to wait — see §2's emergency protocol below. This is a real trade-off, not a solved problem; be honest with yourself about the added risk before proceeding.
5. Do Phase 6 (security review) as soon as Phase 3–5 are done, not saved for the end of the day when quota is most depleted — the same Opus-scarcity logic applies twice in one pipeline.
6. **Cut scope proactively, don't wait for a session to "run long."** `AGENTS.md`'s MoSCoW table already has a cut order (Could → Should, keeping the 3 unit tests → Dept Admin deferred). For a one-day build, decide *now*, before Phase 1, whether you're actually attempting the Could tier today or explicitly deferring it — don't discover the time crunch during Phase 4.

### 0c. Phase 0 now includes groundwork that the original playbook assumed was done
Since nothing is set up yet: Phase 0's Antigravity session should also (a) walk you through creating a free Supabase project via the Supabase dashboard (no card required for the free tier — confirm this yourself at signup, don't take it on faith), (b) generate a synthetic CSV roster sample matching the schema in `AGENTS.md` (fake names/emails/departments) since no real institution data exists yet, and (c) confirm Vercel (or your actual target) as the deploy destination before Phase 7 rather than assuming it. Add these three as explicit Phase 0 sub-tasks, not afterthoughts.

---

## 1. Antigravity vs Trae — Sept 2026 reality check

| | Antigravity | Trae |
|---|---|---|
| **Status** | Generally Available at $0 for individuals. No sign-up gate. | Free tier exists inside a restructured 5-tier system (Free / Lite $3 / Pro $10 / Pro+ $30 / Ultra $100) — you're on Free. |
| **Free-tier refresh mechanic** | **Conflicting reports** — some sources describe a 5-hour rolling refresh with a larger weekly backstop for free users; others describe a small daily cap with a weekly ceiling; Google has changed this mechanic more than once in 2026 and in-app copy has lagged reality before. Treat every number here as unverified until you check Settings → Models yourself (§0a). | 5,000 autocompletions/month, 2 concurrent cloud tasks, "limited SOLO mode" with no confirmed current run count. |
| **Model roster confirmed** | Gemini 3.8 Flash (current default), Gemini 3.1 Pro, **Claude Opus 4.6, Claude Sonnet 4.6**, GPT-OSS 120B — billed through Google, no Anthropic account needed. | Reportedly still surfaces Claude 4-class and DeepSeek R1 models on free tier, but "limited early access" language everywhere — don't assume Sonnet-class access without checking the model picker first. |
| **What this means for a zero-spend, one-day build** | This is your only tool with genuine Opus-class reasoning at $0. Protect its quota deliberately (§0b) rather than spending it evenly across all 9 phases. | Treat SOLO as a one-shot resource, same as the original playbook — one well-specified scaffold run, then Builder mode for the rest. |

---

## 2. Fallback ladder — GUI-only, zero-spend

No CLI tools and no paid credits are in scope for this build. The ladder below only uses things reachable by clicking, in order of how much repo/file context they preserve:

### Tier 1 — Antigravity, model-switch within the same tool
Opus 4.6 slice gone but the pool isn't fully dead → switch to Gemini 3.1 Pro (High) or Gemini 3.8 Flash in the same window. Full repo context and review workflow preserved. Try this before leaving the tool, every time.

### Tier 2 — Trae, mode-switch within the same tool
SOLO runs exhausted → drop to Builder/Chat mode for the rest of Phase 4. Same logic as Tier 1.

### Tier 3 — Gemini Code Assist (free extension, installed by clicking "Install" in the Extensions panel — no terminal)
If you want a stronger external option than plain browser chat once both tools above are genuinely dead: this is a real coding assistant with repo-aware context, installed the same way you'd install any editor extension. Reported free-tier numbers (context window, daily completions) vary by source — verify inside the extension itself rather than trusting a figure here. Good for routine, non-RLS work only.

### Tier 4 — DeepSeek (chat.deepseek.com, browser, free, no login limits reported)
Plain web chat, no repo access, no test execution, but a genuinely large context window lets you paste more of a file at once than older-generation fallback chats could handle. You are the test runner here — full stop.

### Tier 5 — Gemini app / Canvas (browser, free)
Same limitations as DeepSeek, with the addition of a live code-execution pane (Canvas) if you specifically need to run a snippet to check it. Free-tier context figures conflict across sources — don't rely on a specific number.

### The rule that survives every tier — with an honest, explicit exception for today's deadline
RLS policies and the `votes`/`elections` status-gating logic normally get Antigravity/Trae-grade review or they don't ship. **Because today's deadline removes "wait for reset" as an option**, here is the actual decision tree if the entire Antigravity pool is dead mid-Phase-2 or mid-Phase-6:

1. First choice, always: Tier 1 (model-switch inside Antigravity). This should resolve the overwhelming majority of cases — don't skip to emergency measures because Opus specifically is gone.
2. If literally the whole tool is dead and the countdown (§0a) shows a lockout longer than you have left today: you may draft the RLS/security work in Tier 4 (DeepSeek) **only** under the compensating protocol below. This is a real increase in risk, not a workaround that removes it — go in with eyes open.

**Emergency RLS/security compensating protocol (use only if the above forces your hand):**
- Paste the exact locked schema/RLS sections from `AGENTS.md` verbatim as context — never let the fallback "improve" or reinterpret them.
- For every policy it drafts, require it to state the specific cross-tenant leak scenario it's meant to prevent, in the same format Phase 2 already uses.
- Do not commit anything from this session until you've run the full Phase 5 leak-test suite and the Phase 6 audit checklist against it yourself, immediately — not "later today," immediately, before touching anything else.
- Treat this output as a first draft requiring the same line-by-line read the playbook already asks for at every phase gate, with your own attention doing the work a repo-aware tool would normally help with.

### Continuity template (Tier 3–5 sessions)

```text
Context (from AGENTS.md): [paste only the relevant section — e.g. the
one schema table, or the "Code conventions" section]

Current file (path/to/file.ext):
[paste current content]

Task: [one file, one concern, narrow scope]

Constraints: minimal/functional styling only, no new dependencies,
match the existing code style shown above, do not touch RLS or
vote/election status logic unless this is the explicit emergency
protocol above. Output the full updated file, nothing else.
```

---

## 3. Per-phase contingency notes (one-day, zero-spend, GUI-only)

| Phase | Primary | If primary's quota is gone | If Antigravity is fully dead |
|---|---|---|---|
| 0 — Env/repo + groundwork (Supabase project, synthetic CSV, deploy target) | Antigravity, Sonnet 4.6 | Any Antigravity model | Do it by hand in the Supabase/Vercel dashboards directly — no AI needed for setup clicking |
| 1 — Requirements lock | Antigravity, Gemini 3.1 Pro High | Antigravity Sonnet 4.6 | Draft as prose in Tier 4/5, formalize into OpenSpec once Antigravity is back |
| 2 — Schema/RLS design | Antigravity, Opus 4.6, done **early in the day** | Antigravity Gemini 3.1 Pro High (same tool) | Emergency protocol above — accept the elevated risk, run leak tests immediately |
| 3 — Backend implementation | Antigravity, Sonnet 4.6 | Antigravity Gemini 3.8 Flash | Tier 3 for non-RLS files; migration/RLS files wait for Antigravity or use the emergency protocol |
| 4 — Frontend implementation | Trae SOLO → Builder | Trae Builder/Chat only | Tier 3 for per-screen iteration, one screen at a time |
| 5 — Testing/QA | Antigravity, Sonnet 4.6, browser verification | Antigravity Gemini 3.8 Flash | Run the 3 unit tests and leak tests locally yourself — no AI required to execute `npm run test` |
| 6 — Security review, done **before end-of-day quota depletion** | Antigravity, Opus 4.6 | Antigravity Gemini 3.1 Pro High | Emergency protocol above — this audit is what catches Phase 2's emergency-protocol risk if that path was taken |
| 7 — DevOps/deployment | Antigravity, Gemini Flash | Any Antigravity model | Tier 3/4/5 for isolated CI config snippets only |
| 8 — Docs/handoff | Antigravity, any model | Any Antigravity model | Tier 4/5 — lowest-risk category, fine to fully offload |

---

## 4. Discrete clarity checkpoints

### 4a. Before starting (today, right now)
1. Did you check Antigravity's actual quota countdown (§0a) before deciding today's phase order?
2. Are you doing Phase 2 first, or is something forcing you to delay it? If delayed, that's the day's biggest risk — name it now.
3. Which Could-tier items (Platform Admin dashboard, CSV row-level errors, candidate photos) are you actually attempting today vs. explicitly deferring? Decide before Phase 1, not during Phase 4.
4. Supabase project, synthetic CSV, and deploy target: created in Phase 0, or do you already have something you didn't mention?

### 4b. Mid-work — at every phase gate, before typing "continue"
1. Did I actually read the diff, or skim it? (Phases 2, 3, 6 especially.)
2. Does the exit criteria hold in my own words, not just "the agent said it passed"?
3. Did any phase fall back to Tier 3/4/5? If so, did the RLS/vote-gating exception get handled through the emergency protocol specifically, not casually?
4. Am I burning Opus/Gemini-3.1-Pro-High quota on something routine that Sonnet/Flash could have done?
5. Given the one-day clock: am I still on pace, or is it time to invoke the Could → Should cut *now* rather than at Phase 7?

### 4c. At delivery (Phase 8, before calling it done)
1. Does every Must + Should + (attempted Could) item have a passing test or screenshot artifact?
2. Are all Phase 6 Critical/High findings resolved? If Phase 2 or Phase 6 used the emergency protocol, were the compensating leak tests actually run, and did they pass?
3. Confirmed no secret in git history — did you grep for it yourself?
4. Could a stranger follow the README with zero tribal knowledge?
5. Is `AGENTS.md`'s Changelog updated with what shipped, what's deferred (Won't tier + anything cut for time), and whether any phase used the emergency degraded-review path — future-you needs to know that even if today's-you doesn't re-audit it.

---

## 5. What this file does not fix
It can't verify Trae's exact free-tier SOLO run count, guarantee Antigravity's refresh mechanic hasn't changed again by the time you read this, or substitute for actually reading the diff. The emergency protocol in §2 reduces risk, it does not eliminate it — that trade-off is inherent to a same-day, zero-spend, no-CLI deadline on multi-tenant RLS work, not a flaw in this document.
