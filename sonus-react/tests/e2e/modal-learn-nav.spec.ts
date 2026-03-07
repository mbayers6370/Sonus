import { expect, test } from '@playwright/test';

test('reports modal learn destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const now = String(Date.now());
    const userId = 'e2e-user';
    localStorage.setItem('sonus.auth.demo_mode', '1');
    localStorage.setItem('sonus.auth.mock_user_id', userId);
    localStorage.setItem('sonus.auth.mock_user_email', 'dev@local.test');
    localStorage.setItem('sonus.auth.mock_last_active_at', now);
    sessionStorage.setItem('sonus.auth.mock_window_id', 'e2e-window');
    localStorage.setItem(
      `sonus-app-state:${userId}`,
      JSON.stringify({
        selectedLanguage: 'ja',
        unlockedLevels: ['intro', 'band1', 'n5'],
      })
    );
  });

  await page.goto('/home', { waitUntil: 'networkidle' });

  const destinations: Record<string, string> = {};

  const clickLearnAction = async (label: 'Main' | 'Levels' | 'Units' | 'Lessons') => {
    await page.getByRole('button', { name: /^learn$/i }).click();
    await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).last().click();
    await page.waitForTimeout(500);
    const url = new URL(page.url());
    destinations[label] = `${url.pathname}${url.search}`;
  };

  await clickLearnAction('Main');
  await page.goto('/home');
  await clickLearnAction('Levels');
  await page.goto('/home');
  await clickLearnAction('Units');
  await page.goto('/home');
  await clickLearnAction('Lessons');

  console.log(`MODAL_LEARN_DESTINATIONS ${JSON.stringify(destinations)}`);
});

test('reports modal learn destinations with latest unlocked target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const now = String(Date.now());
    const userId = 'e2e-user-target';
    localStorage.setItem('sonus.auth.demo_mode', '1');
    localStorage.setItem('sonus.auth.mock_user_id', userId);
    localStorage.setItem('sonus.auth.mock_user_email', 'dev@local.test');
    localStorage.setItem('sonus.auth.mock_last_active_at', now);
    sessionStorage.setItem('sonus.auth.mock_window_id', 'e2e-window-target');
    localStorage.setItem(
      `sonus-app-state:${userId}`,
      JSON.stringify({
        selectedLanguage: 'ja',
        unlockedLevels: ['intro', 'band1', 'n5'],
      })
    );
  });

  await page.route('**/v1/me/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          currentBandId: 'n5',
          currentUnitId: 'n5-core-02',
          currentLessonIdx: 2,
        },
      }),
    });
  });

  await page.goto('/home', { waitUntil: 'networkidle' });

  const destinations: Record<string, string> = {};
  const clickLearnAction = async (label: 'Main' | 'Levels' | 'Units' | 'Lessons') => {
    await page.getByRole('button', { name: /^learn$/i }).click();
    await page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).last().click();
    await page.waitForTimeout(500);
    const url = new URL(page.url());
    destinations[label] = `${url.pathname}${url.search}`;
  };

  await clickLearnAction('Main');
  await page.goto('/home');
  await clickLearnAction('Levels');
  await page.goto('/home');
  await clickLearnAction('Units');
  await page.goto('/home');
  await clickLearnAction('Lessons');

  console.log(`MODAL_LEARN_DESTINATIONS_TARGET ${JSON.stringify(destinations)}`);
});

test('modal learn quick actions keep correct active state by stage', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const now = String(Date.now());
    const userId = 'e2e-user-active-state';
    localStorage.setItem('sonus.auth.demo_mode', '1');
    localStorage.setItem('sonus.auth.mock_user_id', userId);
    localStorage.setItem('sonus.auth.mock_user_email', 'dev@local.test');
    localStorage.setItem('sonus.auth.mock_last_active_at', now);
    sessionStorage.setItem('sonus.auth.mock_window_id', 'e2e-window-active-state');
    localStorage.setItem(
      `sonus-app-state:${userId}`,
      JSON.stringify({
        selectedLanguage: 'ja',
        unlockedLevels: ['intro', 'band1', 'n5'],
      })
    );
  });

  await page.route('**/v1/me/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          currentBandId: 'n5',
          currentUnitId: 'n5-core-02',
          currentLessonIdx: 2,
        },
      }),
    });
  });

  const openLearnMenu = async () => page.getByRole('button', { name: /^learn$/i }).click();

  await page.goto('/home', { waitUntil: 'networkidle' });

  await page.goto('/learn/jlpt/n5', { waitUntil: 'networkidle' });
  await openLearnMenu();
  await expect(page.getByRole('button', { name: /^levels$/i }).last()).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^units$/i }).last()).not.toHaveAttribute('aria-current', 'page');

  await page.goto('/learn/jlpt/n5?section=core', { waitUntil: 'networkidle' });
  await openLearnMenu();
  await expect(page.getByRole('button', { name: /^units$/i }).last()).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: /^levels$/i }).last()).not.toHaveAttribute('aria-current', 'page');

  await page.goto('/learn/jlpt/n5?section=core&unit=n5-core-02', { waitUntil: 'networkidle' });
  await openLearnMenu();
  await expect(page.getByRole('button', { name: /^lessons$/i }).last()).toHaveAttribute('aria-current', 'page');
});
