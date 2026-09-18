import { test as base, expect, type Page, type Route } from '@playwright/test';

/**
 * Deterministic foundation for the voting-platform E2E suite.
 *
 * Why this exists (flake audit of the old suite):
 * - Old tests performed real OTP through the login FORM in every test
 *   (200 chances to flake on a page already covered once) and then
 *   assumed a redirect to /elections with zero backend. No email
 *   backend exists in CI, so every old test hung on `toHaveURL(/elections/)`.
 * - Old tests shared global state ("the seed user", sample-data/roster.csv
 *   on disk, first Approve/Close button on whatever page happened to load).
 * - Old selectors used `getByRole('link', { name: 'Vote' })` / generic
 *   `Approve` text that matches multiple nodes and shatters on copy edits.
 *
 * New contract:
 * - Setup through intercepted Supabase network (fast, deterministic,
 *   parallel-safe). Assert through the UI with role/label selectors.
 * - Every test owns its data: unique e-mail per test, no shared seed.
 * - Condition-based waits only (web-first assertions, waitForResponse,
 *   toHaveURL). Zero `waitForTimeout` anywhere in the suite.
 * - Server-rendered pages (elections, admin dashboards) cannot be
 *   network-mocked from the browser (they fetch server-side), so they are
 *   covered via unauthenticated redirect contracts + static PII audits,
 *   not via fake logins. Authenticated journeys use the client-rendered
 *   pages (login, signup, vote, nominate) where interception is sound.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ogfbnxqlzetdjxijufpw.supabase.co';

export function uniqueEmail(prefix: string): string {
  // Per-test owned data: parallel workers never collide.
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}@test.local`;
}

export function fakeUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Intercept Supabase GoTrue OTP send: POST .../auth/v1/otp -> 200 {}. */
export async function mockOtpSend(page: Page): Promise<void> {
  await page.route('**/auth/v1/otp**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    } else {
      await route.continue();
    }
  });
}

/**
 * Intercept GoTrue verify: POST .../auth/v1/verify -> 400 invalid-token.
 * Keeps the test on the OTP step deterministically without a real inbox.
 */
export async function mockOtpVerifyInvalid(page: Page): Promise<void> {
  await page.route('**/auth/v1/verify**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ msg: 'Token has expired or is invalid' }),
      });
    } else {
      await route.continue();
    }
  });
}

/** Drive login to the OTP step via mocked send (no inbox needed). */
export async function gotoOtpStep(page: Page, email: string): Promise<void> {
  await mockOtpSend(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  const sent = page.waitForResponse(
    (r) => r.url().includes('/auth/v1/otp') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await sent;
  await expect(page.getByLabel('OTP code')).toBeVisible();
}

export const test = base.extend<{
  ownedEmail: string;
}>({
  ownedEmail: async ({}, use) => {
    await use(uniqueEmail('voter'));
  },
});

export { expect };
