# Persona Walkthrough — Strict Audit (All Archetypes)

**Method disclaimer:** This is a qualitative simulation grounded in LIFT, Cialdini (7), Fogg (B=M×A×P), and attachment theory. It is NOT statistical evidence. Every claim below was checked against the current codebase on 2026-09-17. File:line citations are load-bearing. Where the prior version of this file claimed a fix, I re-verified — several of those claims were **false** and are corrected in §8.

**Scope audited:**
`app/page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/elections/page.tsx`, `app/elections/[id]/vote/page.tsx`, `app/elections/[id]/nominate/page.tsx`, `app/elections/[id]/candidates/page.tsx`, `app/elections/[id]/results/page.tsx`, `app/institution-admin/page.tsx`, `app/department-admin/page.tsx`, `app/platform-admin/page.tsx`, `app/institution-admin/elections/[id]/report/page.tsx`, `components/GlobalNav.tsx`, `components/LiveCountdown.tsx`, `components/admin/RosterUploadForm.tsx`, `components/admin/CreateElectionForm.tsx`, `components/admin/ElectionTable.tsx`, `components/admin/CandidateApprovalTable.tsx`, `components/admin/InviteDeptAdminForm.tsx`.

**Archetypes covered (6 — the complete set for this project):**
A0. Unauthenticated Visitor · A1. First-time Voter · A2. Candidate / Self-nominee · A3. Institution Admin · A4. Department Admin · A5. Platform Admin.

---

## A0. Unauthenticated Visitor (cold arrival)

```
PERSONA PROFILE
===============
Name:           Arjun
Age & gender:   19M
Nationality:    Indian
Current situation: Heard "college has an online voting portal" from a friend. No link, no context. Googles on phone between classes.

SEARCH CONTEXT
==============
Google query:      "online voting system college election"
Arrival source:    Google organic (cold)
Sites seen before: None for this product; mental model = Google Forms + college ERP
Device:            Mobile iPhone 14, 390x844

PSYCHOLOGY
==========
Familiarity level:     Low
Urgency:               Browsing
Primary fears:         Phishing site; signing up on wrong site; spam OTP
Trust triggers:        College name/logo, .edu domain cues, explains "how it works"
Decision style:        Quick decider, scans only
Attachment tendency:   Anxious (needs reassurance at every step)

GOAL
====
What success looks like: Understand in 5 seconds what this is, who it is for, and what to do next.
Contact threshold:       Clicks Sign In / Register only if relevance is obvious.
```

### A0 Phase 0 — Pre-Arrival
Arjun expects a generic voting tool. He is worried this is a phishing clone because there is no college branding in the URL he was given. He wants one sentence telling him "your college runs elections here" and two buttons max.

**Relevance contract:** Above the fold must answer: What is this? Is it for my college? Do I sign in or does my college register first?

### A0 Phase 1 — Five-Second Test (`app/page.tsx:26-67`)
**Arjun (raw monologue):**
> "Okay… big word 'VOTE.' Black screen. 'Secure, transparent, and purposeful elections for your institution.' Hmm, so this is for institutions, not for me? Two buttons: Sign In and Register Institution. I'm a student, so… Sign In, I guess? But where's my college name? Is this the right place or some demo? Scrolling a bit… 'Platform Features' — CSV roster, scoped elections, OTP. That sounds like it's talking to my principal, not to me. I still don't know how I get to vote."

**ANALYST — Fold 1 (hero + CTAs)**
- Emotional state: confused
- Trust delta: ↓ — no institution identity, no "how voting works for students" cue
- LIFT assessment: Clarity ↓ (dual-audience hero serves neither cleanly); Relevance ↓ for student cold arrivals
- Cialdini active: none
- Cialdini missing: Authority (no logos, no .edu proof, no "used by X colleges"), Social Proof (no counts), Liking/Unity (no student voice)
- Fogg position: Motivation: Med | Ability: High (two big buttons) | Prompt visible: Yes
- CTA reachable: Yes (both buttons visible without scroll)
- Technical notes: `app/page.tsx:30-31` — 6xl/8xl uppercase hero is dramatic but information-poor. `app/page.tsx:47-65` features section speaks admin language ("student database", "verified emails") on the same screen a lost student sees.

**ANALYST — Fold 2 (Platform Features)**
- Emotional state: bored
- Trust delta: → (features are credible but mis-targeted for this persona)
- LIFT assessment: Distraction ↑ for voters; Value Prop ↑ only for admins
- Cialdini active: Authority (weak — claims without proof)
- Cialdini missing: Social Proof, Unity
- Fogg position: Motivation: Low | Ability: High | Prompt visible: No (no CTA after features)
- CTA reachable: No — after scrolling past hero, neither Sign In nor Register is reachable without scrolling back up. No sticky CTA.

### A0 Verdict
```
VERDICT
=======
Confidence score:     4/10 — looks clean but could be anyone's demo; zero proof it is MY college's official portal.
Clarity score:        5/10 — I get "elections" but not "how do I vote / where is my ballot".
Relevance score:      4/10 — page talks to institutions; I searched as a student.
Would I contact them: Maybe — I would tap Sign In only because there is nothing else to do.

Top 3 strengths:
1. Two huge unambiguous buttons (Fogg:Ability — no hunting for CTA).
2. Minimalist dark hero loads fast and reads well on mobile.
3. Feature copy names real mechanisms (CSV roster, OTP) — Authority seed for admins.

Top 3 weaknesses:
1. No institution context for cold arrivals (LIFT:Relevance — "Is it for me?" fails).
2. No how-it-works for students; features are admin-facing (LIFT:Clarity).
3. No sticky CTA after scroll (Fogg:Prompt missing past fold 1).

The moment I almost left: End of hero — "Register Institution" made me think I was in the wrong place.
The moment I was most engaged: Seeing "OTP Authentication / No passwords" — one fear (passwords) removed.
```

---

## A1. First-Time Voter (the life-or-death flow)

```
PERSONA PROFILE
===============
Name:           Faiyaas
Age & gender:   20M
Nationality:    Indian
Current situation: Between lectures. Email says voting closes in 36h. Has 8 minutes. Opens login link on phone. First time on platform.

SEARCH CONTEXT
==============
Google query:      (direct link, not search) "vote today student council election"
Arrival source:    Email referral link, ideally with ?institution=<uuid>
Sites seen before: Google Forms, Moodle
Device:            Mobile iPhone 14, 390x844

PSYCHOLOGY
==========
Familiarity level:     Low
Urgency:               Urgent (Days → hours)
Primary fears:         Vote not counting; double-vote accusation; tapping wrong candidate; lockout by weird ID field; OTP never arriving
Trust triggers:        College name in nav, VOTER role label, green VOTING OPEN badge, explicit receipt
Decision style:        Quick decider
Attachment tendency:   Anxious (needs confirmation after EVERY tap)

GOAL
====
What success looks like: OTP → ballot → Cast Vote → "Vote cast successfully" in <2 min.
Contact threshold:       Abandons if asked for a UUID, or if ballot/error language is ambiguous.
```

