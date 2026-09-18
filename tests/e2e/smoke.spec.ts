/**
 * Smoke suite — landing + auth gates.
 * Fast, backend-independent, merge-blocking. Every test owns its data
 * (none needed) and waits on conditions only.
 */
import { test, expect } from './fixtures';

test.describe('Smoke — landing and auth gates', () => {
  test('landing answers relevance in 5s: Sign In + Register Institution visible', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register Institution' })).toBeVisible();
  });

  test('signup renders institution-first flow with slug auto-shape', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await expect(page.getByLabel('Institution Name')).toBeVisible();
    await expect(page.getByLabel(/slug/i)).toBeVisible();
    await expect(page.getByLabel('Admin Email')).toBeVisible();
  });

  test('protected voter route redirects unauthenticated to login', async ({ page }) => {
    await page.goto('/elections');
    await expect(page).toHaveURL(/\/login/);
  });
});
