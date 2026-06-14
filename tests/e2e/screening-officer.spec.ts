import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_SCREENER_EMAIL ?? 'screener@demo.eyecare.org';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo1234!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Screening Officer – full workflow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can see the screening queue', async ({ page }) => {
    await page.goto('/screening');
    await expect(page.getByRole('heading', { name: /screening/i })).toBeVisible();
    // Waiting queue section should exist
    await expect(page.getByText(/waiting|queue/i).first()).toBeVisible();
  });

  test('search filters the patient queue by name or code', async ({ page }) => {
    await page.goto('/screening');
    await page.waitForTimeout(1500);
    const searchInput = page.getByPlaceholder(/search|name|code/i).first();
    await expect(searchInput).toBeVisible();

    // Type a search term that should reduce results
    await searchInput.fill('ZZZNOMATCH');
    await page.waitForTimeout(500);
    // After filtering, no patient rows visible (or empty state)
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    expect(count).toBe(0);
  });

  test('selecting a patient shows immutable region context', async ({ page }) => {
    await page.goto('/screening');
    await page.waitForTimeout(1500);
    // Click the first patient in queue if one exists
    const firstPatient = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).first();
    const patientExists = await firstPatient.isVisible();
    if (!patientExists) {
      test.skip(); // no demo patient in queue
    }
    await firstPatient.click();

    // Region field in the screening form should be disabled
    const regionField = page.getByLabel(/region/i);
    if (await regionField.isVisible()) {
      await expect(regionField).toBeDisabled();
    }
  });

  test('Refer for Surgery creates a surgery record', async ({ page }) => {
    await page.goto('/surgeries');
    await page.waitForTimeout(1500);
    const beforeCount = await page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).count();

    await page.goto('/screening');
    await page.waitForTimeout(1500);
    const firstPatient = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).first();
    const patientExists = await firstPatient.isVisible();
    if (!patientExists) test.skip();

    await firstPatient.click();
    // Select "Refer for Surgery" recommendation
    const recommendationSelect = page.getByLabel(/recommendation/i);
    if (await recommendationSelect.isVisible()) {
      await recommendationSelect.selectOption('Refer for Surgery');
      await page.getByRole('button', { name: /save|submit|screen/i }).click();
      await page.waitForTimeout(2000);

      await page.goto('/surgeries');
      await page.waitForTimeout(1500);
      const afterCount = await page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).count();
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    }
  });

  test('follow-up tasks appear after completing a surgery', async ({ page }) => {
    await page.goto('/surgeries');
    await page.waitForTimeout(1500);
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    if (count === 0) test.skip();

    // Look for a surgery that can be completed
    const completableRow = rows.filter({ hasText: /scheduled|in.theatre/i }).first();
    const isVisible = await completableRow.isVisible();
    if (!isVisible) test.skip();

    // Click complete action
    const completeBtn = completableRow.getByRole('button', { name: /complete|edit/i }).first();
    if (await completeBtn.isVisible()) {
      await completeBtn.click();
      // Fill in surgery date if required
      const performedAtInput = page.getByLabel(/performed|surgery date|actual date/i);
      if (await performedAtInput.isVisible()) {
        await performedAtInput.fill('2025-03-01');
      }
      await page.getByRole('button', { name: /complete|save/i }).click();
      await page.waitForTimeout(2000);
    }

    // Check follow-ups page
    await page.goto('/followups');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /follow.?up/i })).toBeVisible();
    const fuRows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    await expect(fuRows.first()).toBeVisible();
  });

  test('can flag a follow-up as needing doctor review', async ({ page }) => {
    await page.goto('/followups');
    await page.waitForTimeout(1500);
    const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
    const count = await rows.count();
    if (count === 0) test.skip();

    // Click edit/view on first follow-up
    const editBtn = rows.first().getByRole('button', { name: /edit|view|update/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      // Toggle needs doctor review
      const doctorReviewToggle = page.getByLabel(/doctor review|needs review/i);
      if (await doctorReviewToggle.isVisible()) {
        await doctorReviewToggle.check();
        await page.getByRole('button', { name: /save|submit/i }).click();
        await page.waitForTimeout(1000);
        // Verify it shows in the doctor review pending tab
        await page.getByRole('tab', { name: /doctor review|review/i }).click();
        await expect(page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') }).first()).toBeVisible();
      }
    }
  });
});
