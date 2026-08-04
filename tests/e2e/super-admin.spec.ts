import { test, expect } from '@playwright/test';
import { hasE2ECredentials, loginAs } from './auth';

// E2E credentials must point at a prepared non-production test account.
const EMAIL = process.env.E2E_SUPER_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Super Administrator', () => {
  test.skip(!hasE2ECredentials(EMAIL, PASSWORD), 'E2E Super Administrator credentials are not configured');
  test.beforeEach(async ({ page }) => {
    await loginAs(page, EMAIL!, PASSWORD!, '/dashboard');
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
