import { test, expect } from '@playwright/test';

test.describe('Voter Journey', () => {
  test('voter can log in, view elections, vote, and view results', async ({ page }) => {
    // 1. Sign up / OTP (Mocking or real if DB allows)
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    
    await page.getByLabel('Email address').fill('voterA@test.com');
    await page.getByRole('button', { name: 'Send OTP' }).click();
    
    // In a real E2E test without email access, we'd use a bypass token or mock the auth response.
    // Since Docker is unavailable here, we cannot hit the local Inbucket instance to fetch the OTP,
    // and magic link bypass requires changing production code or having an active DB to generate links.
    // For walkthrough purposes, assuming magic link clicked or OTP entered manually:
    await page.getByLabel('OTP code').fill('123456');
    await page.getByRole('button', { name: 'Verify & Sign in' }).click();

    // 2. View eligible elections
    // Assuming redirected to /elections
    await expect(page).toHaveURL(/\/elections/);
    await expect(page.getByRole('heading', { name: 'Elections' })).toBeVisible();

    // Take screenshot of elections list
    await page.screenshot({ path: 'public/qa-screenshots/voter-elections-list.png', fullPage: true });

    // 3. Vote
    await page.getByRole('link', { name: 'Vote' }).first().click();
    await expect(page.getByRole('heading', { name: 'Vote', exact: false })).toBeVisible();
    
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Cast Vote' }).click();
    
    // Take screenshot of vote confirmation
    await page.screenshot({ path: 'public/qa-screenshots/voter-vote-cast.png', fullPage: true });

    // 4. View locked results
    await page.getByRole('link', { name: 'Elections' }).first().click();
    await page.getByRole('link', { name: 'Results' }).first().click();
    await expect(page.getByText('locked', { exact: false })).toBeVisible();

    await page.screenshot({ path: 'public/qa-screenshots/voter-locked-results.png', fullPage: true });
  });
});
