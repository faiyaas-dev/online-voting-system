# White-box and Black-box Test Report

**System:** Online Voting System  
**Test date:** 2026-09-16  
**Test data:** Synthetic only (`dummy-voter@example.com`, `dummy-admin@example.com`, `Dummy College`)  
**Assessment:** NEEDS WORK

## Scope and method

### White-box testing

The implementation, migrations, database tests, Jest configuration, Playwright configuration, and E2E specs were inspected. The following commands were run:

- `npm.cmd test -- --runInBand`
- `npm.cmd run build`
- `npx.cmd playwright test --reporter=line`
- Targeted source and SQL inspection under `app/`, `components/`, `supabase/`, and `tests/`

### Black-box testing

The Next.js development server was started with the repository's `.env.local` configuration and exercised at `http://localhost:3000` using a browser:

- Public landing page at `/`
- Login page at `/login`
- Institution registration at `/signup`
- Unauthenticated access to `/institution-admin`
- Invalid OTP-request handling
- Signup slug generation
- Mobile viewport at 375 × 667
- HTTP response and console-error observation

The existing repository evidence file [public/qa-screenshots/test-results.json](C:/Users/faiya/OneDrive/Desktop/online-voting-system/public/qa-screenshots/test-results.json) was also cross-checked. It is stale for this run: it reports that the application could not start, while the current local server did start successfully.

## Executive summary

| Area | Result |
|---|---|
| Build/type-check | PASS, with React Hook dependency warnings |
| Jest unit/integration execution | INCONCLUSIVE: no tests discovered |
| Playwright E2E execution | FAIL: test runner dependency conflict and selector mismatch |
| Public page rendering | PASS |
| Unauthenticated route protection | PASS for `/institution-admin` observed redirect to `/login` |
| Login error handling | PASS for rejected synthetic email; error is surfaced |
| Signup slug generation | PASS |
| Accessibility/testability | FAIL: visible labels are not associated with inputs |
| Full authenticated voter/admin journey | NOT EXECUTED: no controllable OTP/database fixtures |
| Production readiness | **NO-GO / NEEDS WORK** |

## Black-box results

### BB-01 — Public landing page

**Result:** PASS  
**Evidence:** `/` rendered the title “College Election System”, the security-oriented subtitle, and working links to `/login` and `/signup`. At 375 × 667 there was no horizontal overflow (`scrollWidth > innerWidth` evaluated to `false`).

### BB-02 — Login page and rejected synthetic OTP request

**Result:** PARTIAL PASS  
**Evidence:** `/login` rendered the email form. Submitting `dummy-voter@example.com` produced the visible error:

> Email address "dummy-voter@example.com" is invalid

The browser recorded a failed network response (`400`) from the Supabase auth request, and the UI surfaced the error instead of silently progressing.

**Limitation:** A real OTP verification, profile claim, election listing, vote, double-vote rejection, and results flow could not be executed without a controllable test mailbox and seeded backend identities.

### BB-03 — Signup slug generation

**Result:** PASS  
**Evidence:** Entering `Dummy College` automatically generated `dummy-college`. This verifies the client-side normalization path for ordinary synthetic input.

**Limitation:** OTP verification and the `create_institution_and_admin` RPC were not executed.

### BB-04 — Protected route behavior

**Result:** PASS for the tested route  
**Evidence:** Navigating to `/institution-admin` without an authenticated session landed on `/login`.

### BB-05 — Mobile rendering

**Result:** PASS for smoke coverage, not a complete responsive certification  
**Evidence:** The landing page rendered at 375 × 667 without horizontal overflow. Login and signup screenshots captured during the run showed centered, readable cards and controls.

### BB-06 — Evidence artifact consistency

**Result:** FAIL  
**Evidence:** [public/qa-screenshots/test-results.json](C:/Users/faiya/OneDrive/Desktop/online-voting-system/public/qa-screenshots/test-results.json) says the app cannot start because `.env.local` is missing and Docker is unavailable. In this run `.env.local` was present, `npm.cmd run dev` reached “Ready”, and browser requests succeeded. The artifact must be regenerated after the environment is provisioned.

## White-box results

### WB-01 — E2E tests assert a heading that the product does not render

**Severity:** High  
**Confidence:** 10/10  
**Evidence:** Both [tests/e2e/admin.spec.ts](C:/Users/faiya/OneDrive/Desktop/online-voting-system/tests/e2e/admin.spec.ts) and [tests/e2e/voter.spec.ts](C:/Users/faiya/OneDrive/Desktop/online-voting-system/tests/e2e/voter.spec.ts) expect a heading named `Log in`, while [app/login/page.tsx](C:/Users/faiya/OneDrive/Desktop/online-voting-system/app/login/page.tsx) renders `Sign in`. Both journeys fail before exercising their intended behavior.

**Impact:** The existing E2E suite cannot serve as a regression gate even for the login smoke step.

### WB-02 — Playwright loads two incompatible dependency trees

**Severity:** High  
**Confidence:** 10/10  
**Evidence:** `npx.cmd playwright test --reporter=line` failed with `Requiring @playwright/test second time`. The stack shows the root `node_modules` and a second `tests/node_modules` tree being loaded while importing [playwright.config.ts](C:/Users/faiya/OneDrive/Desktop/online-voting-system/playwright.config.ts).