### A1 Phase 0 — Pre-Arrival
Faiyaas expects a Google-Form-simple vote. He dreads passwords, roll-number lookups, and cryptic errors. His roommate warned him about "some 36-character institution ID box."

**Relevance contract:** Login must accept email+OTP only (institution resolved from link/roster, never typed). Elections list must show ONLY his ballot with an unmissable Vote Now. Ballot must confirm selection visually and receipt explicitly.

### A1 Phase 1 — Five-Second Test (`app/login/page.tsx:67-139`)
**Faiyaas (raw monologue):**
> "Black box, 'SIGN IN'. Just email. Okay, typing my gmail, hitting Send OTP. …Code came. Pasting it. Uh oh — there's a new box: 'Institution ID (first login)' and it says 'uuid of your institution'. WHAT? Where do I get that? My roommate was right. Is it in the email? Let me check… no. I'm stuck. Do I give up and go to class?"

**ANALYST — Login Fold 1 (email)**
- Emotional state: curious
- Trust delta: ↑ (single-field start, clean contrast, `app/login/page.tsx:73-93`)
- LIFT assessment: Clarity ↑; Anxiety ↓ (so far)
- Cialdini active: Commitment (tiny first yes)
- Cialdini missing: Authority (no college seal/name on login card itself)
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes (Send OTP)
- CTA reachable: Yes

**ANALYST — Login Fold 2 (OTP + Institution ID) — CRITICAL**
- Emotional state: anxious
- Trust delta: ↓↓ — the exact abandonment trigger this persona fears
- LIFT assessment: Anxiety ↑↑↑; Ability ↓↓ (task becomes impossible without out-of-band UUID)
- Cialdini active: none
- Cialdini missing: Facilitation (system should resolve institution, not interrogate)
- Fogg position: Motivation: High | Ability: Low | Prompt visible: Yes but BLOCKED (Verify requires UUID)
- CTA reachable: Yes, but unusable without secret knowledge
- Technical notes: `app/login/page.tsx:11,16,110-124` — `institutionId` pre-fills ONLY if `?institution=` or `?institutionId=` is present. Otherwise the UUID textbox renders. Error path `app/login/page.tsx:53-57` says "Enter your institution ID" — a 36-char hex string no student has. `claim_voter_profile` RPC itself is correct; the UX around it is the failure. **The prior version of this file claimed "There's NO institution box! FIXED" — that is FALSE against current code. Strict correction: the box is still there and still P0.**

### A1 Phase 2 — Elections list (`app/elections/page.tsx:36-95`, `components/GlobalNav.tsx:18-41`)
Applies ONLY if voter survives login (deep link with `?institution=` or returning user with profile).

**Faiyaas (raw monologue):**
> "Okay say I got in. Top bar says 'Vote.' plus my college name in small letters, and my email with 'VOTER' under it. Good — I know it's me. 'ELECTIONS' header. One card: 'Computer Science Rep 2026', green 'VOTING OPEN', 'Dept: CSE · Year 3', dates, and — nice — 'Closes in 4h 22m' ticking. Links at the bottom are small text links though: 'View Candidates', 'Vote Now' in green. I almost missed Vote Now because it's tiny. Tapping it anyway."

**ANALYST — Elections list fold**
- Emotional state: reassured → slightly strained (small links)
- Trust delta: ↑ (`GlobalNav.tsx:23-27` institution name + `33-35` role line deliver Unity + Authority; RLS scoping delivers Relevance)
- LIFT assessment: Relevance ↑↑ (RLS filters to eligible only); Clarity ↓ slightly (action links are 11px underline links, `app/elections/page.tsx:68-87`)
- Cialdini active: Unity (dept/year scope line), Scarcity/Urgency (`LiveCountdown.tsx:13-16` "Closes in Xd Xh Xm")
- Cialdini missing: Social Proof (no turnout cue like "312 voted")
- Fogg position: Motivation: High | Ability: Med (links small on 390px thumb zone) | Prompt visible: Yes
- CTA reachable: Yes
- Technical notes: Countdown exists and is accessible (`role=status aria-live=polite`, `LiveCountdown.tsx:29-31`) but updates only every 30s (`LiveCountdown.tsx:24`) — fine. Action links at `text-[11px]` are below comfortable mobile touch targets; no button hit-area expansion.

### A1 Phase 3 — Ballot (`app/elections/[id]/vote/page.tsx:98-138`)
**Faiyaas (raw monologue):**
> "Voting booth. 'Vote: CS Rep'. Countdown again at top — good, still open. Radio cards: name, roll, dept, two lines of manifesto. Tapping Priya's card — whole border goes white, background dark. Yeah, that's selected, no doubt. Big white 'CAST VOTE' button. Tapping… '✓ Vote cast successfully. Thank you!' plus back link. Going back to Elections and trying Vote again — 'You have already cast your vote.' Perfect, I can't double-vote by accident. Done, running to class."

**ANALYST — Ballot fold**
- Emotional state: confident
- Trust delta: ↑↑ (selected-state `border-white bg-gray-900` at line 110 is unmistakable; `23505` double-vote guard at lines 67-68 surfaces as plain language)
- LIFT assessment: Clarity ↑↑; Anxiety ↓↓
- Cialdini active: Commitment (radio select before submit), Authority (DB-enforced finality)
- Cialdini missing: none critical here
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes (CAST VOTE full-width)
- CTA reachable: Yes
- Technical notes: Real defects, all verifiable: (a) `line-clamp-2` at line 122 truncates manifestos on the DECISION screen — voter judges on clipped text; (b) page shell lacks the dark `bg-black text-white` wrapper used elsewhere (`vote/page.tsx:99` is bare `max-w-lg` — loading state at line 75 and closed-state at 77-82 are unstyled/default-theme, inconsistent with elections dark theme); (c) `LiveCountdown` re-rendered here is good, but no "X candidates" header or spoiled-ballot warning; (d) already-voted and success states (lines 84-96) use default blue links on assumed-light background — contrast breaks if rendered inside dark layout.

### A1 Verdict
```
VERDICT
=======
Confidence score:     6/10 — ballot itself is trustworthy; login UUID gate destroys confidence before I ever see it.
Clarity score:        7/10 — inside the flow everything is labeled; getting INTO the flow is cryptic.
Relevance score:      9/10 — once in, I see only my ballot (RLS does its job).
Would I contact them: Depends — YES with ?institution= deep link; NO without it (I abandon at the UUID box).

Top 3 strengths:
1. DB-enforced single vote + plain-language double-vote message (LIFT:Anxiety↓; vote/page.tsx:67).
2. Unmistakable radio selected-state + full-width CAST VOTE (Fogg:Ability).
3. Countdown + VOTER role + institution in nav (Cialdini:Authority/Unity; Fogg:Spark).

Top 3 weaknesses:
1. UUID textbox on first login without deep link — P0 abandonment wall (LIFT:Anxiety↑↑↑; login/page.tsx:110-124).
2. 11px underline action links instead of buttons on mobile ballot list (Fogg:Ability↓; elections/page.tsx:68-87).
3. Manifesto clipped to 2 lines on the ballot (LIFT:Clarity↓; vote/page.tsx:122).

The moment I almost left: The "Institution ID — uuid of your institution" field (login fold 2).
The moment I was most engaged: Tapping the candidate card and seeing the white-border selected state + green success receipt.
```

