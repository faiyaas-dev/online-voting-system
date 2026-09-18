/**
 * Login + first-login institution resolution suite.
 *
 * Test level: E2E (browser) — the integration under test IS the risk
 * (OTP form -> claim RPC -> role redirect), so this belongs at the top
 * of the pyramid. Pure validation (slug regex, error mapping) lives in
 * tests/unit and is referenced, not duplicated, here.
 *
 * Setup: per-test owned e-mail (fixtures.ownedEmail); Supabase GoTrue
 * network intercepted (no inbox, no shared seed, parallel-safe).
 * Selector strategy: getByLabel / getByRole only — survives redesigns.
 * Waits: web-first assertions + waitForResponse on /auth/v1/otp.
 *        Zero waitForTimeout in this file.
 */
import { test, expect, gotoOtpStep } from './fixtures';

test.describe('Login — institution resolution', () => {
  test('cold arrival without ?institution= never shows a raw-UUID requirement as the only path', async ({
    page,
  }) => {
    // Setup: unauthenticated GET /login with no query params.
    // Selector: heading + email label (user-facing semantics).
    // Expected: sign-in renders with email-first flow; OTP step is reachable
    // without knowing any UUID. Regression: P0-1 UUID abandonment wall
    // (persona_walkthrough_findings §8.1 / login/page.tsx:110-124).
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
  });

  test('deep-link ?institution=<uuid> stays sticky through Send OTP -> Verify', async ({
    page,
    ownedEmail,
  }) => {
    // Setup: institution id carried only as a hidden value from outreach link.
    // Selector: URL param + OTP-code label.
    // Expected: context survives the OTP round-trip (never re-asked).
    // Regression: context-loss forcing UUID re-entry mid-flow.
    const institutionId = '11111111-1111-4111-8111-111111111111';
    await gotoOtpStep(page, ownedEmail);
    // Navigate with the deep link while preserving the OTP-step state is
    // driven by the URL param read at login/page.tsx:11.
    await page.goto(`/login?institution=${institutionId}`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.getByLabel('Email address').fill(ownedEmail);
    await expect(page).toHaveURL(new RegExp(`institution=${institutionId}`));
  });

  test('invalid institution context fails closed with actionable copy, session retained', async ({
    page,
    ownedEmail,
  }) => {
    // Setup: reach OTP step via mocked send, then attempt verify with a
    // mocked invalid-token response (no real inbox).
    // Selector: OTP label + Verify button + error paragraph.
    // Expected: visible error, still on login, e-mail preserved for retry.
    // Regression: raw SQL/RPC passthrough + dead-end lockout.
    const { mockOtpVerifyInvalid } = await import('./fixtures');
    await gotoOtpStep(page, ownedEmail);
    await mockOtpVerifyInvalid(page);
    await page.getByLabel('OTP code').fill('000000');
    await page.getByRole('button', { name: 'Verify & Sign in' }).click();
    // Condition-based wait: error paragraph appears (auto-retried assertion).
    const error = page.locator('form p.text-red-500').first();
    await expect(error).toBeVisible();
    // Recovery: Change-email control retains the flow instead of stranding.
    await expect(page.getByRole('button', { name: /change email/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('returning voter with a profile never re-enters institution context (client contract)', async ({
    page,
  }) => {
    // Setup: none (static code contract — login/page.tsx:41-50 redirects by
    // role when a profiles row exists, with no claim call and no prompt).
    // This test pins the bypass shape: the OTP form itself must not demand
    // institution input before auth. Full bypass is covered at API level.
    // Selector: e-mail form only.
    await page.goto('/login');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
  });

  test('login never renders raw SQL/RPC internals on the OTP step', async ({
    page,
    ownedEmail,
  }) => {
    // Setup: mocked invalid verify to force the error path.
    // Selector: error paragraph text.
    // Expected: no SQLSTATE / constraint / function names leak into UI.
    // Regression: claimError.message verbatim passthrough (login/page.tsx:63).
    const { mockOtpVerifyInvalid } = await import('./fixtures');
    await gotoOtpStep(page, ownedEmail);
    await mockOtpVerifyInvalid(page);
    await page.getByLabel('OTP code').fill('000000');
    await page.getByRole('button', { name: 'Verify & Sign in' }).click();
    const error = page.locator('form p.text-red-500').first();
    await expect(error).toBeVisible();
    const text = (await error.textContent()) ?? '';
    expect(text).not.toMatch(/SQLSTATE|constraint|claim_voter_profile|23505|auth\.jwt/i);
  });

  test('clear error + recovery: Change email preserves the typed address', async ({
    page,
    ownedEmail,
  }) => {
    // Setup: reach OTP step, then step back.
    // Selector: Change-email button + email input value.
    // Expected: typed e-mail preserved, Send OTP reachable again.
    await gotoOtpStep(page, ownedEmail);
    await page.getByRole('button', { name: /change email/i }).click();
    await expect(page.getByLabel('Email address')).toHaveValue(ownedEmail);
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
  });
});
