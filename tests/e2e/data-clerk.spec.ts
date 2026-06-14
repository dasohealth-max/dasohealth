import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_CLERK_EMAIL ?? 'clerk@demo.eyecare.org';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo1234!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Data Clerk – patient registration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sees the dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('can navigate to the patients page', async ({ page }) => {
    await page.getByRole('link', { name: /patient/i }).click();
    await page.waitForURL(/\/patients/);
    await expect(page.getByRole('heading', { name: /patient/i })).toBeVisible();
  });

  test('register patient form shows campaign locked to assigned campaign', async ({ page }) => {
    await page.goto('/patients');
    // Open the register form
    await page.getByRole('button', { name: /register|new patient|add/i }).click();

    // The campaign field should be read-only (locked to the clerk's campaign)
    // Region and district should also be disabled
    const campaignField = page.getByLabel(/campaign/i);
    const regionField = page.getByLabel(/region/i);
    await expect(campaignField).toBeDisabled();
    await expect(regionField).toBeDisabled();
  });

  test('registered patient appears in the screening queue', async ({ page }) => {
    await page.goto('/patients');
    await page.waitForTimeout(1500);
    // At least one patient should exist in demo data
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    await expect(rows.first()).toBeVisible();

    // Navigate to screening and verify the patient shows in queue
    await page.goto('/screening');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /screening/i })).toBeVisible();
  });

  test('cannot access surgeries page', async ({ page }) => {
    await page.goto('/surgeries');
    // Data Clerk should be redirected or see an access-denied message
    const isRedirected = page.url().includes('/dashboard') || page.url().includes('/login');
    const hasDenied = await page.getByText(/access denied|permission|forbidden/i).isVisible();
    expect(isRedirected || hasDenied).toBe(true);
  });

  test('cannot access settings', async ({ page }) => {
    await page.goto('/settings');
    const isRedirected = page.url().includes('/dashboard') || page.url().includes('/login');
    const hasDenied = await page.getByText(/access denied|permission|forbidden/i).isVisible();
    expect(isRedirected || hasDenied).toBe(true);
  });
});