---

## A2. Candidate / Self-nominee

```
PERSONA PROFILE
===============
Name:           Priya
Age & gender:   21F
Nationality:    Indian
Current situation: 3rd-year CSE, running for Dept VP. Nomination deadline tonight 23:59. Laptop ready, manifesto in Google Docs, headshot JPG 800x800.

SEARCH CONTEXT
==============
Google query:      "college election self nominate candidate portal"
Arrival source:    Student Affairs portal deep link
Sites seen before: LinkedIn, Instagram campaign pages
Device:            MacBook Air 1440x900

PSYCHOLOGY
==========
Familiarity level:     Medium
Urgency:               Urgent (deadline tonight)
Primary fears:         Photo silently rejected; manifesto truncated; submitting then invisible (not knowing pending vs lost); nominating in wrong election
Trust triggers:        Stated file rules, live preview, character feedback, instant pending receipt + visible own card
Decision style:        Methodical researcher
Attachment tendency:   Secure (wants transparency, not hand-holding)

GOAL
====
What success looks like: Submit manifesto + photo once, see "pending admin approval" + own card with yellow pending pill.
Contact threshold:       Emails HOD if status ambiguous >30 min.
```

### A2 Phase 0 — Pre-Arrival
Priya has rehearsed her manifesto. She expects a form that states image rules up front, shows her what voters will see, and never silently drops her submission.

**Relevance contract:** Nomination entry must be discoverable from elections list; form must state constraints BEFORE upload; post-submit must prove pending state.

### A2 Phase 1 — Discovery (`app/elections/page.tsx:72-76`, `app/elections/[id]/candidates/page.tsx:60-65`)
**Priya (raw monologue):**
> "Elections list — my election has a yellow 'NOMINATION OPEN' badge, and a yellow 'Self-Nominate' link next to View Candidates. Small text but I see it. Clicking through to Candidates first to scout: I see approved people with photos, names, manifestos. There's also a 'Self-nominate' link at the bottom when nominations are open. Two paths to the same form — fine."

**ANALYST — Discovery fold**
- Emotional state: focused
- Trust delta: ↑ (status badge color language: yellow=nominate vs green=vote, `elections/page.tsx:7-15`)
- LIFT assessment: Relevance ↑; Urgency ↑ (open badge implies closing window, but no deadline date in badge — must read small date line)
- Cialdini active: Scarcity (weak — no "closes in" on nomination cards, only voting cards get `LiveCountdown`)
- Cialdini missing: Scarcity (nomination countdown absent)
- Fogg position: Motivation: High | Ability: Med (11px links again) | Prompt visible: Yes
- CTA reachable: Yes

### A2 Phase 2 — Form (`app/elections/[id]/nominate/page.tsx:134-173`)
**Priya (raw monologue):**
> "Form: 'Self-Nominate: CS Rep'. Manifesto box is decent size with placeholder 'Tell voters why you're running…'. Photo label says optional, JPEG/PNG/WebP, max 2MB — clear. I pick my JPG, and a Preview box appears with my actual photo, 128px thumbnail. Nice, it's really me. Yellow SUBMIT NOMINATION button. Clicking… 'Nomination submitted! It is pending admin approval.' with a link to View candidates."

**ANALYST — Form fold**
- Emotional state: reassured
- Trust delta: ↑↑ (constraints stated pre-upload at line 152; client validation at lines 61-71 with specific messages; live preview at lines 155-160)
- LIFT assessment: Clarity ↑↑; Anxiety ↓↓
- Cialdini active: Commitment (deliberate submit), Authority (server RLS + storage path scoping)
- Cialdini missing: Reciprocity (no "what happens next / approval SLA" text)
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes
- CTA reachable: Yes
- Technical notes: **Correction — prior report recommended adding live preview; preview ALREADY EXISTS** (`nominate/page.tsx:18,74,155-160`, `URL.createObjectURL`, alt "Selected candidate headshot preview"). Remaining gaps, all verified: (a) no character count / truncation warning — manifesto stored unbounded in UI, displayed with `line-clamp-2/3` elsewhere, so Priya cannot know what voters actually see; (b) no dimensions/aspect guidance (only type+size), yet display is `h-32 w-32 object-cover` square crop — a portrait photo gets center-cropped silently; (c) `alreadyNominated` gate (lines 40-47, 120-125) uses `.single()` — if query errors, state stays false and user can double-submit into a UNIQUE violation with a raw DB error message; (d) closed-nomination guard (lines 113-118) is correct but styled inconsistently with voter flow.

### A2 Phase 3 — Proof (`app/elections/[id]/candidates/page.tsx:29-79`)
**Priya (raw monologue):**
> "Candidates page — there's my card with my photo, name, roll, manifesto, and a little yellow 'pending' pill. Other cards don't have the pill, so mine is marked differently. I get it: others can't see me yet, but I can see myself. I'm not emailing anyone tonight."

**ANALYST — Proof fold**
- Emotional state: proud / relieved
- Trust delta: ↑↑ (RLS self-view of pending at lines 22-27 + pending pill at lines 50-54 closes the loop)
- LIFT assessment: Anxiety → ~0 for this persona
- Cialdini active: Commitment & Consistency (public pending stamp)
- Fogg position: Behavior complete
- Technical notes: Page uses light cards (`bg-white`, line 40) + default blue links (lines 31, 62-74) while nominate/vote/elections pages are dark — Priya traverses three visual themes in one journey. No photo for pending-unsupported state messaging. Empty state "No approved candidates yet." (line 36) is ambiguous to a candidate — does it mean zero including mine?

### A2 Verdict
```
VERDICT
=======
Confidence score:     8/10
Clarity score:        8/10
Relevance score:      10/10
Would I contact them: YES — submits tonight without help.

Top 3 strengths:
1. Constraints up front + specific client validation + live preview (Fogg:Ability↑; nominate/page.tsx:61-71,152-160).
2. Pending receipt + self-visible pending pill (LIFT:Anxiety↓↓; candidates/page.tsx:50-54).
3. Duplicate-nomination guard messaging (nominate/page.tsx:120-125).

Top 3 weaknesses:
1. No manifesto length/cropping contract — voters see line-clamp-2, candidate writes blind (LIFT:Clarity↓).
2. No aspect-ratio guidance though display is square-cropped (distraction/quality risk).
3. Light-cards page inside a dark-theme journey (Cialdini:Authority↓ via inconsistency).

The moment I almost left: None — closest was wondering "will my portrait get cropped weird?"
The moment I was most engaged: Seeing my own preview, then my pending pill.
```

