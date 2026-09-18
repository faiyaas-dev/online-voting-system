/**
 * Admin governance + department scope + platform privacy suite.
 *
 * Test level: E2E redirect contracts (server pages fetch server-side, so
 * unauthenticated access deterministically redirects to /login — asserted
 * here with condition-based URL waits). Approve/Reject confirm dialogs are
 * currently ABSENT in CandidateApprovalTable.tsx:20-31, so they are pinned
 * as fixme regression guards rather than deleted. Privacy (no PII in
 * platform payload) is asserted statically against the RPC migration plus
 * the unauthenticated redirect — never by logging in as platform_admin
 * through the UI in 200 tests.
 *
 * Setup: none (no session cookies) — isolation by design.
 * Selector strategy: headings/links by role; static file reads for PII audit.
 * Waits: toHaveURL(/login) — never sleeps.
 */
import { test, expect } from './fixtures';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Admin governance', () => {
  test('unauthenticated /institution-admin redirects to login (fail closed)', async ({ page }) => {
    await page.goto('/institution-admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('unauthenticated /department-admin redirects to login (fail closed)', async ({ page }) => {
    await page.goto('/department-admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated /platform-admin redirects to login (fail closed)', async ({ page }) => {
    await page.goto('/platform-admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated election report redirects to login', async ({ page }) => {
    await page.goto('/institution-admin/elections/00000000-0000-4000-8000-000000000000/report');
    await expect(page).toHaveURL(/\/login/);
  });

  test('platform metrics RPC exposes aggregates only — zero PII columns', async () => {
    // Static audit of supabase/migrations/20260911000006_votes.sql: the
    // get_platform_metrics payload must never select emails, names, or
    // ballot rows. If this fails, a platform-tier leak shipped.
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '20260911000006_votes.sql'),
      'utf8',
    );
    const fn = migration.slice(migration.indexOf('get_platform_metrics'));
    expect(fn).toBeTruthy();
    expect(fn).not.toMatch(/email|full_name|roll_no|ballot|signedUrl/i);
    expect(fn).toMatch(/institution_name|total_elections|participation_pct/i);
  });

  test('department isolation queries own scope (static contract)', async () => {
    // Pins department-admin/page.tsx:27 (.eq scope_department) + RLS backstop.
    // A silent empty dashboard (mismatched free-text dept) must surface an
    // explanatory state — tracked as P1-5; this test locks the filter itself.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app', 'department-admin', 'page.tsx'),
      'utf8',
    );
    expect(src).toMatch(/eq\('scope_department', profile\.department\)/);
  });

  test.fixme('approve/reject requires explicit confirmation', async ({ page }) => {
    // Known gap (walkthrough P0-2): CandidateApprovalTable fires update on
    // click with no confirm/undo and ElectionTable swallows update errors.
    // Pinned fixme — implement two-tap Confirm/Cancel + visible error, then
    // un-fixme this test. Deleting it deletes a bug report.
    await page.goto('/institution-admin');
    await expect(page.getByRole('button', { name: 'Approve' }).first()).toBeVisible();
  });
});
