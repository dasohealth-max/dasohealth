import { expect, type Page } from '@playwright/test';

export function hasE2ECredentials(email: string | undefined, password: string | undefined) {
  return Boolean(email && password);
}

export async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectedPath: '/dashboard' | '/patients' | '/screening',
) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(new RegExp(`${expectedPath.replace('/', '\\/')}(?:$|\\?)`), { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(expectedPath.replace('/', '\\/')));
}