---

## A3. Institution Admin (Dean / IT Director)

```
PERSONA PROFILE
===============
Name:           Dr. Ramanathan
Age & gender:   48M
Nationality:    Indian
Current situation: Owns 3,500-student council election starting Monday. CSV exported. 48h to configure roster, invite dept admins, open nominations.

SEARCH CONTEXT
==============
Google query:      "self serve college voting platform csv student roster"
Arrival source:    Evaluation → /signup
Sites seen before: ElectionRunner, Helios, Qualtrics
Device:            Dell Precision 1920x1080

PSYCHOLOGY
==========
Familiarity level:     High (DB-literate, expects RLS, validation, audit)
Urgency:               High (Days)
Primary fears:         3,000-row import dying silently; duplicates; wrong-dept voting; no audit paper trail; slug collision on signup
Trust triggers:        Row-level errors with download; grouped error labels; lifecycle buttons; audit certificate with hash
Decision style:        Analytical (reads errors before trusting)
Attachment tendency:   Avoidant (ignores marketing; demands data)

GOAL
====
What success looks like: Institution created atomically → 3,500 rows ingested with bad rows isolated + downloadable → election lifecycle driven → candidates vetted → audit certificate printable.
Contact threshold:       Rejects product if import fails opaquely or duplicates slip in.
```

### A3 Phase 0 — Pre-Arrival
Skeptical of slick SaaS that chokes on dirty CSVs (missing emails, bad years, dup roll_nos). Will intentionally test with bad rows.

**Relevance contract:** Landing must promise roster-gating; signup must be atomic; roster tool must isolate (not abort on) bad rows and prove it.

### A3 Phase 1 — Landing → Signup (`app/page.tsx`, `app/signup/page.tsx:59-139`)
**Ramanathan (raw monologue):**
> "Homepage: 'VOTE.' plus three features — CSV roster, scoped elections, OTP. Copy says 'restricts voting to verified emails, entirely eliminating unauthorized ballots.' Strong claim; I'll hold them to it. Register: Institution Name, Slug auto-generating as I type, Admin Email. Sensible. Send OTP → code → 'Verify & Create Institution' → lands in /institution-admin. One trip, no password. Good. But what if my slug is taken? No hint whether it checks live. I'll find out the hard way."

**ANALYST — Signup folds**
- Emotional state: receptive → cautiously satisfied
- Trust delta: ↑ (auto-slug `toSlug` at `signup/page.tsx:22-24,72`; atomic `create_institution_and_admin` RPC at lines 49-52 — role hardcoded server-side, no client role field)
- LIFT assessment: Value Prop ↑ (feature copy maps 1:1 to his fears); Friction ↓
- Cialdini active: Authority (specific mechanism claims)
- Cialdini missing: Social Proof (no customer count), Risk-reversal (no "what if slug taken" inline validation)
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes
- CTA reachable: Yes
- Technical notes: RPC signature verified — migration `20260912000001_security_fixes.sql:21-23` defines `(p_name, p_slug)` and frontend sends exactly that (`signup/page.tsx:49-52`) — match, no bug. Slug regex enforced server-side (migration line 45); UI has NO live availability check and NO format hint beyond placeholder — collision discovered only after OTP round-trip (high-cost failure). No institution-name/org-email consistency check surfaced.

### A3 Phase 2 — Roster ingestion (`app/institution-admin/page.tsx:44-74`, `components/admin/RosterUploadForm.tsx:132-175`)
**Ramanathan (raw monologue):**
> "Admin dashboard: Roster Upload, Invite Admin, Create Election, Elections, Pending Candidates. Uploading my test file — 50 good rows, 3 poisoned (blank email, 'not-an-email', duplicate roll). Preview appears FIRST: first 5 rows in a table, headers checked. It flags nothing yet because my headers are fine. Checkbox: 'I reviewed this preview and want to upload it.' — forced review, I like it. Confirm and upload… '✓ Inserted: 50, ✗ Errors: 3'. Error panel groups them: Missing email (1), Invalid email format (1), Duplicate roll number within upload (1)… wait, one of mine was a duplicate of an EXISTING roster row, labeled 'Email already in roster'. Precise. 'Download error report' gives me a dated CSV with row numbers. This is how you do imports. One gripe: this roster form is dark and polished, but the Create Election form right next to it looks like a default white prototype — different planet."

**ANALYST — Roster fold**
- Emotional state: highly satisfied (functionally), annoyed (visually, adjacent forms)
- Trust delta: ↑↑ (preview-before-upload at `RosterUploadForm.tsx:138-155`; required-columns gate at lines 62-66; grouped error labels `ERROR_LABELS` lines 7-16; downloadable CSV lines 120-130; post-upload `roster_import_errors` table at `institution-admin/page.tsx:49-73` capped at 50 latest)
- LIFT assessment: Value Prop ↑↑↑; Anxiety ↓↓
- Cialdini active: Authority (audit-grade diagnostics)
- Cialdini missing: none here
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes (Confirm and upload, correctly disabled until preview+checkbox pass, line 158)
- CTA reachable: Yes
- Technical notes: **Corrections — (a) prior report claimed an `invert grayscale` hack in `institution-admin/page.tsx`: FALSE, no such class exists in current code; (b) prior report asked for a CSV preview modal: ALREADY EXISTS.** Real remaining defects: (i) preview parses only first 6 lines (`parsePreview`, line 24) with a hand-rolled quote parser — quoted commas/newlines in names will mis-split, and only "first 5 rows" are shown so a poisoned row 4,000 is invisible pre-upload; (ii) `institution-admin/page.tsx:29` shows latest 50 errors while `RosterUploadForm` fetches 500 — two sources of truth, counts can disagree; (iii) error `Data` column does `JSON.stringify(e.raw_row)` truncated at 200px (line 67) — unreadable for long rows; (iv) no re-upload / "errors fixed" affordance — admin must leave page context to verify remediation.

### A3 Phase 3 — Elections + approvals (`components/admin/CreateElectionForm.tsx`, `ElectionTable.tsx`, `CandidateApprovalTable.tsx`, `app/institution-admin/page.tsx:83-117`)
**Ramanathan (raw monologue):**
> "Create Election: title, department (blank = institution-wide), year, opens/closes datetime. Create… appears in Elections table with Draft and a '→ nomination open' button. Clicking advances it. Pending Candidates shows Priya with manifesto; Approve/Reject side by side; approving removes her from the queue instantly. Closed elections get 'Audit certificates' links. Opening the report: official certificate, status, eligible count, votes cast, turnout, final tally, SHA-256 hash, Print button. That's my senate-minutes artifact. But honestly — these three forms look unfinished next to the roster uploader. Light gray boxes, default blue buttons, tiny text on a black page. And the Approve button gives me no 'are you sure?' — one misclick and a candidate is rejected with no undo in sight."

