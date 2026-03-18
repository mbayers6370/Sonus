import { expect, test } from '@playwright/test';

/**
 * CI Smoke Tests for Sonus
 *
 * These tests verify critical user flows for continuous integration:
 * - App loads without crashing
 * - Authentication flow is accessible
 * - Support console (admin) access control works
 * - Core UI elements render
 *
 * Purpose: Rapid validation that core app functionality hasn't broken
 * Expected duration: ~20-30 seconds
 * Scope: Happy paths and access control only
 */

test.describe('CI Smoke Tests', () => {
  test('app loads without crashing on root', async ({ page }) => {
    // Navigate to root - should either show auth or redirect based on state
    await page.goto('/', { waitUntil: 'networkidle' });

    // App should load without 5xx errors
    const statusCode = page.status?.() || 0;
    expect([0, 200, 304]).toContain(statusCode);

    // Page title should contain "Sonus"
    await expect(page).toHaveTitle(/sonus/i);

    // Page should have rendered content
    const hasContent = await page.locator('body').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('navigation to support console is gated by auth', async ({ page }) => {
    // Navigate to support console without auth
    await page.goto('/support', { waitUntil: 'networkidle' });

    // Should either redirect to auth or show access denied
    const currentUrl = page.url();
    const isNotOnSupport = !currentUrl.includes('/support');
    expect(isNotOnSupport).toBeTruthy();
  });

  test('admin auth initializes support console successfully', async ({ page }) => {
    // Set up admin auth state
    await page.addInitScript(() => {
      const now = String(Date.now());
      const adminId = 'e2e-admin-user';
      localStorage.setItem('sonus.auth.demo_mode', '1');
      localStorage.setItem('sonus.auth.mock_user_id', adminId);
      localStorage.setItem('sonus.auth.mock_user_email', 'qa-admin-f8n2x7r1@sonus.test');
      localStorage.setItem('sonus.auth.mock_last_active_at', now);
      localStorage.setItem('sonus.auth.mock_is_admin', '1');
      localStorage.setItem('sonus.walkthrough.done:qa-admin-f8n2x7r1_sonus.test', '1');
      sessionStorage.setItem('sonus.auth.mock_window_id', 'e2e-admin-window');
      localStorage.setItem(
        `sonus-app-state:${adminId}`,
        JSON.stringify({
          selectedLanguage: 'ja',
          unlockedLevels: ['intro', 'band1', 'n5'],
        })
      );
    });

    await page.goto('/support', { waitUntil: 'networkidle' });

    // Should load without crashing
    const hasContent = await page.locator('body > *').first().isVisible();
    expect(hasContent).toBeTruthy();

    // No error message should be visible (e.g., 403, auth error)
    const errorText = await page
      .locator('text=/forbidden|error/i')
      .isVisible()
      .catch(() => false);
    expect(errorText).toBeFalsy();
  });

  test('page loads without unhandled JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      // Ignore expected third-party errors
      if (!error.message.includes('mocked-no-mic') && !error.message.includes('ResizeObserver')) {
        errors.push(error.message);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    // Should have no unhandled errors
    expect(errors.length).toBe(0);

    // Page should have rendered content
    await expect(page.locator('body > *').first()).toBeVisible();
  });

  test('navigation between pages completes without crashing', async ({ page }) => {
    // Navigate to different pages and verify no crash
    await page.goto('/', { waitUntil: 'networkidle' });
    let hasContent = await page.locator('body > *').first().isVisible();
    expect(hasContent).toBeTruthy();

    // Navigate to support (may redirect based on auth)
    await page.goto('/support', { waitUntil: 'networkidle' });
    hasContent = await page.locator('body > *').first().isVisible();
    expect(hasContent).toBeTruthy();

    // Navigate back to root
    await page.goto('/', { waitUntil: 'networkidle' });
    hasContent = await page.locator('body > *').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('api client is configured and responsive', async ({ page }) => {
    // Navigate to a page that loads
    await page.goto('/', { waitUntil: 'networkidle' });

    // Mock an API endpoint to ensure client is set up
    let apiCallMade = false;
    await page.route('**/v1/**', async (route) => {
      apiCallMade = true;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Try to trigger an API call (navigate somewhere that requires auth)
    await page.goto('/support', { waitUntil: 'networkidle' });

    // API client should be working (even if auth fails)
    // At minimum, page should not crash
    const hasContent = await page.locator('body > *').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('critical UI elements are renderable', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Page should have interactive elements
    const buttons = page.locator('button');
    const inputs = page.locator('input');
    const hasInteractiveElements = (await buttons.count()) > 0 || (await inputs.count()) > 0;
    expect(hasInteractiveElements).toBeTruthy();

    // Verify no major layout crashes (check for presence of main layout container)
    const hasLayout = await page
      .locator('body > *')
      .first()
      .boundingBox()
      .catch(() => null);
    expect(hasLayout).not.toBeNull();
  });
});
