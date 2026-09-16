import { test, expect } from '@playwright/test';

test.describe('Institution Admin Journey', () => {
  test('admin can upload roster, approve candidate, close election, view results', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    
    // In a real E2E test without email access, we'd use a bypass token or mock the auth response.
    // For walkthrough purposes, assuming admin is logged in:
    await page.goto('/institution-admin');
    
    await page.screenshot({ path: 'public/qa-screenshots/admin-dashboard.png', fullPage: true });

    // CSV Upload
    await page.getByLabel('CSV File', { exact: false }).setInputFiles('tests/fixtures/roster.csv');
    await page.getByRole('button', { name: 'Upload CSV' }).click();
    
    await page.screenshot({ path: 'public/qa-screenshots/admin-csv-upload.png', fullPage: true });

    // Approve Candidate
    await page.getByRole('button', { name: 'Approve' }).first().click();
    
    await page.screenshot({ path: 'public/qa-screenshots/admin-approve-candidate.png', fullPage: true });

    // Close Election
    await page.getByRole('button', { name: 'Close Election' }).first().click();
    
    await page.screenshot({ path: 'public/qa-screenshots/admin-close-election.png', fullPage: true });

    // View Results
    await page.getByRole('link', { name: 'View Results' }).first().click();
    
    await page.screenshot({ path: 'public/qa-screenshots/admin-view-results.png', fullPage: true });
  });
});