**ANALYST — Governance folds**
- Emotional state: in command, confidence dented by polish + irreversibility
- Trust delta: ↑ (lifecycle `STATUS_TRANSITIONS` at `ElectionTable.tsx:7-12` matches governance; `forceDepartment` correctly absent here so institution-wide allowed; audit report with `integrity_sha256` at `report/page.tsx:92` is exactly the artifact he needs)
- LIFT assessment: Clarity ↑ (transitions explicit); Distraction ↑ (theme break); Anxiety ↑ (destructive actions without confirm/undo)
- Cialdini active: Authority (hash + print)
- Cialdini missing: Commitment safeguards (no confirm on Approve/Reject/status advance)
- Fogg position: Motivation: High | Ability: High | Prompts visible: Yes
- CTA reachable: Yes
- Technical notes (all verified): (1) **Theme fracture**: `CreateElectionForm.tsx:57,69,81,94,105` (`border rounded`), `ElectionTable.tsx:34,43` (`bg-gray-50/hover:bg-gray-50`), `CandidateApprovalTable.tsx:38` (`bg-gray-50`), `InviteDeptAdminForm.tsx:63-79` (default light inputs, purple button) render light-prototype components inside `bg-black` admin shell — contrast hierarchy breaks; RosterUploadForm is the only dark-native form. (2) **No confirm/undo**: `CandidateApprovalTable.tsx:20-31` fires update on click, removes row on success, no confirm dialog, no undo, no rejected-list recovery view (rejected vanish from pending with no surface to reinstate). (3) **Silent status errors**: `ElectionTable.tsx:19-26` ignores update errors (no `setError` — failure just leaves stale UI). (4) `CreateElectionForm.tsx:32-33` does `new Date(opensAt).toISOString()` with no closes>opens validation and no timezone label — admin in IST picks local time, stored UTC, displayed via `toLocaleDateString` elsewhere; off-by-hours risk. (5) Dept-admin invite (`InviteDeptAdminForm.tsx:35-48`) depends on `invite-dept-admin` Edge Function — if un-deployed, the ONLY error is "Invite failed" with zero fallback path documented in UI.

### A3 Verdict
```
VERDICT
=======
Confidence score:     8/10 — backend/RPC/audit story is excellent; frontend polish and destructive-action safety lag behind.
Clarity score:        8/10
Relevance score:      10/10
Would I contact them: YES — would deploy Monday, with a checklist around invites + datetime verification.

Top 3 strengths:
1. Preview-gated CSV import with grouped, downloadable row errors (LIFT:Anxiety↓↓; RosterUploadForm.tsx:138-172).
2. Atomic institution creation + server-hardcoded roles (Cialdini:Authority; signup/page.tsx:49-52 + migration 20260912000001).
3. Printable SHA-256 audit certificate for closed elections (Cialdini:Authority; report/page.tsx:59-94).

Top 3 weaknesses:
1. Light-prototype admin forms inside dark shell — looks unfinished to a buyer (LIFT:Distraction↑).
2. Approve/Reject/status advances with no confirm and no undo; update errors swallowed (LIFT:Anxiety↑; CandidateApprovalTable.tsx:20-31; ElectionTable.tsx:19-26).
3. No live slug check; datetime-local with no closes>opens guard and no tz label (Fogg:Ability↓).

The moment I almost left: Never — closest was "did my invite actually send?" with a bare 'Invite failed'.
The moment I was most engaged: Grouped import errors + dated error-report CSV download.
```

---

## A4. Department Admin (HOD / Faculty in-charge)

```
PERSONA PROFILE
===============
Name:           Prof. Rajesh
Age & gender:   42M
Nationality:    Indian
Current situation: HOD Mechanical. Dean invited him to run the Mech 3rd-year rep election. Opens invite on ThinkPad/Chrome. Election in 4 days.

SEARCH CONTEXT
==============
Google query:      (invite email, not search)
Arrival source:    Email invite from institution admin
Sites seen before: University ERP, grading software
Device:            Lenovo ThinkPad 1920x1080 Chrome

PSYCHOLOGY
==========
Familiarity level:     Medium (hierarchy-literate, tech-cautious)
Urgency:               Medium
Primary fears:         Touching another department's election; approving a non-Mech student; not knowing how he got access
Trust triggers:        "Department: Mechanical Engineering" stamped on page; locked department field; Mech-only queues
Decision style:        Careful & compliant (SOP follower)
Attachment tendency:   Secure/structured (wants boundaries, not surprises)

GOAL
====
What success looks like: See ONLY Mech elections/candidates → create Mech-scoped election → vet Mech candidates → done, zero cross-dept noise.
Contact threshold:       Halts and calls Dean if CSE/EEE data appears in his queue.
```

### A4 Phase 0 — Pre-Arrival
Rajesh wants jurisdictional certainty above all. He also has no mental model for "how do I become dept admin" — invite UX is his first trust test.

**Relevance contract:** Header must stamp his department; creation must be mechanically incapable of escaping it; queues must be pre-filtered; invite path must be explained.

### A4 Phase 1 — Access + header (`app/department-admin/page.tsx:9-49`, `components/admin/InviteDeptAdminForm.tsx`)
**Rajesh (raw monologue):**
> "I got the Dean's email. It says… what, exactly? There's no invite code in my inbox, just 'you've been invited'. I sign in with OTP. The page says 'Department Admin' and underneath 'Department: Mechanical Engineering'. Good — that's my jurisdiction, stamped right at the top. But how did the system know I'm Mech? I never picked anything. I guess the Dean typed my department when inviting. I hope he spelled it exactly right — 'Mechanical Engineering' vs 'MECH' vs 'Mech' — because if it doesn't match the roster spelling, do I see nothing? Nobody tells me."

**ANALYST — Access fold**
- Emotional state: reassured (header) + uneasy (opaque provisioning)
- Trust delta: ↑ (`department-admin/page.tsx:46` department stamp; GlobalNav role line) / ↓ (invite mechanics invisible to invitee)
- LIFT assessment: Relevance ↑↑; Anxiety ↓ then ↑ (string-match fragility)
- Cialdini active: Authority (role+scope stamp)
- Cialdini missing: Clarity artifact (no "you were invited by X on Y" receipt)
- Fogg position: Motivation: Med-High | Ability: High | Prompt visible: n/a (landing, not action)
- CTA reachable: n/a
- Technical notes: Dept isolation is REAL defense-in-depth — page filters `.eq('scope_department', profile.department)` (line 27) AND RLS enforces it server-side; candidate queue further restricted via `electionIds` (lines 31-38). BUT department identity is a free-text string (`InviteDeptAdminForm.tsx:65-72` plain text input, no dropdown/datalist against roster departments) — "Mech" vs "Mechanical Engineering" mismatch = empty dashboard with zero explanatory copy. Guards at lines 20-21 (`role !== department_admin → /`, `!department → /`) redirect silently with no "contact your institution admin" message — Rajesh experiences it as "blank page / bounced home."

