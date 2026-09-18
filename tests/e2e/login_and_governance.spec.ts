/**
 * Login fallback + governance confirmation suite.
 *
 * Pyramid placement (deliberate):
 * - Test 1 is full browser E2E on the client-rendered /login page: the
 *   Supabase GoTrue send and the get_public_institutions directory RPC are
 *   network-intercepted (no inbox, no shared seed, parallel-safe), and every
 *   asserted behavior (picker, voting-link parse, NAME banner) runs in the
 *   real component. No real Supabase traffic is required.
 * - Tests 2-3 exercise the REAL CandidateApprovalTable / ElectionTable
 *   components through the test-only /e2e-governance route (canned props,
 *   production-guarded via notFound). The production
 *   /institution-admin page is a server component that redirects
 *   unauthenticated traffic server-side, so it cannot be click-tested
 *   without a session — faking one via page.route is the wrong layer
 *   (see fixtures.ts). PostgREST mutation counters prove the first click
 *   fires no write; the specs never click Confirm, so no backend is needed.
 *
 * Selector strategy: getByLabel / getByRole / section[aria-label] only.
 * Waits: web-first assertions + waitForResponse on /auth/v1/otp.
 *        Zero waitForTimeout in this file.
 * Failure contract: every test collects pageerrors and asserts none —
 *        unhandled promise rejections fail the test, they never pass silent.
 */
import { test, expect, mockOtpSend, uniqueEmail } from './fixtures';
import type { Page } from '@playwright/test';

const DIRECTORY = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Harness College',
    slug: 'harness-college',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Other Institute',
    slug: 'other-institute',
  },
];

/** Collect unhandled page errors (incl. unhandled promise rejections). */
function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
}

/** Intercept the public institution directory RPC with a canned fixture. */
async function mockDirectory(page: Page): Promise<void> {
  await page.route('**/rest/v1/rpc/get_public_institutions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DIRECTORY),
    });
  });
}

/**
 * Drive /login (no ?institution=) to the OTP step with all network mocked.
 * Uses pressSequentially (real key events): locator.fill() does not stick on
 * type="email" inputs under the mobile-390 touch emulation (pre-existing
 * suite shows the same quirk), leaving the required input empty so native
 * validation blocks submit and the OTP request never fires.
 */
