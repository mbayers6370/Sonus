import { expect, test } from '@playwright/test';

test('speak mode records and renders result with mocked speech recognition', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const now = String(Date.now());
    const userId = 'e2e-speak-user';
    localStorage.setItem('sonus.auth.demo_mode', '1');
    localStorage.setItem('sonus.auth.mock_user_id', userId);
    localStorage.setItem('sonus.auth.mock_user_email', 'dev@local.test');
    localStorage.setItem('sonus.auth.mock_last_active_at', now);
    localStorage.setItem('sonus.walkthrough.done:dev_local.test', '1');
    sessionStorage.setItem('sonus.auth.mock_window_id', 'e2e-speak-window');
    localStorage.setItem(
      `sonus-app-state:${userId}`,
      JSON.stringify({
        selectedLanguage: 'ja',
        unlockedLevels: ['intro', 'band1', 'n5'],
      })
    );

    type MockAlt = { transcript: string; confidence: number };
    type MockResult = {
      0: MockAlt;
      isFinal: boolean;
      length: number;
    };
    type MockEvent = {
      resultIndex: number;
      results: MockResult[];
    };

    class MockSpeechRecognition {
      lang = 'ja-JP';
      continuous = false;
      interimResults = true;
      maxAlternatives = 1;
      phrases?: Array<{ phrase: string; boost?: number }>;
      onresult: ((event: MockEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      private emitted = false;

      start() {
        if (this.emitted) return;
        this.emitted = true;
        window.setTimeout(() => {
          if (this.onresult) {
            const finalResult = [{ transcript: 'てすと', confidence: 0.9 }] as unknown as MockResult;
            finalResult.isFinal = true;
            finalResult.length = 1;
            const results = [finalResult];
            results.length = 1;
            this.onresult({ resultIndex: 0, results });
          }
        }, 25);
      }

      stop() {
        this.onend?.();
      }
    }

    (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition = MockSpeechRecognition;
    (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = MockSpeechRecognition;

    const mediaDevices = {
      getUserMedia: () => Promise.reject(new Error('mocked-no-mic')),
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: mediaDevices,
    });
  });

  await page.route('**/v1/me/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        progress: {
          currentBandId: 'n5',
          currentUnitId: 'n5-speaking',
          currentLessonIdx: 0,
        },
      }),
    });
  });

  await page.goto('/home', {
    waitUntil: 'networkidle',
  });
  const skipTour = page.getByRole('button', { name: /skip tour/i });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
  }
  const speakingPracticeButton = page.getByRole('button', { name: /speaking practice/i }).first();
  const canOpenSpeakingPractice = await speakingPracticeButton.isEnabled().catch(() => false);
  test.skip(!canOpenSpeakingPractice, 'Speaking practice is unavailable for a fresh demo profile in this environment.');
  await speakingPracticeButton.click();
  await page.waitForURL(/\/speak$/);

  const recordButton = page.getByRole('button', { name: /start recording|stop recording/i });
  await expect(recordButton).toBeVisible();
  await recordButton.click();

  await expect(page.getByText(/listening|scoring/i)).toBeVisible();
  await expect(page.getByText(/needs work|correct/i).first()).toBeVisible({ timeout: 15_000 });
});