### A4 Phase 2 — Scoped creation (`components/admin/CreateElectionForm.tsx:13-17,55-72`)
**Rajesh (raw monologue):**
> "Create Election (dept-scoped). Department box is pre-filled 'Mechanical Engineering' and greyed out — I literally cannot change it. I type 'Mechanical 3rd Year Rep', year 3, pick dates, Create. It appears in my Elections list below. I feel safe: I couldn't break CSE if I tried."

**ANALYST — Creation fold**
- Emotional state: confident
- Trust delta: ↑↑ (poka-yoke: `forceDepartment` prop at `department-admin/page.tsx:58` + `disabled={!!forceDepartment}` at `CreateElectionForm.tsx:70` + RLS backstop)
- LIFT assessment: Clarity ↑↑; Anxiety ↓↓
- Cialdini active: Commitment (safe first creation)
- Fogg position: Motivation: High | Ability: High | Prompt visible: Yes
- CTA reachable: Yes
- Technical notes: Same datetime/validation gaps as A3 (no closes>opens check, no tz label). Year is free numeric input (line 75-82) — typo "33" creates an election no one can ever see (no voters match year 33) with no warning. Form shares the light-on-dark theme fracture.

### A4 Phase 3 — Vetting (`app/department-admin/page.tsx:30-38,71-76`)
**Rajesh (raw monologue):**
> "Pending Candidates — only Mech names, roll numbers like MECH-2024-041, Mech election titles. No CSE strays. I open a manifesto, check the roll, hit Approve. Gone from pending. Done. Though — same as the Dean's screen — no confirm, and where did Rejected go? If I fat-finger Reject on the wrong student, who do I call?"

**ANALYST — Vetting fold**
- Emotional state: satisfied + residual risk-awareness
- Trust delta: ↑↑ (isolation holds: `electionIds`-filtered queue)
- LIFT assessment: Relevance 10/10; Distraction ~0
- Cialdini active: Authority (scoped queue)
- Cialdini missing: Safety (confirm/undo)
- Fogg position: Complete
- CTA reachable: Yes

### A4 Verdict
```
VERDICT
=======
Confidence score:     9/10 — jurisdictional isolation is exemplary; provisioning transparency is not.
Clarity score:        9/10
Relevance score:      10/10
Would I contact them: YES — would run the Mech election without calling the Dean, unless dashboard comes up empty.

Top 3 strengths:
1. Stamped department + locked field + RLS backstop (LIFT:Anxiety↓↓; department-admin/page.tsx:46-58; CreateElectionForm.tsx:70).
2. Pre-filtered Mech-only candidate queue (Cialdini:Authority; page lines 30-38).
3. Same lifecycle controls as institution admin, correctly scoped (Fogg:Ability).

Top 3 weaknesses:
1. Free-text department on invite = silent mismatch → empty dashboard + silent redirect (LIFT:Clarity↓↓; InviteDeptAdminForm.tsx:65-72; department-admin/page.tsx:20-21).
2. No confirm/undo on Approve/Reject (LIFT:Anxiety↑).
3. Year typo creates invisible elections with no guard (Fogg:Ability↓; CreateElectionForm.tsx:75-82).

The moment I almost left: "How did I become Mech admin, and what if the Dean misspelled my department?"
The moment I was most engaged: Seeing the department field disabled — "I can't break anything."
```

---

## A5. Platform Admin (SaaS auditor)

```
PERSONA PROFILE
===============
Name:           Sarah
Age & gender:   29F
Nationality:    British-Canadian
Current situation: SRE/SecOps lead. Scheduled audit: adoption, open elections, turnout math, and PROOF that platform tier exposes zero PII/ballots.

SEARCH CONTEXT
==============
Google query:      (bookmark) "/platform-admin"
Arrival source:    Direct navigation, authorized platform_admin session
Sites seen before: CloudWatch, Supabase Dashboard, Datadog
Device:            MacBook Pro 16, high-DPI

PSYCHOLOGY
==========
Familiarity level:     Maximum
Urgency:               Medium (routine compliance)
Primary fears:         Tenant leak; PII in platform payload; wrong turnout denominator; uncaught RPC errors
Trust triggers:        Aggregates-only payloads, role-gated RPC, empty-state honesty, participation formula transparency
Decision style:        Audit & evidence-based
Attachment tendency:   Avoidant (numbers and boundaries only)

GOAL
====
What success looks like: Per-institution aggregates (elections/active/closed/roster/votes/participation) with zero names/emails/ballots; empty state when zero tenants; errors surfaced, never swallowed.
Contact threshold:       Sev-1 if ANY student PII or ballot row appears in platform output.
```

### A5 Phase 0 — Pre-Arrival
Sarah will inspect the network payload, not just the pixels. She wants the participation denominator defined (roster × eligible elections? or raw roster?) and the gate (`platform_admin` only) proven.

**Relevance contract:** Table + bars with institution-grained aggregates, honest empty state, RPC-shaped data only.

### A5 Phase 1 — Telemetry (`app/platform-admin/page.tsx:19-93`, migration `20260911000006_votes.sql:55-102`)
**Sarah (raw monologue):**
> "Signed in as platform admin. Header: 'Platform Admin — Aggregate Metrics · Cross-Institution View'. Table: Institution | Elections | Active | Closed | Roster | Votes | Participation. Plus participation bars with proper progressbar ARIA. Apex: 2 elections, 1 active, roster 50, votes 38, 76%. No student names, no emails, no ballot timestamps anywhere. Checking the query: get_platform_metrics returns per-institution rows — institution_id, institution_name, totals, participation_pct. Aggregate-shaped, as required. Empty state handled: 'No institutions registered yet.' Errors render inline. One thing I'd flag in the audit note: participation divides by roster × voting-or-closed elections — that's a defined choice, but a dean reading 76% may think 76% of students voted in the CURRENT election. Denominator needs a footnote. Also 'Active' counts only voting_open — nomination_open elections vanish from that column, which understates platform activity."

**ANALYST — Telemetry folds**
- Emotional state: analytically satisfied, with two documentation flags
- Trust delta: ↑↑ (role gate at `platform-admin/page.tsx:17` + RPC gate `my_role() != platform_admin → exception` at migration lines 68-71; payload shape lines 57-66 contains no email/name/ballot fields)
- LIFT assessment: Clarity 9/10; Relevance 10/10; Anxiety ~0 (for compliance)
- Cialdini active: Authority (precise aggregates + ARIA progressbars `platform-admin/page.tsx:52-54`)
- Cialdini missing: Transparency footnote (denominator definition)
- Fogg position: Motivation: High | Ability: High | Task complete
- CTA reachable: n/a (read-only dashboard, correctly so)
- Technical notes: (1) `get_platform_metrics` denominator (migration lines 85-94): `votes / (roster × elections in voting_open|closed)` — defensible but undisclosed in UI; cross-election averaging confuses per-election turnout. (2) `active_elections` counts ONLY `voting_open` (line 78-79); `nomination_open`/`draft` activity is invisible in that column — suggest renaming to "Voting now" or adding "Nominating" column. (3) No export (CSV/PDF) for compliance filing — Sarah screenshots the page; prior report's "exportable PDF" ask is valid but now PARTIALLY mitigated by the institution-level printable audit certificate (`report/page.tsx`), which platform tier correctly cannot see. (4) Positive: empty-state (lines 35-39) and RPC-error path (line 33) both render — no blank-screen failure mode.