async function gotoOtpStepWithoutInstitution(
  page: Page,
  email: string,
): Promise<void> {
  await mockOtpSend(page);
  await mockDirectory(page);
  await page.goto('/login');
  await page.getByLabel('Email address').pressSequentially(email);
  await expect(page.getByLabel('Email address')).toHaveValue(email);
  const sent = page.waitForResponse(
    (r) => r.url().includes('/auth/v1/otp') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await sent;
  await expect(page.getByLabel('OTP code')).toBeVisible();
}

test.describe('Login fallback + governance confirmations', () => {
  test('voter login without ?institution= offers a college picker, never a raw-UUID input', async ({
    page,
  }) => {
    // Setup: cold arrival, no query params, OTP + directory RPC intercepted.
    // Expected: searchable picker + voting-link fallback; official NAME
    // banner on selection; zero hex IDs rendered or required.
    // Regression: P0-1 UUID abandonment wall.
    const errors = trackPageErrors(page);
    await gotoOtpStepWithoutInstitution(page, uniqueEmail('picker'));

    // Fallback selector is present and labelled for assistive tech.
    await expect(page.getByLabel(/your college/i)).toBeVisible();
    await expect(page.getByLabel(/paste your voting link/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Use link' }),
    ).toBeVisible();

    // No raw-UUID requirement anywhere in the form.
    await expect(page.getByLabel(/institution id/i)).toHaveCount(0);
    await expect(page.locator('input[placeholder*="uuid" i]')).toHaveCount(0);

    // Path A — voting link: a pasted outreach link resolves to the banner.
    await page
      .getByLabel(/paste your voting link/i)
      .pressSequentially(
        `https://college.test/login?institution=${DIRECTORY[0].id}`,
      );
    await page.getByRole('button', { name: 'Use link' }).click();
    await expect(page.getByText('Voting at')).toBeVisible();
    await expect(page.getByText('Harness College')).toBeVisible();

    // Reset to the picker via the explicit change control.
    await page
      .getByRole('button', { name: /not your college\? change/i })
      .click();
    await expect(page.getByLabel(/your college/i)).toBeVisible();

    // Path B — searchable dropdown: typing filters the directory by name.
    await page.getByLabel(/your college/i).pressSequentially('other');
    const option = page.getByRole('option', { name: /other institute/i });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByText('Voting at')).toBeVisible();
    await expect(page.getByText('Other Institute')).toBeVisible();

    // The resolved UUID is never shown on screen.
    await expect(page.locator('form')).not.toContainText(DIRECTORY[1].id);
    expect(errors).toEqual([]);
  });

  test('approve/reject requires a secondary confirmation step', async ({
    page,
  }) => {
    // Setup: harness renders the real CandidateApprovalTable (single-row
    // sections); PostgREST writes are counted, never performed.
    // Expected: first click surfaces Confirm/Cancel and decides nothing —
    // the row stays and zero mutations fire. Cancel restores the arm.
    // Regression: P0-2 single-click destructive vetting.
    const errors = trackPageErrors(page);
    let mutationCalls = 0;
    await page.route('**/rest/v1/candidates**', async (route) => {
      if (['PATCH', 'POST', 'DELETE'].includes(route.request().method())) {
        mutationCalls += 1;
      }
      await route.continue();
    });
    await page.goto('/e2e-governance');

    const approveSection = page.locator(
      'section[aria-label="Approve candidate"]',
    );
    const approve = approveSection.getByRole('button', {
      name: 'Approve',
      exact: true,
    });
    await expect(approve).toBeVisible();
    await approve.click();

    await expect(
      approveSection.getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeVisible();
    await expect(
      approveSection.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeVisible();
    // Row is undecided: still listed, nothing written.
    await expect(approveSection.getByText('Harness Approve')).toBeVisible();
    expect(mutationCalls).toBe(0);

    await approveSection
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(approve).toBeVisible();
    await expect(
      approveSection.getByRole('button', { name: 'Confirm', exact: true }),
    ).toHaveCount(0);

    // Reject arm mirrors the same gate.
    const rejectSection = page.locator(
      'section[aria-label="Reject candidate"]',
    );
    await rejectSection
      .getByRole('button', { name: 'Reject', exact: true })
      .click();
    await expect(
      rejectSection.getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeVisible();
    await expect(
      rejectSection.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeVisible();
    await expect(rejectSection.getByText('Harness Reject')).toBeVisible();
    expect(mutationCalls).toBe(0);
    expect(errors).toEqual([]);
  });

  test('election status transition prompts for confirmation before updating', async ({
    page,
  }) => {
    // Setup: harness renders the real ElectionTable with one draft election;
    // PostgREST writes are counted, never performed.
    // Expected: clicking the transition stages Confirm/Cancel with the
    // status cell unchanged; Cancel restores the transition button.
    // Regression: P0-2 unconfirmed lifecycle jumps + swallowed errors.
    const errors = trackPageErrors(page);
    let mutationCalls = 0;
    await page.route('**/rest/v1/elections**', async (route) => {
      if (['PATCH', 'POST', 'DELETE'].includes(route.request().method())) {
        mutationCalls += 1;
      }
      await route.continue();
    });
    await page.goto('/e2e-governance');

    const section = page.locator('section[aria-label="Election lifecycle"]');
    await expect(section.getByText('Harness Draft Election')).toBeVisible();
    const advance = section.getByRole('button', {
      name: /nomination open/i,
    });
    await expect(advance).toBeVisible();
    await advance.click();

    await expect(
      section.getByRole('button', { name: 'Confirm', exact: true }),
    ).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeVisible();
    // Status is staged, not applied: still draft, zero mutations fired.
    await expect(section.getByText('draft', { exact: true })).toBeVisible();
    expect(mutationCalls).toBe(0);

    await section
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(advance).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Confirm', exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
