# OTP "Token has expired or is invalid" — diagnostic journey

Date: 2026-09-22. Symptom: fresh email OTPs rejected instantly on
`/signup` Step 3 (Verify & Create) and `/login`, with
`AuthApiError: Token has expired or is invalid` (`403 otp_expired`).

## Timeline

1. **Report.** Two screenshots days apart: codes `090081`, then `281074`
   (with the newer hint text), both rejected seconds after arrival.
2. **Fix attempt 1 (wrong).** `verifyOtp` looped over deprecated types
   `['signup','email','magiclink']`. Unified to a single `type: 'email'`
   call per current Supabase docs (`signup`/`magiclink` deprecated since
   `gotrue#885`), plus double-submit guard and resend-clears-input.
   Lint + 30 unit tests + production build all green — but fresh codes
   still failed. Fix 1 was necessary hygiene, not the root cause.
3. **Forensics (read-only).** Confirmed single `type: 'email'` call live;
   only two send sites exist (send + resend per page, no hidden
   double-send); local `supabase/auth-templates/magic-link.html` is
   link-free (`{{ .Token }}` only) but untracked, so Dashboard state was
   unverified at that point.
4. **Web research.** Exact-match precedent `supabase/supabase#12868`
   (first code from Confirm-signup template 401s, retry from Magic-Link
   template works) and the Supabase OTP troubleshooting doc
   (scanner-consumed magic links invalidate the sibling code).
5. **User-supplied evidence (Phase A/B).**
   - A1: Dashboard project ref matches local `.env.local` — no wrong-project.
   - A2: auth user row for the address already exists.
   - A3: **Both** Confirm-signup and Magic-Link templates are link-free
     (no `ConfirmationURL`/`TokenHash`) — prefetch ruled out. Custom
     Gmail SMTP for sending.
   - A4: OTP expiry = 3600s.
   - B1/B2: browser sends `{email, 6-digit token, type: 'email'}` and gets
     401 `Token has expired or is invalid`.
6. **Phase C curl repro — the decider.**
   - Attempt 1 failed on procedure, not server: placeholder URL, then
     placeholder token `123456` (correctly 403s).
   - Attempt 2, real fresh code **`17399110` → 200 + `access_token`**,
     `email_confirmed_at` set. Server, templates, SMTP, and `type:
     'email'` all exonerated in one call.

## Verdict: two causes, different eras

- **Then (6-digit codes `090081`/`281074` rejected): stale/superseded
  challenges.** Auth timestamps show many challenges issued over the
  session (`created_at 06:25`, `confirmation requested 06:38`,
  `confirmed 07:17`). Supabase honors only the newest OTP per email;
  every extra Send/Resend (retries across days, double-click sends,
  resend-then-old-email) silently kills the code the user is reading.
- **Now (blocking): server issues 8-digit codes, app accepts only 6.**
  `17399110` has 8 digits; both OTP inputs cap at `maxLength={6}` and
  the guards reject anything whose digit-count `!== 6`
  (`app/signup/page.tsx:215-216,337`, `app/login/page.tsx:249-250,320`).
  Current codes can never verify — truncation guarantees a 403 that
  *looks* like expiry.

## Fix applied

- Both OTP inputs: `maxLength 6 → 10`, guard accepts any digit-string of
  length ≥ 6, all "6-digit code" copy → "verification code".
- Send OTP hardened against double-submit (a second click can no longer
  fire a second challenge that invalidates the first email's code).

## Follow-ups for the operator

- Confirm the OTP-length setting (Dashboard → Authentication →
  Providers → Email) so UI copy matches whatever length is configured.
- Retest live: Send OTP → newest email → type the **full** code →
  expect `/institution-admin` (this also exercises the previously
  untested `create_institution_and_admin` RPC tail).
- Keep templates link-free; keep custom SMTP (built-in mailer is
  dev-only per `docs/OTP_SETUP.md` §3).
- Discipline: one send → one verify; every Resend retires the previous
  email's code.
