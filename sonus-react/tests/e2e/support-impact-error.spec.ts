import { expect, test } from '@playwright/test';

test('shows explicit error banner when impact outcomes endpoint fails', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sonus.support_admin.token', 'test-support-token');
  });

  await page.route('**/v1/admin/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'qa-admin-f8n2x7r1@sonus.test' }),
    });
  });

  await page.route('**/v1/admin/metrics/impact-outcomes?**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Failed to load impact outcomes metrics.' }),
    });
  });

  await page.goto('/internal/support/metrics/impact-outcomes', {
    waitUntil: 'networkidle',
  });

  await expect(page.getByRole('heading', { name: /impact & outcomes/i })).toBeVisible();
  await expect(page.getByText('Failed to load impact outcomes metrics.')).toBeVisible();
});
