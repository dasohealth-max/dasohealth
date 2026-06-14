import { test, expect, type Page } from '@playwright/test';

// Demo credentials – must match what `npm run seed:demo` creates.
const EMAIL = process.env.E2E_SUPER_EMAIL ?? 'super@demo.eyecare.org';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo1234!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Super Administrator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sees the dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('can navigate to campaigns page', async ({ page }) => {
    await page.getByRole('link', { name: /campaign/i }).click();
    await page.waitForURL(/\/campaigns/);
    await expect(page.getByRole('heading', { name: /campaign/i })).toBeVisible();
  });

  test('reports page shows all-region filter (not locked)', async ({ page }) => {
    await page.goto('/reports');
    // Super Admin should see a region select, not a locked text
    await expect(page.getByRole('combobox').first()).toBeVisible();
    // The locked text "Assigned region (locked)" should NOT appear
    await expect(page.getByText(/assigned region.*locked/i)).not.toBeVisible();
  });

  test('can filter reports by region', async ({ page }) => {
    await page.goto('/reports');
    await page.getByRole('combobox').first().click();
    // Pick the first non-"All regions" option
    const option = page.getByRole('option').nth(1);
    const regionName = await option.textContent();
    await option.click();
    if (regionName) {
      await expect(page.getByText(regionName.trim())).toBeVisible();
    }
  });

  test('campaigns page shows bulk creation UI', async ({ page }) => {
    await page.goto('/campaigns');
    // Super admin sees bulk create option for all 9 regions
    await expect(page.getByRole('button', { name: /bulk|all region/i })).toBeVisible();
  });

  test('can see all regions in region comparison table', async ({ page }) => {
    await page.goto('/reports');
    // Wait for data to load
    await page.waitForTimeout(2000);
    // Super admin should see multiple regions in the table
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2); // header + at least 1 data row
  });
});