### A5 Verdict
```
VERDICT
=======
Confidence score:     10/10 (privacy) / 8/10 (metric interpretability)
Clarity score:        9/10
Relevance score:      10/10
Would I contact them: YES — PASS on privacy; file two doc-level findings.

Top 3 strengths:
1. Aggregates-only RPC + double gate (page + function) with zero PII columns (Cialdini:Authority).
2. Honest empty + error states (LIFT:Anxiety↓).
3. Accessible participation bars + full table (Fogg:Ability).

Top 3 weaknesses:
1. Undisclosed participation denominator (LIFT:Clarity↓ for non-technical readers).
2. "Active" silently excludes nomination_open/draft (metric blind spot).
3. No compliance export at platform tier (workflow gap; workaround = per-election certs).

The moment I almost left: Never.
The moment I was most engaged: Confirming the RPC column list contains no PII — the audit's core question, answered.
```

---

## §6. Multi-persona comparison matrix

| Dimension | A0 Visitor | A1 Voter | A2 Candidate | A3 Inst. Admin | A4 Dept. Admin | A5 Platform Admin |
|---|---|---|---|---|---|---|
| Primary goal | Orient in 5s | Vote in <2 min | Nominate + prove pending | Roster→elections→audit | Mech-only governance | Aggregate audit, zero PII |
| Auth friction | Med (which button?) | **P0: UUID wall w/o deep link** | Low (returning OTP) | Low (atomic signup) | Med (opaque invite) | Low |
| Five-second pass? | **FAIL** (who is this for?) | PASS email / **FAIL UUID step** | PASS (badges+links) | PASS (feature copy) | PASS (dept stamp) | PASS |
| Visual consistency | OK (dark) | OK except unstyled guards | **Break: light cards in dark flow** | **Break: light forms in dark shell** | Same break | OK (dark grid) |
| Anxiety driver | Wrong-place fear | UUID + clipped manifesto + tiny links | Crop/length unknowns | Destructive no-confirm; invite opacity | Dept-string mismatch | Denominator ambiguity |
| Backend trust | n/a | UNIQUE + RLS solid | RLS self-view solid | RPCs + hash cert solid | RLS + filter solid | Aggregate-only solid |
| Shipped already (do NOT re-ask) | — | Countdown, GlobalNav institution | Photo preview | CSV preview, error CSV, audit cert | Locked dept field | Bars + table + empty state |
| Verdict | Maybe | **Conditional YES** | YES | YES | YES | PASS |

---

## §7. Recommendations (strictly prioritized, code-anchored)

### P0 — Conversion killers (fix before any polish)

**[P0-1] — Kill the first-login UUID wall**
Fold: A1 login-2 | Framework: LIFT:Anxiety↑↑↑ / Fogg:Ability↓↓
File: `app/login/page.tsx:11,16,53-57,110-124`
What: Never ask a student to type/paste a UUID. Resolve institution WITHOUT user input: (a) require `?institution=` on all voter outreach and keep it sticky through OTP (already partially read at line 11 — enforce + validate + show institution NAME, not UUID, with "Not your college? change" link); (b) if absent, replace UUID textbox with institution search-by-name/slug dropdown backed by a public `slug→id+name` lookup (new allow-list RPC — do NOT expose raw institution IDs list client-side without RLS review); (c) as fallback, attempt `claim` across candidate institutions by matching email domain and surface "We found you at X — confirm" instead of a hex field.
Why: Faiyaas abandons here; roommate lore ("36-character box") already poisons trust. Deep links mask the bug; every other arrival hits it.
Expected effect: Voter funnel unblocked for non-deep-link arrivals; support "where is my UUID?" tickets → ~0.

**[P0-2] — Confirm destructive admin actions + make failures visible**
Fold: A3/A4 governance | Framework: LIFT:Anxiety / Cialdini:Commitment-safety
Files: `components/admin/CandidateApprovalTable.tsx:20-31`, `components/admin/ElectionTable.tsx:19-26`
What: (a) `confirm()` or inline two-tap ("Approve? Confirm/Cancel") on Approve/Reject and on every status transition; (b) surface update errors (currently swallowed in ElectionTable) + add rejected-list view with Reinstate; (c) optimistic row removal only AFTER success toast with Undo window.
Why: Ramanathan and Rajesh both named the same fear: one misclick irreversibly rejects a real student.
Expected effect: Misclick blast radius → 0; admin confidence in live vetting during deadline rush.

### P1 — Quick wins (<1 day each)

**[P1-1] — Unify admin + candidate surfaces to dark-native**
Fold: A2/A3/A4 | Framework: LIFT:Distraction↓ / Cialdini:Authority↑
Files: `CreateElectionForm.tsx:57,69,81,94,105`, `ElectionTable.tsx:34,43`, `CandidateApprovalTable.tsx:38`, `InviteDeptAdminForm.tsx:55-83`, `app/elections/[id]/candidates/page.tsx:31,40,60-75`, `app/elections/[id]/vote/page.tsx:75-96`
What: Replace light-prototype classes (`bg-white/bg-gray-50/border rounded/blue-600 links`) with the dark system used by RosterUploadForm/elections list (`bg-transparent border-gray-800 text-white`, status-colored actions). Style vote-page guard states (loading/closed/voted/success) to match. Do NOT add an `invert` filter — the prior report's `invert` claim was false; the real defect is un-themed light components.
Why: Buyer-visible inconsistency: the demo looks "unfinished" exactly where money changes hands (admin), and students cross three themes in one journey.
Expected effect: Instant executive polish; fewer "is this page broken?" reports.

**[P1-2] — Make ballot actions thumb-sized + unclip manifestos**
Fold: A1/A2 | Framework: Fogg:Ability↑ / LIFT:Clarity↑
Files: `app/elections/page.tsx:68-87` (11px links), `app/elections/[id]/vote/page.tsx:122` (`line-clamp-2`), `CandidateApprovalTable.tsx:45` (`line-clamp-3`)
What: Promote Vote Now / Self-Nominate / Results to button hit-areas (min 44px) with status colors kept; add "Read full manifesto" expander on ballot (full text default, clamp only in dense admin rows) + character guidance on nominate form stating display behavior.
Why: Faiyaas nearly missed 11px Vote Now on 390px; Priya's platform is judged on clipped text.
Expected effect: Fewer mis-taps; manifesto-informed votes.

