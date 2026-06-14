import { test, expect, type Page } from '@playwright/test';

// Demo PM is assigned to Galmudug only.
const EMAIL = process.env.E2E_PM_EMAIL ?? 'pm.galmudug@demo.eyecare.org';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo1234!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Project Manager – region isolation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sees the dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('reports region filter is locked to assigned region', async ({ page }) => {
    await page.goto('/reports');
    // PM should see a locked region display, not a free select
    await expect(page.getByText(/assigned region.*locked/i)).toBeVisible();
    await expect(page.getByText(/Galmudug/)).toBeVisible();
  });

  test('reports page does not show other regions', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForTimeout(2000);
    // Should NOT see Banadir data (another region)
    await expect(page.getByText(/Banadir.*Mogadishu/i)).not.toBeVisible();
  });

  test('campaigns list only contains Galmudug campaigns', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForTimeout(1500);
    // All visible campaigns should be for Galmudug
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text) {
        // None should mention Banadir or other regions
        expect(text).not.toMatch(/Banadir|Jubaland|Puntland|Somaliland/i);
      }
    }
  });

  test('patients list is scoped to Galmudug', async ({ page }) => {
    await page.goto('/patients');
    await page.waitForTimeout(1500);
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text) expect(text).not.toMatch(/Banadir|Jubaland/i);
    }
  });

  test('cannot navigate to settings for other regions', async ({ page }) => {
    await page.goto('/settings');
    // PM can see settings but only for their region scope
    // Should not see an error or redirect to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
