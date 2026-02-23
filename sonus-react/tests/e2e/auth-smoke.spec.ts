import { expect, test } from '@playwright/test';

test('renders auth screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});