**[P1-3] — Pin institution identity + sticky CTA on landing**
Fold: A0 | Framework: LIFT:Relevance↑ / Fogg:Prompt
File: `app/page.tsx:26-67`
What: Add student-facing subhead ("Students: sign in with your college email — no password") + "How voting works (3 steps)" strip + sticky mobile CTA bar (Sign In) after hero. Add proof row (colleges/elections/votes counts or testimonial) — currently zero Social Proof in folds 1-2.
Why: Arjun's "is this for me?" fails; scroll kills both CTAs.
Expected effect: Cold→Sign-In progression; fewer wrong-place bounces.

**[P1-4] — Live slug check + datetime guards on creation**
Fold: A3/A4 | Framework: Fogg:Ability / LIFT:Anxiety↓
Files: `app/signup/page.tsx:22-34`, `components/admin/CreateElectionForm.tsx:29-37,75-82`
What: Debounced slug-availability/format hint pre-OTP; `closes_at > opens_at` validation + explicit tz label ("times are IST/local, stored UTC") + year sanity range (1-6) with warning when election would match zero roster rows.
Why: Slug collision costs an OTP round-trip; "Year 33" typo creates invisible elections.
Expected effect: First-try success on signup + election creation.

**[P1-5] — Invite transparency + department allow-list**
Fold: A4 | Framework: LIFT:Clarity / Cialdini:Authority
Files: `components/admin/InviteDeptAdminForm.tsx:35-72`, `app/department-admin/page.tsx:20-21`
What: Replace free-text department with dropdown sourced from roster's distinct departments; show invitee a receipt ("Invited by X on Y for Dept Z"); replace silent redirects with explanatory empty states ("No department assigned — contact your institution admin").
Why: String mismatch ("Mech" vs "Mechanical Engineering") = ghost dashboard; Rajesh's top fear.
Expected effect: Provisioning failures become self-diagnosing.

### P2 — Major (days, high impact)

**[P2-1] — Nomination countdown + next-step SLA copy**
Fold: A2 discovery | Framework: LIFT:Urgency↑ / Cialdini:Scarcity
Files: `app/elections/page.tsx:57-61` (countdown only for voting_open), `app/elections/[id]/nominate/page.tsx:127-132`
What: Render "Nominations close in X" on nomination_open cards + "Approvals typically within N hours; you can view your pending card here" post-submit.
Why: Priya's deadline urgency currently gets no visual Scarcity; post-submit ambiguity drives HOD emails.
Expected effect: Deadline-night submission velocity + fewer status pings.

**[P2-2] — Reconcile the two error-truths + harden CSV parse**
Fold: A3 roster | Framework: LIFT:Clarity / Fogg:Ability
Files: `components/admin/RosterUploadForm.tsx:23-39,102-112`, `app/institution-admin/page.tsx:23-34,49-73`
What: Single error source (or labeled "latest import" vs "history"); raise row cap or paginate; replace hand-rolled splitter with a quoted-CSV parser handling embedded commas/newlines; extend pre-upload scan beyond first 6 lines (stream count + header/duplicate pre-check); add "re-upload fixed rows" loop with diff ("3 fixed, 0 remaining").
Why: Hand parser + 6-line window + 50-vs-500 disagreement = the exact silent-corruption class Ramanathan fears.
Expected effect: Large-roster (3.5k) imports become auditable end-to-end.

**[P2-3] — Standardize photo contract (ratio + size at capture)**
Fold: A2 form | Framework: LIFT:Clarity
File: `app/elections/[id]/nominate/page.tsx:139-162`
What: State square-crop explicitly ("preview shows exact square crop"), add client downscale/compress to ≤2MB before upload, keep existing preview (already shipped — do not rebuild).
Why: Prevents silent center-crop surprises and 2MB rejections on phone photos.
Expected effect: Fewer re-submissions; consistent ballot headshots.

### P3 — Strategic (roadmap)

**[P3-1] — Turnout + results storytelling (voter-facing, post-close only)**
Fold: A1 results | Framework: Cialdini:Social Proof / LIFT:Urgency (next election)
Files: `app/elections/[id]/results/page.tsx:50-78`, `app/elections/page.tsx`
What: Closed-election cards gain turnout chip ("68% of CSE-3 voted"); results page gains bar visualization + winner callout (keep RPC-gated; never raw votes). RLS already locks pre-close — preserve it.
Why: Converts one-time voters into next-election returners; gives student unions a shareable artifact.
Expected effect: Compounding turnout across election cycles.

**[P3-2] — Platform compliance export + metric glossary**
Fold: A5 | Framework: Cialdini:Authority
File: `app/platform-admin/page.tsx:43-90`
What: CSV/PDF export of the aggregate table + footnote defining participation denominator + split "Voting now" vs "Nominating" columns.
Why: Sarah currently screenshots; deans misread averaged turnout.
Expected effect: Audit-ready filings; fewer metric-misread escalations.

---

## §8. Corrections to the prior version of this file (strictness log)

1. **"No institution box — FIXED" → FALSE.** `app/login/page.tsx:110-124` still renders `Institution ID / uuid of your institution` whenever `?institution=` is absent, and `53-57` errors out demanding it. P0 stands.
2. **"Add image preview" → ALREADY SHIPPED.** `nominate/page.tsx:155-160` renders live preview via `URL.createObjectURL`. Recommendation replaced with crop/length contract gaps.
3. **"Add countdown timer" → ALREADY SHIPPED.** `LiveCountdown.tsx` + usage in `elections/page.tsx:57-61` and `vote/page.tsx:102-104`. Remaining gap is nomination-side countdown only.
4. **"Add institution branding to nav" → ALREADY SHIPPED.** `GlobalNav.tsx:23-27,33-35` shows institution name + role. Remaining gap is landing-page (A0) identity, not nav.
5. **"Remove `invert grayscale` hack" → NOT PRESENT.** No `invert` class exists in `app/institution-admin/page.tsx` or `department-admin/page.tsx` in current code. Real defect is the opposite: un-themed light child components inside dark shells (cited above).
6. **"Native CSV preview modal" → ALREADY SHIPPED.** `RosterUploadForm.tsx:138-155` previews first 5 rows + requires checkbox confirm (line 153) before upload (line 158). Remaining gaps are parser depth and dual error-truths.
7. **"Audit certificate" → ALREADY SHIPPED.** `report/page.tsx:59-94` with SHA-256 + PrintButton; linked from `institution-admin/page.tsx:96-107`. Platform-export gap remains (P3-2).

*Report compiled by the Persona Walkthrough Specialist. All personas simulated against current code; contradictions between personas are intentional and preserved (e.g., admins want density, voters want minimalism, auditors want footnotes). Validate hypotheses with OTP-funnel telemetry, roster-error rates, and deadline-night session replays before treating any score as fact.*