**Impact:** The E2E runner cannot reliably collect or execute tests. This is independent of application behavior and must be fixed in repository dependency/layout configuration.

### WB-03 — Jest reports success without executing tests

**Severity:** High  
**Confidence:** 10/10  
**Evidence:** `npm.cmd test -- --runInBand` returned exit code 0 with `No tests found`. [jest.config.js](C:/Users/faiya/OneDrive/Desktop/online-voting-system/jest.config.js) only matches `tests/unit/**/*.test.[jt]s?(x)` and `tests/integration/**/*.test.[jt]s?(x)`, but the repository currently exposes E2E specs under `tests/e2e/` and SQL tests under `supabase/tests/database/`.

**Impact:** CI can appear green while the required unit/integration checks have not run. This is a false-positive quality gate.

### WB-04 — Form labels are not programmatically associated with controls

**Severity:** Medium  
**Confidence:** 10/10  
**Evidence:** In [app/login/page.tsx](C:/Users/faiya/OneDrive/Desktop/online-voting-system/app/login/page.tsx) and [app/signup/page.tsx](C:/Users/faiya/OneDrive/Desktop/online-voting-system/app/signup/page.tsx), `<label>` elements have no `htmlFor`, and inputs have no matching `id`. Browser automation using `getByLabel('Email address')` and the equivalent signup selectors could not locate the controls; placeholder-based selectors were required.

**Impact:** Screen-reader association is incomplete and robust user-facing automation is harder. This also explains why the supplied E2E selectors are fragile.

### WB-05 — React Hook dependency warnings in voter nomination/voting paths

**Severity:** Medium  
**Confidence:** 9/10  
**Evidence:** `npm.cmd run build` succeeded but emitted `react-hooks/exhaustive-deps` warnings in [app/elections/[id]/nominate/page.tsx](C:/Users/faiya/OneDrive/Desktop/online-voting-system/app/elections/[id]/nominate/page.tsx) and [app/elections/[id]/vote/page.tsx](C:/Users/faiya/OneDrive/Desktop/online-voting-system/app/elections/[id]/vote/page.tsx). The vote loader uses `useEffect(..., [])` while reading `electionId` and `supabase`.

**Impact:** Navigating between election IDs in a reused client component can leave stale data loaded. The warning is currently non-fatal, but it affects correctness of the core voting journey.

### WB-06 — Authenticated core flows lack executable fixtures

**Severity:** High  
**Confidence:** 9/10  
**Evidence:** The E2E files explicitly comment out OTP verification, navigation, voting, and result assertions. The SQL tests in [supabase/tests/database/01_unit_tests.sql](C:/Users/faiya/OneDrive/Desktop/online-voting-system/supabase/tests/database/01_unit_tests.sql) and [supabase/tests/database/02_leak_tests.sql](C:/Users/faiya/OneDrive/Desktop/online-voting-system/supabase/tests/database/02_leak_tests.sql) require a running Supabase/Postgres stack, which was not available in this environment.

**Impact:** The highest-risk requirements—single-vote enforcement, closed-election rejection, tally correctness, and cross-tenant isolation—remain unverified in this run.

## Findings by priority

| ID | Priority | Finding | Recommended action |
|---|---|---|---|
| WB-01 | P1 | E2E heading mismatch | Align the test and UI contract, then run the complete suite |
| WB-02 | P1 | Duplicate Playwright dependency trees break collection | Remove the nested test dependency tree or unify package resolution |
| WB-03 | P1 | Jest passes with zero discovered tests | Make required tests discoverable and fail when expected tests are absent |
| WB-06 | P1 | Core authenticated flows have no executable fixtures | Add local Supabase seed/auth fixtures or a documented test project and run the required database tests |
| WB-04 | P2 | Labels are not associated with inputs | Add stable `id`/`htmlFor` pairs to all form controls |
| WB-05 | P2 | Stale `useEffect` dependency arrays | Refactor dependencies/client creation so election changes reload the correct record |
| BB-06 | P2 | Stored QA JSON is stale and contradicts the current run | Regenerate screenshots and `test-results.json` from the current environment |

## Release recommendation

**Recommendation: NO-GO / NEEDS WORK.**

The public shell renders and basic unauthenticated interactions behave sensibly, but the evidence does not prove the application's defining behavior. The automated regression layer currently fails at collection or silently runs zero tests, and the authenticated vote/security paths were not executed against a seeded database. This is a testing and release-readiness failure, not evidence that the database policies themselves are incorrect.

## Required re-test exit criteria

1. `npm.cmd test -- --runInBand` discovers and executes the intended unit/integration tests.
2. `npx.cmd playwright test` collects without duplicate-module errors.
3. E2E selectors match the rendered UI and use accessible labels rather than placeholders.
4. A disposable Supabase test stack or linked test project seeds at least two institutions, voters, candidates, and elections.
5. The required database tests pass: double-vote rejection, closed-election rejection, tally correctness, and cross-tenant isolation.
6. Authenticated voter and institution-admin journeys complete end-to-end with screenshots and fresh `test-results.json`.
7. The React Hook warnings are resolved or explicitly justified with a regression test for changing election IDs.

**Re-test required:** Yes.  
**Suggested next iteration:** Fix P1 harness blockers first, then rerun the black-box journeys before changing visual styling.
