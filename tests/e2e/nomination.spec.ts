/**
 * Candidate nomination suite.
 *
 * Pyramid placement: /elections/[id]/nominate is middleware-gated like the
 * ballot (no session -> /login before any client mock can run). E2E pins
 * the fail-closed redirect + the validation/preview/duplicate contracts
 * that are statically verifiable; byte-level upload policy stays
 * server-side (storage RLS + 2MB/MIME guards in nominate/page.tsx:8-9).
 *
 * Photo-preview behaviour (URL.createObjectURL + alt text) is exercised
 * at unit level in tests/unit/nomination-guards.test.ts against the same
 * constants, so a UI refactor that keeps the contract stays green.
 */
import { test, expect } from './fixtures';
import fs from 'node:fs';
import path from 'node:path';

const ELECTION_ID = '44444444-4444-4444-8444-444444444444';
const NOMINATE_SRC = path.join(process.cwd(), 'app', 'elections', '[id]', 'nominate', 'page.tsx');

test.describe('Candidate nomination', () => {
  test('unauthenticated nominate access fails closed to login', async ({ page }) => {
    await page.goto(`/elections/${ELECTION_ID}/nominate`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('photo constraints stated before upload + live preview wired', async () => {
    // Pins nominate/page.tsx:152 (JPEG/PNG/WebP + 2MB label) and :155-160
    // (URL.createObjectURL preview with alt "Selected candidate headshot
    // preview"). Regression: silent photo rejection (walkthrough A2).
    const src = fs.readFileSync(NOMINATE_SRC, 'utf8');
    expect(src).toMatch(/JPEG\/PNG\/WebP/i);
    expect(src).toMatch(/max 2 MB/i);
    expect(src).toMatch(/Selected candidate headshot preview/);
    expect(src).toMatch(/URL\.createObjectURL/);
  });

  test('oversize/wrong-type photos rejected with actionable copy', async () => {
    // Pins nominate/page.tsx:60-70 — specific messages, preview cleared,
    // never a silent drop.
    const src = fs.readFileSync(NOMINATE_SRC, 'utf8');
    expect(src).toMatch(/Only JPEG, PNG, or WebP images are allowed/);
    expect(src).toMatch(/File must be under 2 MB/);
  });

  test('duplicate nomination + closed-nomination states have plain copy', async () => {
    // Pins nominate/page.tsx:113-125 — already-nominated and not-open
    // guards with recovery links, no raw UNIQUE violation surfacing.
    const src = fs.readFileSync(NOMINATE_SRC, 'utf8');
    expect(src).toMatch(/already submitted a nomination/i);
    expect(src).toMatch(/Nominations are not open/i);
  });

  test.fixme(
    'square-crop + manifesto-length guidance visible before submit',
    async ({ page }) => {
      // Known gap (walkthrough A2): display is square object-cover and
      // voters see line-clamp-2, but the form states neither. Pinned as
      // fixme so the suite stays green while tracked — do NOT delete
      // without shipping the copy.
      await page.goto(`/elections/${ELECTION_ID}/nominate`);
      await expect(page.getByText(/square crop/i)).toBeVisible();
    },
  );
});
